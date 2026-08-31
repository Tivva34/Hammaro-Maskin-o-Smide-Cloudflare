import React from 'react';
import { companyInfo } from '../data/company';
import { useLang } from '../contexts/LanguageContext';

const BrandsSection = () => {
  const { t } = useLang();

  return (
    <section className="section" style={{ borderBottom: '1px solid var(--border-color)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span className="eyebrow">{t('brands.eyebrow')}</span>
          <h2>{t('brands.heading')}</h2>
        </div>

        {/* Brand names are proper nouns – not translated */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '2rem 4rem',
          opacity: 0.7,
        }}>
          {companyInfo.brands.map((brand, idx) => (
            <div
              key={idx}
              style={{
                fontSize: '1.5rem',
                fontWeight: '800',
                fontFamily: 'Outfit, sans-serif',
                letterSpacing: '0.05em',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '80px',
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              {brand}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrandsSection;
