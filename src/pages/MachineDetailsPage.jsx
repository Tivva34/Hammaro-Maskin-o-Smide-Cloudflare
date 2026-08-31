import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Calendar, Tag, ChevronRight, X, ChevronLeft } from 'lucide-react';
import { getMachineBySlug, getSimilarMachines } from '../lib/machinesService';
import { useLang } from '../contexts/LanguageContext';
import QuoteModal from '../components/QuoteModal';
import TransportSection from '../components/TransportSection';

const MachineDetailsPage = () => {
  const { slug } = useParams();
  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [similarMachines, setSimilarMachines] = useState([]);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const { t, tDb, lang } = useLang();

  // Arrow keys & escape for lightbox
  const handleKeyDown = useCallback((e) => {
    if (!lightboxOpen) return;
    if (e.key === 'Escape') {
      setLightboxOpen(false);
    } else if (machine?.machine_images && machine.machine_images.length > 1) {
      const currentIndex = machine.machine_images.findIndex(img => img.id === selectedImage?.id);
      if (e.key === 'ArrowRight') {
        setSelectedImage(machine.machine_images[(currentIndex + 1) % machine.machine_images.length]);
      } else if (e.key === 'ArrowLeft') {
        setSelectedImage(machine.machine_images[(currentIndex - 1 + machine.machine_images.length) % machine.machine_images.length]);
      }
    }
  }, [lightboxOpen, machine, selectedImage]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Prevent background scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = lightboxOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightboxOpen]);

  useEffect(() => {
    const fetchMachine = async () => {
      setLoading(true);
      setError('');
      const { data, error: err } = await getMachineBySlug(slug);
      if (err || !data) {
        setError(t('machineDetail.errorDefault'));
      } else {
        setMachine(data);
        if (data.machine_images && data.machine_images.length > 0) {
          const primaryImg = data.machine_images.find(img => img.is_primary);
          setSelectedImage(primaryImg || data.machine_images[0]);
        }
        const { data: similarData } = await getSimilarMachines(data.id, data.type, 3);
        if (similarData) setSimilarMachines(similarData);
      }
      setLoading(false);
    };
    fetchMachine();
  }, [slug, t, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (machine) {
      const displayMachineName = lang === 'en' ? (machine.name_en || machine.name) : machine.name;
      document.title = `${displayMachineName} | Hammarö Maskin & Smide`;
    }
    return () => {
      document.title = 'Hammarö Maskin & Smide';
    };
  }, [machine, lang]);

  // Note: t is stable (memoised in context) – we intentionally only refetch on slug change

  if (loading) {
    return (
      <div style={{ minHeight: 'clamp(400px, 60vh, 800px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '1rem' }} />
        <span style={{ fontSize: '1.125rem' }}>{t('machineDetail.loading')}</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{t('machineDetail.errorTitle')}</h1>
        <p style={{ fontSize: '1.125rem', marginBottom: '2rem', color: 'var(--text-secondary)' }}>{error}</p>
        <Link to="/maskiner" className="btn btn-primary">
          {t('machineDetail.showAllMachines')}
        </Link>
      </div>
    );
  }

  const defaultImage = 'https://placehold.co/800x600/1e2123/a0a6aa?text=Bild+saknas';
  const mainImageUrl = selectedImage ? selectedImage.image_url : defaultImage;

  const displayMachineName = lang === 'en' ? (machine.name_en || machine.name) : machine.name;
  const displayMachineDesc = lang === 'en' ? (machine.description_en || machine.description) : machine.description;
  const displayFeatures = lang === 'en' ? (machine.features_en && machine.features_en.length > 0 ? machine.features_en : machine.features) : machine.features;
  const specsObject = lang === 'en' && machine.specs_en && Object.keys(machine.specs_en).length > 0 ? machine.specs_en : machine.specs;
  const specsEntries = specsObject ? Object.entries(specsObject) : [];

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchMove = (e) => {
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);

    if (isHorizontalSwipe && Math.abs(distanceX) > minSwipeDistance) {
      if (machine?.machine_images && machine.machine_images.length > 1) {
        const cur = machine.machine_images.findIndex(img => img.id === selectedImage?.id);
        if (distanceX > 0) {
          // Swipe left -> next image
          if (cur < machine.machine_images.length - 1) {
            setSelectedImage(machine.machine_images[cur + 1]);
          }
        } else {
          // Swipe right -> prev image
          if (cur > 0) {
            setSelectedImage(machine.machine_images[cur - 1]);
          }
        }
      }
    }
  };

  return (
    <>
      <div style={{ backgroundColor: 'var(--bg-primary)', paddingBottom: '4rem' }}>

        {/* Breadcrumbs */}
        <div style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', padding: '1rem 0' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <Link to="/" style={{ color: 'var(--text-muted)' }}>{t('machineDetail.home')}</Link>
              <ChevronRight size={14} />
              <Link to="/maskiner" style={{ color: 'var(--text-muted)' }}>{t('machineDetail.machines')}</Link>
              <ChevronRight size={14} />
              <ChevronRight size={14} />
              <span style={{ color: 'var(--text-primary)' }}>{displayMachineName}</span>
            </div>
          </div>
        </div>

        <div className="container" style={{ marginTop: '3rem' }}>
          <Link to="/maskiner" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9375rem', fontWeight: 500 }}>
            <ArrowLeft size={16} /> {t('machineDetail.back')}
          </Link>

          <div className="machine-details-grid">

            {/* Left – Image Gallery */}
            <div>
              <div style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                position: 'relative',
                marginBottom: '1rem',
                aspectRatio: '4/3',
                maxHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'zoom-in',
                touchAction: 'pan-y',
              }}
                onClick={() => setLightboxOpen(true)}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEndHandler}
              >
                <img
                  src={mainImageUrl}
                  alt={selectedImage ? selectedImage.alt_text || displayMachineName : displayMachineName}
                  style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', padding: '1rem' }}
                  onError={(e) => { e.target.onerror = null; e.target.src = defaultImage; }}
                />
              </div>

              {/* Thumbnails */}
              {machine.machine_images && machine.machine_images.length > 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.75rem' }}>
                  {machine.machine_images.map(img => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedImage(img)}
                      style={{
                        padding: 0,
                        background: 'none',
                        border: selectedImage?.id === img.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        aspectRatio: '1',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <img
                        src={img.image_url}
                        alt={img.alt_text}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={(e) => { e.target.onerror = null; e.target.src = defaultImage; }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right – Machine info */}
            <div>
              <h1 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: 1.2 }}>
                {displayMachineName}
              </h1>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                {/* machine.type and machine.year are DB data */}
                {machine.type && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                    <Tag size={16} color="var(--accent-primary)" /> {tDb(machine.type, 'machinery.types')}
                  </div>
                )}
                {machine.year && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                    <Calendar size={16} color="var(--accent-primary)" /> {machine.year}
                  </div>
                )}
              </div>

              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem', fontFamily: 'Outfit, sans-serif' }}>
                {machine.price != null
                  ? `${machine.price.toLocaleString('sv-SE')} kr (exklusive moms)`
                  : t('machineDetail.priceOnRequest')}
              </div>

              {/* Description */}
              {displayMachineDesc && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    {t('machineDetail.description')}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {displayMachineDesc}
                  </p>
                </div>
              )}

              {/* Features */}
              {displayFeatures && displayFeatures.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    {t('machineDetail.features')}
                  </h3>
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {displayFeatures.map((feature, idx) => (
                      <li key={idx} style={{ backgroundColor: 'var(--bg-surface)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9375rem', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Specs – label translated, spec keys/values are DB data */}
              {specsEntries.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    {t('machineDetail.specs')}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {specsEntries.map(([key, value], idx) => (
                      <div key={idx} style={{ display: 'flex', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ flex: '1', color: 'var(--text-secondary)', fontWeight: 500 }}>{key}</span>
                        <span style={{ flex: '1', color: 'var(--text-primary)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
                <button
                  onClick={() => setQuoteModalOpen(true)}
                  className="btn btn-primary"
                  style={{ padding: '1rem', fontSize: '1.125rem', width: '100%' }}
                >
                  {t('machineDetail.contactMachine')}
                </button>
                <a href="tel:+4654525151" className="btn btn-secondary" style={{ padding: '1rem', fontSize: '1.125rem', display: 'flex', justifyContent: 'center' }}>
                  <Phone size={18} /> {t('machineDetail.callSales')}
                </a>
              </div>
            </div>
          </div>

          {/* Similar machines */}
          {similarMachines.length > 0 && (
            <div className="similar-machines-section" style={{ marginTop: '4rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>
                {t('machineDetail.similarMachines')}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {similarMachines.map(m => {
                  let thumbUrl = defaultImage;
                  if (m.machine_images && m.machine_images.length > 0) {
                    const primary = m.machine_images.find(img => img.is_primary);
                    thumbUrl = primary ? primary.image_url : m.machine_images[0].image_url;
                  }
                  const simName = lang === 'en' ? (m.name_en || m.name) : m.name;
                  return (
                    <Link
                      key={m.id}
                      to={`/maskiner/${m.slug}`}
                      style={{
                        display: 'flex',
                        gap: '1rem',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        textDecoration: 'none',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        color: 'inherit',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div style={{ width: '100px', height: '100px', flexShrink: 0, borderRadius: 'var(--radius-sm)', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
                        <img src={thumbUrl} alt={simName} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{tDb(m.type, 'machinery.types')}</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{simName}</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>
                          {m.price != null
                            ? `${m.price.toLocaleString('sv-SE')} kr (exklusive moms)`
                            : t('machineDetail.priceOnRequestShort')}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div> {/* End main content div */}


      <style>{`
        .machine-details-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 3rem;
        }
        @media (min-width: 992px) {
          .machine-details-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', touchAction: 'none' }}
          onClick={() => setLightboxOpen(false)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEndHandler}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '0.5rem', zIndex: 10000 }}
          >
            <X size={32} />
          </button>

          {machine?.machine_images && machine.machine_images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const cur = machine.machine_images.findIndex(img => img.id === selectedImage?.id);
                setSelectedImage(machine.machine_images[(cur - 1 + machine.machine_images.length) % machine.machine_images.length]);
              }}
              style={{ position: 'absolute', left: '1rem', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', zIndex: 10000 }}
            >
              <ChevronLeft size={32} />
            </button>
          )}

          <img
            src={mainImageUrl}
            alt={selectedImage ? selectedImage.alt_text || displayMachineName : displayMachineName}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: 'clamp(400px, 90vh, 1000px)', objectFit: 'contain', display: 'block' }}
            onError={(e) => { e.target.onerror = null; e.target.src = defaultImage; }}
          />

          {machine?.machine_images && machine.machine_images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const cur = machine.machine_images.findIndex(img => img.id === selectedImage?.id);
                setSelectedImage(machine.machine_images[(cur + 1) % machine.machine_images.length]);
              }}
              style={{ position: 'absolute', right: '1rem', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', zIndex: 10000 }}
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>
      )}

      {/* Quote Modal */}
      <QuoteModal
        isOpen={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        machine={machine}
        preselectedType="machine"
      />

      <TransportSection onOpenModal={() => setQuoteModalOpen(true)} />
    </>
  );
};

export default MachineDetailsPage;
