import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';

const MachineryCard = ({ machine }) => {
  const { t, tDb, lang } = useLang();
  const defaultImage = 'https://placehold.co/800x600/1e2123/a0a6aa?text=Bild+saknas';

  let imageUrl = defaultImage;
  if (machine.machine_images && machine.machine_images.length > 0) {
    const primaryImg = machine.machine_images.find(img => img.is_primary);
    imageUrl = primaryImg ? primaryImg.image_url : machine.machine_images[0].image_url;
  }

  const displayMachineName = lang === 'en' ? (machine.name_en || machine.name) : machine.name;
  const displayFeatures = lang === 'en' ? (machine.features_en && machine.features_en.length > 0 ? machine.features_en : machine.features) : machine.features;

  return (
    <Link
      to={`/maskiner/${machine.slug}`}
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
        const img = e.currentTarget.querySelector('img');
        if (img) img.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        const img = e.currentTarget.querySelector('img');
        if (img) img.style.transform = 'scale(1)';
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', height: '240px', overflow: 'hidden', backgroundColor: '#000' }}>
        <img
          src={imageUrl}
          alt={displayMachineName}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform var(--transition-slow)' }}
          onError={(e) => { e.target.onerror = null; e.target.src = defaultImage; }}
        />
        {machine.price != null && (
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
            {machine.price.toLocaleString('sv-SE')} kr
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.375rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{displayMachineName}</h3>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            {tDb(machine.type, 'machinery.types')}
            {machine.year ? ` • ${machine.year}` : ''}
          </p>
        </div>

        {displayFeatures && displayFeatures.length > 0 && (
          <ul style={{
            listStyle: 'none',
            marginBottom: '1.5rem',
            padding: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}>
            {displayFeatures.slice(0, 6).map((feature, idx) => (
              <li key={idx} style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
              }}>
                {feature}
              </li>
            ))}
          </ul>
        )}

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
            {t('machinery.viewMachine')} <ArrowRight size={18} color="var(--accent-primary)" />
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MachineryCard;
