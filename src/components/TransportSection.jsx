import React from 'react';
import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';

const TransportSection = ({ onOpenModal }) => {
  const { t } = useLang();

  return (
    <section className="section" style={{ backgroundColor: 'var(--accent-primary)', color: '#000', padding: '4rem 0' }}>
      <div className="container">
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: '1.5rem',
        }}>
          {/* Ikon */}
          <div style={{ backgroundColor: '#000', color: 'var(--accent-primary)', padding: '1rem', borderRadius: '50%', flexShrink: 0, alignSelf: 'center' }}>
            <Truck size={32} />
          </div>

          {/* Text och knapp */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.5rem',
            flex: 1
          }}>
            <div style={{ flex: '1 1 300px' }}>
              <h2 style={{ margin: 0, fontSize: '2rem', color: '#000' }}>{t('transport.heading')}</h2>
              <p style={{ margin: 0, fontSize: '1.125rem', color: 'rgba(0,0,0,0.8)', marginTop: '0.5rem', maxWidth: '500px' }}>
                {t('transport.desc')}
              </p>
            </div>

            <div style={{ flexShrink: 0 }}>
              {onOpenModal ? (
                <button 
                  onClick={onOpenModal} 
                  className="btn" 
                  style={{
                    backgroundColor: '#000',
                    color: 'var(--accent-primary)',
                    padding: '1rem 2rem',
                    fontSize: '1.125rem',
                    textDecoration: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t('transport.cta')}
                </button>
              ) : (
                <Link to="/kontakt" className="btn" style={{
                  backgroundColor: '#000',
                  color: 'var(--accent-primary)',
                  padding: '1rem 2rem',
                  fontSize: '1.125rem',
                  textDecoration: 'none',
                }}>
                  {t('transport.cta')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TransportSection;
