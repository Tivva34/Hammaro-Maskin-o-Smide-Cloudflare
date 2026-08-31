import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';

const BuySellSection = ({ onOpenModal }) => {
  const { t } = useLang();

  return (
    <section className="section" style={{ padding: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>

        {/* Sälj */}
        <div style={{
          flex: '1 1 50%',
          minWidth: '300px',
          backgroundColor: 'var(--bg-secondary)',
          padding: '6rem 4rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>
            <span className="eyebrow">{t('buySell.sellEyebrow')}</span>
            <h2 style={{ marginBottom: '1.5rem' }}>{t('buySell.sellHeading')}</h2>
            <p style={{ marginBottom: '2.5rem', fontSize: '1.125rem' }}>{t('buySell.sellDesc')}</p>
            {onOpenModal ? (
              <button 
                onClick={onOpenModal} 
                className="btn btn-primary" 
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem' }}
              >
                {t('buySell.sellCta')}
              </button>
            ) : (
              <Link to="/kontakt" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                {t('buySell.sellCta')}
              </Link>
            )}
          </div>
        </div>

        {/* Köp */}
        <div style={{
          flex: '1 1 50%',
          minWidth: '300px',
          backgroundColor: 'var(--bg-surface)',
          padding: '6rem 4rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
            <span className="eyebrow" style={{ color: 'var(--text-secondary)' }}>{t('buySell.buyEyebrow')}</span>
            <h2 style={{ marginBottom: '1.5rem' }}>{t('buySell.buyHeading')}</h2>
            <p style={{ marginBottom: '2.5rem', fontSize: '1.125rem' }}>{t('buySell.buyDesc')}</p>
            <Link to="/maskiner" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              {t('buySell.buyCta')}
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
};

export default BuySellSection;
