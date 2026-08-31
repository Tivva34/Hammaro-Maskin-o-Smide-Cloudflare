import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';

const InventoryCard = ({ item }) => {
  const { t, lang } = useLang();
  const defaultImage = 'https://placehold.co/800x600/1e2123/a0a6aa?text=Bild+saknas';

  let imageUrl = defaultImage;
  if (item.inventory_images && item.inventory_images.length > 0) {
    const primaryImg = item.inventory_images.find(img => img.is_primary);
    imageUrl = primaryImg ? primaryImg.image_url : item.inventory_images[0].image_url;
  }

  const displayItemName = lang === 'en' ? (item.name_en || item.name) : item.name;
  const displayItemDesc = lang === 'en' ? (item.description_en || item.description) : item.description;

  // Shorten description for card view
  const shortDesc = displayItemDesc 
    ? (displayItemDesc.length > 100 ? displayItemDesc.substring(0, 100) + '...' : displayItemDesc)
    : '';

  return (
    <Link
      to={`/losore/${item.slug || item.id}`}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        transition: 'transform var(--transition-normal), box-shadow var(--transition-normal)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
        const img = e.currentTarget.querySelector('.card-image');
        if (img) img.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        const img = e.currentTarget.querySelector('.card-image');
        if (img) img.style.transform = 'scale(1)';
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', height: '240px', overflow: 'hidden', backgroundColor: '#000' }}>
        <img
          className="card-image"
          src={imageUrl}
          alt={displayItemName}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform var(--transition-slow)' }}
          onError={(e) => { e.target.onerror = null; e.target.src = defaultImage; }}
        />
        {item.price != null && (
          <div style={{
            position: 'absolute',
            bottom: '1rem',
            right: '1rem',
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--text-inverse)',
            padding: '0.4rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 700,
            fontSize: '1.1rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            {item.price.toLocaleString('sv-SE')} kr
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.375rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{displayItemName}</h3>
          <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {shortDesc || t('inventoryDetail.noDesc')}
          </p>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontWeight: '600',
            fontSize: '0.9375rem',
            color: 'var(--text-primary)',
            width: '100%',
          }}>
            {lang === 'en' ? 'View item' : 'Visa lösöre'} <ArrowRight size={18} color="var(--accent-primary)" />
          </div>
        </div>
      </div>
    </Link>
  );
};

export default InventoryCard;
