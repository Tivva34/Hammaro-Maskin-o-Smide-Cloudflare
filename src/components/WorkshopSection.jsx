import React from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Hammer, Settings } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';

const WorkshopSection = ({ onOpenModal }) => {
  const { t } = useLang();

  const services = [
    {
      icon: <Wrench size={32} color="var(--accent-primary)" />,
      title: t('workshop.service1Title'),
      desc: t('workshop.service1Desc'),
    },
    {
      icon: <Settings size={32} color="var(--accent-primary)" />,
      title: t('workshop.service2Title'),
      desc: t('workshop.service2Desc'),
    },
    {
      icon: <Hammer size={32} color="var(--accent-primary)" />,
      title: t('workshop.service3Title'),
      desc: t('workshop.service3Desc'),
    },
  ];

  return (
    <section id="verkstad" className="section" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
      <div className="container">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginBottom: '5rem',
        }}>
          <span className="eyebrow">{t('workshop.eyebrow')}</span>
          <h2 style={{ maxWidth: '800px', marginBottom: '1.5rem' }}>{t('workshop.heading')}</h2>
          <p style={{ maxWidth: '600px', fontSize: '1.25rem', margin: 0 }}>{t('workshop.desc')}</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
          marginBottom: '4rem',
        }}>
          {services.map((service, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-lg)',
                padding: '3rem 2rem',
                border: '1px solid var(--border-color)',
                transition: 'transform var(--transition-normal)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-8px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ marginBottom: '1.5rem' }}>{service.icon}</div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>{service.title}</h3>
              <p style={{ margin: 0 }}>{service.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          {onOpenModal ? (
            <button 
              onClick={onOpenModal} 
              className="btn btn-primary" 
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem' }}
            >
              {t('workshop.cta')}
            </button>
          ) : (
            <Link to="/kontakt" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              {t('workshop.cta')}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

export default WorkshopSection;
