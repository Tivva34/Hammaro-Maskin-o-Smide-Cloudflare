import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, X, Save, Loader2, AlertTriangle, Upload, Star, Trash2, ArrowUp, ArrowDown, Image as ImageIcon } from 'lucide-react';
import {
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
  INVENTORY_STATUS_OPTIONS,
  INVENTORY_CATEGORIES,
  uploadInventoryImage,
  deleteInventoryImage,
  setPrimaryInventoryImage,
  updateInventoryImageSortOrder,
  generateSlug,
  ensureUniqueSlug,
} from '../../lib/inventoryService';
import { createSaleRecord, revertSaleRecord } from '../../lib/salesService';

// ─── Reusable form field wrapper ───────────────────────────────────────────────
const Field = ({ label, hint, required, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
    <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
      {label}{required && <span style={{ color: '#ef4444', marginLeft: '0.2rem' }}>*</span>}
    </label>
    {hint && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hint}</span>}
    {children}
  </div>
);

const inputStyle = {
  padding: '0.7rem 0.9rem',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  fontSize: '0.9375rem',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};

const focusInput = e => { e.target.style.borderColor = 'var(--accent-primary)'; };
const blurInput = e => { e.target.style.borderColor = 'var(--border-color)'; };

// ─── Empty form state ──────────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '', name_en: '', price: '', category: 'other',
  description: '', description_en: '', status: 'draft'
};

