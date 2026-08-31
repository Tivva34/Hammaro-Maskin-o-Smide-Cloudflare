import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, X, ChevronLeft, Image as ImageIcon, Phone } from 'lucide-react';
import { getInventoryItemBySlugOrId, getSimilarInventoryItems } from '../lib/inventoryService';
import { useLang } from '../contexts/LanguageContext';
import QuoteModal from '../components/QuoteModal';

const InventoryDetailsPage = () => {
  const { slug: identifier } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [similarItems, setSimilarItems] = useState([]);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const { t, lang } = useLang();

  // Arrow keys & escape for lightbox
  const handleKeyDown = useCallback((e) => {
    if (!lightboxOpen) return;
    if (e.key === 'Escape') {
      setLightboxOpen(false);
    } else if (item?.inventory_images && item.inventory_images.length > 1) {
      const currentIndex = item.inventory_images.findIndex(img => img.id === selectedImage?.id);
      if (e.key === 'ArrowRight') {
        setSelectedImage(item.inventory_images[(currentIndex + 1) % item.inventory_images.length]);
      } else if (e.key === 'ArrowLeft') {
        setSelectedImage(item.inventory_images[(currentIndex - 1 + item.inventory_images.length) % item.inventory_images.length]);
      }
    }
  }, [lightboxOpen, item, selectedImage]);

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
    const fetchItem = async () => {
      setLoading(true);
      setError('');
      const { data, error: err } = await getInventoryItemBySlugOrId(identifier);
      
      // Ensure only published items are viewable on the public route
      if (err || !data || data.status !== 'published') {
        setError(t('inventoryDetail.errorDefault') || 'Objektet kunde inte hittas.');
      } else {
        // Redirect to slug URL if loaded via UUID (Backwards compatibility)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
        if (isUuid && data.slug) {
          navigate(`/losore/${data.slug}`, { replace: true });
          return;
        }

        setItem(data);
        if (data.inventory_images && data.inventory_images.length > 0) {
          const primaryImg = data.inventory_images.find(img => img.is_primary);
          setSelectedImage(primaryImg || data.inventory_images[0]);
        }
        const displayName = lang === 'en' ? (data.name_en || data.name) : data.name;
        document.title = `${displayName} | Hammarö Maskin & Smide`;
        
        if (data.category) {
          const { data: similarData } = await getSimilarInventoryItems(data.id, data.category, 3);
          if (similarData) setSimilarItems(similarData);
        }
      }
      setLoading(false);
    };
    fetchItem();
    
    return () => {
      document.title = 'Hammarö Maskin & Smide';
    };
  }, [identifier, t, lang, navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: 'clamp(400px, 60vh, 800px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '1rem' }} />
        <span style={{ fontSize: '1.125rem' }}>{t('inventoryDetail.loading')}</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{t('inventoryDetail.errorTitle')}</h1>
        <p style={{ fontSize: '1.125rem', marginBottom: '2rem', color: 'var(--text-secondary)' }}>{error}</p>
        <Link to="/losore" className="btn btn-primary">
          {t('inventoryDetail.backToInventory')}
        </Link>
      </div>
    );
  }

  const defaultImage = 'https://placehold.co/800x600/1e2123/a0a6aa?text=Bild+saknas';
  const mainImageUrl = selectedImage ? selectedImage.image_url : defaultImage;

  const displayItemName = lang === 'en' ? (item.name_en || item.name) : item.name;
  const displayItemDesc = lang === 'en' ? (item.description_en || item.description) : item.description;

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
      if (item?.inventory_images && item.inventory_images.length > 1) {
        const cur = item.inventory_images.findIndex(img => img.id === selectedImage?.id);
        if (distanceX > 0) {
          // Swipe left -> next image
          if (cur < item.inventory_images.length - 1) {
            setSelectedImage(item.inventory_images[cur + 1]);
          }
        } else {
          // Swipe right -> prev image
          if (cur > 0) {
            setSelectedImage(item.inventory_images[cur - 1]);
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
            <Link to="/" style={{ color: 'var(--text-muted)' }}>{t('nav.home')}</Link>
            <ChevronRight size={14} />
            <Link to="/losore" style={{ color: 'var(--text-muted)' }}>{t('nav.inventory')}</Link>
            <ChevronRight size={14} />
            <span style={{ color: 'var(--text-primary)' }}>{displayItemName}</span>
          </div>
        </div>
      </div>

      <div className="container" style={{ marginTop: '3rem' }}>
        <Link to="/losore" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9375rem', fontWeight: 500 }}>
          <ArrowLeft size={16} /> {t('inventoryDetail.back')}
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
                alt={selectedImage ? selectedImage.alt_text || displayItemName : displayItemName}
                style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', padding: '1rem' }}
                onError={(e) => { e.target.onerror = null; e.target.src = defaultImage; }}
              />
            </div>

            {/* Thumbnails */}
            {item.inventory_images && item.inventory_images.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.75rem' }}>
                {item.inventory_images.map(img => (
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

          {/* Right – Info */}
          <div>
            <h1 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: 1.2 }}>
              {displayItemName}
            </h1>

            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem', fontFamily: 'Outfit, sans-serif' }}>
              {item.price != null
                ? `${item.price.toLocaleString('sv-SE')} kr (exklusive moms)`
                : t('inventoryDetail.priceOnRequest')}
            </div>

            {displayItemDesc && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  {t('inventoryDetail.description')}
                </h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {displayItemDesc}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
              <button 
                onClick={() => setQuoteModalOpen(true)} 
                className="btn btn-primary" 
                style={{ padding: '1rem', fontSize: '1.125rem', width: '100%' }}
              >
                {t('inventoryDetail.contactItem')}
              </button>
              <a href="tel:+4654525151" className="btn btn-secondary" style={{ padding: '1rem', fontSize: '1.125rem', display: 'flex', justifyContent: 'center' }}>
                <Phone size={18} /> {t('machineDetail.callSales')}
              </a>
            </div>
          </div>
        </div>

        {/* Similar inventory items */}
        {similarItems.length > 0 && (
          <div className="similar-machines-section" style={{ marginTop: '4rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Liknande lösöre
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {similarItems.map(m => {
                let thumbUrl = defaultImage;
                if (m.inventory_images && m.inventory_images.length > 0) {
                  const primary = m.inventory_images.find(img => img.is_primary);
                  thumbUrl = primary ? primary.image_url : m.inventory_images[0].image_url;
                }
                const simName = lang === 'en' ? (m.name_en || m.name) : m.name;
                return (
                  <Link
                    key={m.id}
                    to={`/losore/${m.slug || m.id}`}
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
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        {t(`inventory.categories.${m.category}`)}
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{simName}</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>
                        {m.price != null
                          ? `${m.price.toLocaleString('sv-SE')} kr (exklusive moms)`
                          : t('inventoryDetail.priceOnRequest')}
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

          {item?.inventory_images && item.inventory_images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const cur = item.inventory_images.findIndex(img => img.id === selectedImage?.id);
                setSelectedImage(item.inventory_images[(cur - 1 + item.inventory_images.length) % item.inventory_images.length]);
              }}
              style={{ position: 'absolute', left: '1rem', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', zIndex: 10000 }}
            >
              <ChevronLeft size={32} />
            </button>
          )}

          <img
            src={mainImageUrl}
            alt={selectedImage ? selectedImage.alt_text || displayItemName : displayItemName}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: 'clamp(400px, 90vh, 1000px)', objectFit: 'contain', display: 'block' }}
            onError={(e) => { e.target.onerror = null; e.target.src = defaultImage; }}
          />

          {item?.inventory_images && item.inventory_images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const cur = item.inventory_images.findIndex(img => img.id === selectedImage?.id);
                setSelectedImage(item.inventory_images[(cur + 1) % item.inventory_images.length]);
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
        inventoryItem={item} 
        preselectedType="inventory"
      />
    </>
  );
};

export default InventoryDetailsPage;
