import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';

const ManufacturingSection = ({ onOpenModal }) => {
  const { t } = useLang();

  return (
    <section className="section" style={{ padding: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: '600px' }}>

        {/* Image Side */}
        <div style={{
          flex: '1 1 50%',
          minWidth: '300px',
          backgroundImage: 'url("https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=2070&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: '400px',
        }} />

        {/* Content Side */}
        <div style={{
          flex: '1 1 50%',
          minWidth: '300px',
          backgroundColor: 'var(--bg-secondary)',
          padding: '6rem 4rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <div style={{ maxWidth: '480px' }}>
            <span className="eyebrow">{t('manufacturing.eyebrow')}</span>
            <h2 style={{ marginBottom: '1.5rem' }}>{t('manufacturing.heading')}</h2>
            <p style={{ marginBottom: '2.5rem', fontSize: '1.125rem' }}>{t('manufacturing.desc')}</p>
            
            {onOpenModal ? (
              <button 
                onClick={onOpenModal} 
                className="btn btn-primary" 
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem' }}
              >
                {t('manufacturing.cta')}
              </button>
            ) : (
              <Link to="/kontakt" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                {t('manufacturing.cta')}
              </Link>
            )}
          </div>
        </div>

      </div>
    </section>
  );
};

export default ManufacturingSection;