// ─── Main component ────────────────────────────────────────────────────────────
const InventoryFormPage = () => {
  const { id } = useParams();   // undefined = new item
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [slugPreview, setSlugPreview] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Sales tracking
  const [originalStatus, setOriginalStatus] = useState('draft');
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [tempSoldPrice, setTempSoldPrice] = useState('');
  const [confirmedSoldPrice, setConfirmedSoldPrice] = useState(null);

  // Images
  const [images, setImages] = useState([]);
  const [deletedImages, setDeletedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [createdId, setCreatedId] = useState(null);

  // ── Load existing item for editing ────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!isEditing) return;
    const { data, error: err } = await getInventoryItemById(id);
    if (err || !data) {
      setError('Lösöret hittades inte eller kunde inte hämtas.');
      setLoadingData(false);
      return;
    }
    setForm({
      name: data.name ?? '',
      name_en: data.name_en ?? '',
      price: data.price != null ? String(data.price) : '',
      category: data.category ?? 'other',
      description: data.description ?? '',
      description_en: data.description_en ?? '',
      status: data.status ?? 'draft',
    });
    setOriginalStatus(data.status ?? 'draft');
    setImages(data.inventory_images || []);
    setDeletedImages([]);

    setSlugPreview(data.slug ?? '');
    const autoSlug = generateSlug(data.name ?? '');
    const isManual = data.slug && data.slug !== autoSlug;
    setSlugManual(Boolean(isManual));

    setLoadingData(false);
  }, [id, isEditing]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Auto-generate slug from name (only when NOT editing or manual) ───────────
  useEffect(() => {
    if (slugManual) return;
    if (!form.name) { setSlugPreview(''); return; }
    setSlugPreview(generateSlug(form.name));
  }, [form.name, slugManual]);

  // ── Cleanup Object URLs on unmount ───────────────────────────────────────────
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach(img => {
        if (img.is_local && img.image_url) {
          URL.revokeObjectURL(img.image_url);
        }
      });
    };
  }, []);

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError('');
    setSuccess('');
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim()) { setError('Namn är obligatoriskt.'); return; }

    setSaving(true);
    let currentId = createdId || id;
    const actualIsEditing = isEditing || Boolean(createdId);

    try {
      if (actualIsEditing) {
        const { error: err } = await updateInventoryItem(currentId, { ...form, slug: slugPreview });
        if (err) throw new Error('Kunde inte spara: ' + err.message);
      } else {
        const uniqueSlug = await ensureUniqueSlug(slugPreview || generateSlug(form.name));
        const { data, error: err } = await createInventoryItem({ ...form, slug: uniqueSlug });
        if (err) throw new Error('Kunde inte lägga till lösöret: ' + err.message);
        currentId = data.id;
        setCreatedId(data.id);
      }

      // 1. Delete removed DB images
      for (const img of deletedImages) {
        const { error: err } = await deleteInventoryImage(img.id, img.storage_path);
        if (err) console.error("Failed to delete image:", err);
      }

      // 2. Upload new local images
      let uploadedIdsMap = {};
      for (const img of images) {
        if (img.is_local) {
          const { data, error: err } = await uploadInventoryImage(currentId, img.file);
          if (err) throw new Error('Ett fel uppstod vid bilduppladdning: ' + err.message);
          uploadedIdsMap[img.id] = data.id;
        }
      }

      // 3. Update Sort Order & Primary status
      const updates = images.map((img, idx) => ({
        id: img.is_local ? uploadedIdsMap[img.id] : img.id,
        sort_order: idx
      }));
      const primaryImg = images.find(img => img.is_primary);
      const primaryId = primaryImg ? (primaryImg.is_local ? uploadedIdsMap[primaryImg.id] : primaryImg.id) : null;

      if (updates.length > 0) {
        const { error: errSort } = await updateInventoryImageSortOrder(updates);
        if (errSort) throw new Error('Kunde inte spara bildordning: ' + errSort.message);
      }
      
      if (primaryId) {
        const { error: errPrim } = await setPrimaryInventoryImage(currentId, primaryId);
        if (errPrim) throw new Error('Kunde inte spara huvudbild: ' + errPrim.message);
      }

      // Handle sales record
      if (form.status === 'sold' && originalStatus !== 'sold') {
        const { error: saleErr } = await createSaleRecord({
          item_id: currentId,
          item_type: 'inventory',
          item_name: form.name,
          item_category: form.category,
          sold_at: new Date().toISOString(),
          sold_price: confirmedSoldPrice !== null ? confirmedSoldPrice : null
        });
        if (saleErr) throw new Error('Kunde inte registrera försäljning: ' + saleErr.message);
        setOriginalStatus('sold');
      } else if (form.status !== 'sold' && originalStatus === 'sold') {
        await revertSaleRecord(currentId);
        setOriginalStatus(form.status);
      }

      setSaving(false);
      
      // Navigate directly to the list view on success
      navigate('/admin?tab=inventory');
      return;
    } catch (err) {
      setSaving(false);
      setError(err.message);
      window.scrollTo(0, 0);
    }
  };

  // ── Image Handlers ────────────────────────────────────────────────────────────
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    const validFiles = [];
    const oversizedFiles = [];

    files.forEach(file => {
      if (file.size > MAX_SIZE) {
        oversizedFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    });

    if (oversizedFiles.length > 0) {
      setError(prev => {
        const errorMsg = `Följande bild(er) är för stora (max 10 MB): ${oversizedFiles.join(', ')}`;
        return prev ? prev + ' | ' + errorMsg : errorMsg;
      });
    }

    if (validFiles.length > 0) {
      const newLocalImages = validFiles.map(file => ({
        id: 'local_' + Math.random().toString(36).substr(2, 9),
        file,
        image_url: URL.createObjectURL(file),
        is_primary: false,
        is_local: true,
      }));

      setImages(prev => {
        const next = [...prev, ...newLocalImages];
        if (!next.some(img => img.is_primary) && next.length > 0) {
          next[0].is_primary = true;
        }
        return next;
      });
    }

    e.target.value = null;
  };

  const handleDeleteImage = (imageId) => {
    const imgToDelete = images.find(img => img.id === imageId);
    if (!imgToDelete) return;

    if (imgToDelete.is_local) {
      URL.revokeObjectURL(imgToDelete.image_url);
    } else {
      setDeletedImages(prev => [...prev, imgToDelete]);
    }

    setImages(prev => {
      let next = prev.filter(img => img.id !== imageId);
      if (imgToDelete.is_primary && next.length > 0) {
        next[0].is_primary = true;
      }
      return next;
    });
  };

  const handleSetPrimary = (imageId) => {
    setImages(prev => prev.map((img) => ({
      ...img,
      is_primary: img.id === imageId
    })));
  };

  const handleMoveImage = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === images.length - 1) return;

    const newImages = [...images];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;

    const temp = newImages[index];
    newImages[index] = newImages[swapIndex];
    newImages[swapIndex] = temp;

    setImages(newImages);
  };

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
        <div style={{ width: '24px', height: '24px', border: '2px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Hämtar lösöre…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <header style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          <Link to="/admin?tab=inventory" style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: '1.1rem', textDecoration: 'none' }}>
            <span style={{ color: 'var(--text-primary)' }}>HAMMARÖ</span>{' '}
            <span style={{ color: 'var(--accent-primary)' }}>ADMIN</span>
          </Link>
          <Link to="/admin?tab=inventory" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Tillbaka till dashboard
          </Link>
        </div>
      </header>

      {/* Form */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontFamily: 'Outfit,sans-serif', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2rem', letterSpacing: '-0.02em' }}>
          {isEditing ? 'Redigera lösöre' : 'Lägg till lösöre'}
        </h1>

        {/* Alerts */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '0.875rem 1rem', marginBottom: '1.5rem', color: '#f87171', fontSize: '0.9375rem' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', marginLeft: 'auto' }}><X size={16} /></button>
          </div>
        )}
        {success && (
          <div style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', padding: '0.875rem 1rem', marginBottom: '1.5rem', color: '#4ade80', fontSize: '0.9375rem' }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <section style={sectionStyle}>
            <h2 style={sectionHeading}>Grundinformation</h2>
            
            <div style={gridTwo}>
              <Field label="Kategori" hint="Lösörekategori" required>
                <select 
                  value={form.category} 
                  onChange={e => set('category', e.target.value)} 
                  style={inputStyle} onFocus={focusInput} onBlur={blurInput}
                >
                  <option value="agriculture">Lantbrukstillbehör</option>
                  <option value="construction">Entreprenadtillbehör</option>
                  <option value="workshop">Verkstadsutrustning</option>
                  <option value="tires">Däck & Fälgar</option>
                  <option value="parts">Reservdelar & Komp.</option>
                  <option value="other">Övrigt</option>
                </select>
              </Field>
              <Field label="Pris (kr)" hint="Lämna tomt → 'Kontakta oss för pris'">
                <input type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)}
                  placeholder="t.ex. 1500" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
              </Field>
            </div>

            <h3 style={{ fontSize: '1.1rem', marginTop: '1rem', color: 'var(--text-primary)' }}>Svenska</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Field label="Namn" required>
                <input
                  type="text" value={form.name} required
                  onChange={e => set('name', e.target.value)}
                  placeholder="t.ex. Arbetsbänk"
                  style={inputStyle} onFocus={focusInput} onBlur={blurInput}
                />
              </Field>
              <Field label="URL-slug" hint="Slugen skapas automatiskt från namnet och uppdateras när namnet ändras. Om du ändrar slugen manuellt behålls ditt val.">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>/losore/</span>
                  <input
                    type="text" value={slugPreview}
                    onChange={e => { setSlugPreview(e.target.value); setSlugManual(true); }}
                    placeholder="losore-slug"
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={focusInput} onBlur={blurInput}
                  />
                </div>
              </Field>
              <Field label="Beskrivning">
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  rows={5} placeholder="Beskriv objektet..."
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                  onFocus={focusInput} onBlur={blurInput}
                />
              </Field>
            </div>

            <h3 style={{ fontSize: '1.1rem', marginTop: '1rem', color: 'var(--text-primary)' }}>English</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Field label="Name">
                <input
                  type="text" value={form.name_en}
                  onChange={e => set('name_en', e.target.value)}
                  placeholder="e.g. Workbench"
                  style={inputStyle} onFocus={focusInput} onBlur={blurInput}
                />
              </Field>
              <Field label="Description">
                <textarea value={form.description_en} onChange={e => set('description_en', e.target.value)}
                  rows={5} placeholder="Describe the item..."
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                  onFocus={focusInput} onBlur={blurInput}
                />
              </Field>
            </div>
          </section>

          {/* ── Section: Images ── */}
          <section style={sectionStyle}>
              <h2 style={{ ...sectionHeading, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={20} color="var(--accent-primary)" /> Bilder
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
                Lösörets bilder visas offentligt i galleriet. Den primära bilden används som huvudbild.
              </p>

              {/* Upload Button */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.875rem 1.5rem', backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)', borderRadius: '8px',
                  color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9375rem',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.7 : 1, transition: 'background-color 0.2s'
                }}>
                  {uploading ? (
                    <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Laddar upp…</>
                  ) : (
                    <><Upload size={18} /> Välj bilder att ladda upp</>
                  )}
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    style={{ display: 'none' }}
                  />
                </label>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Max 10 MB per bild. Tillåtna format: JPG, PNG, WEBP, GIF.
                </div>
              </div>

              {/* Image Grid */}
              {images.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '1rem',
                }}>
                  {images.map((img, idx) => (
                    <div key={img.id} style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: img.is_primary ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative'
                    }}>
                      {img.is_primary && (
                        <div style={{
                          position: 'absolute', top: '0.5rem', left: '0.5rem',
                          backgroundColor: 'var(--accent-primary)', color: 'var(--text-inverse)',
                          padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem',
                          fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.2rem'
                        }}>
                          <Star size={12} fill="currentColor" /> Huvudbild
                        </div>
                      )}
                      <div style={{ height: '140px', backgroundColor: '#000' }}>
                        <img src={img.image_url} alt={img.alt_text} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', backgroundColor: 'var(--bg-surface)' }}>

                        {/* Left actions: sorting */}
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button type="button" onClick={() => handleMoveImage(idx, 'up')} disabled={idx === 0}
                            style={imgActionBtn(idx === 0)} aria-label="Flytta upp">
                            <ArrowUp size={16} />
                          </button>
                          <button type="button" onClick={() => handleMoveImage(idx, 'down')} disabled={idx === images.length - 1}
                            style={imgActionBtn(idx === images.length - 1)} aria-label="Flytta ner">
                            <ArrowDown size={16} />
                          </button>
                        </div>

                        {/* Right actions: star and trash */}
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button type="button" onClick={() => handleSetPrimary(img.id)}
                            style={{ ...imgActionBtn(img.is_primary), color: img.is_primary ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                            title={img.is_primary ? "Redan huvudbild" : "Gör till huvudbild"} disabled={img.is_primary}>
                            <Star size={16} fill={img.is_primary ? "currentColor" : "none"} />
                          </button>
                          <button type="button" onClick={() => handleDeleteImage(img.id, img.storage_path)}
                            style={{ ...imgActionBtn(false), color: '#ef4444' }} title="Ta bort">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--bg-primary)', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                  Inga bilder uppladdade ännu.
                </div>
              )}
          </section>

          {/* ── Section: Status ── */}
          <section style={sectionStyle}>
            <h2 style={sectionHeading}>Status & Publicering</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {INVENTORY_STATUS_OPTIONS.map(s => {
                const isActive = form.status === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => {
                      if (s.value === 'sold' && form.status !== 'sold') {
                        setTempSoldPrice(form.price || '');
                        setShowSoldModal(true);
                      } else {
                        set('status', s.value);
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '0.875rem 1rem',
                      backgroundColor: isActive ? 'var(--bg-primary)' : 'var(--bg-surface)',
                      border: isActive ? `2px solid var(--accent-primary)` : `1px solid var(--border-color)`,
                      borderRadius: '8px',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-pressed={isActive}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Actions ── */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '1rem' }}>
            <button
              type="submit"
              disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem 1.5rem', backgroundColor: 'var(--accent-primary)', color: 'var(--text-inverse)', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '1rem', fontFamily: 'Inter,sans-serif', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />Sparar…</> : <><Save size={16} />{isEditing ? 'Spara ändringar' : 'Skapa lösöre'}</>}
            </button>
            <Link to="/admin?tab=inventory"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem 1.5rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '1rem', textDecoration: 'none' }}>
              Avbryt
            </Link>
          </div>
        </form>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      
      {/* Sold Modal */}
      {showSoldModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{ backgroundColor: 'var(--bg-surface)', padding: '2rem', borderRadius: '12px', maxWidth: '400px', width: '100%', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>Markera som såld</h3>
            <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Faktiskt försäljningspris (kr)</label>
                <input 
                  type="text"
                  inputMode="numeric"
                  value={tempSoldPrice}
                  onChange={e => setTempSoldPrice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    outline: 'none',
                    marginTop: '0.5rem'
                  }}
                  placeholder="Fyll i slutpris (frivilligt men rekommenderas)..."
                />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button 
                type="button" 
                onClick={() => { setShowSoldModal(false); setTempSoldPrice(''); }}
                style={{ padding: '0.75rem 1.5rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}
              >Avbryt</button>
              <button 
                type="button" 
                onClick={() => {
                  let parsed = null;
                  const numericString = tempSoldPrice.toString().replace(/\D/g, '');
                  if (numericString) {
                    parsed = parseInt(numericString, 10);
                  } else if (form.price) {
                    parsed = parseInt(form.price.toString().replace(/\D/g, ''), 10);
                  }
                  
                  if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
                    alert('Ange ett giltigt försäljningspris.');
                    return;
                  }
                  set('status', 'sold');
                  setConfirmedSoldPrice(parsed);
                  setShowSoldModal(false);
                }}
                style={{ padding: '0.75rem 1.5rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >Bekräfta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Shared section styles
const sectionStyle = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '1.5rem',
  marginBottom: '1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const sectionHeading = {
  fontSize: '1rem',
  fontFamily: 'Outfit,sans-serif',
  fontWeight: 700,
  color: 'var(--text-primary)',
  margin: 0,
  paddingBottom: '0.75rem',
  borderBottom: '1px solid var(--border-color)',
};

const gridTwo = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: '1rem',
};

const imgActionBtn = (disabled) => ({
  background: 'none',
  border: 'none',
  cursor: disabled ? 'not-allowed' : 'pointer',
  padding: '0.25rem',
  color: disabled ? 'var(--border-color)' : 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '4px',
});

export default InventoryFormPage;
