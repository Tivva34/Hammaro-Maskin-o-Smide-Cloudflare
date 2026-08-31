import React from 'react';
import { Settings, Tractor, MapPin } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';

const TrustSection = () => {
  const { t } = useLang();

  const stats = [
    {
      icon: <Settings size={32} color="var(--accent-primary)" />,
      title: t('trust.stat1Title'),
      desc: t('trust.stat1Desc'),
    },
    {
      icon: <Tractor size={32} color="var(--accent-primary)" />,
      title: t('trust.stat2Title'),
      desc: t('trust.stat2Desc'),
    },
    {
      icon: <MapPin size={32} color="var(--accent-primary)" />,
      title: t('trust.stat3Title'),
      desc: t('trust.stat3Desc'),
    },
  ];

  return (
    <section className="section" style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
      <div className="container">
        <div style={{ maxWidth: '800px', marginBottom: '4rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>{t('trust.heading')}</h2>
          <p style={{ fontSize: '1.25rem' }}>{t('trust.desc')}</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem',
        }}>
          {stats.map((stat, i) => (
            <div
              key={i}
              style={{
                backgroundColor: 'var(--bg-surface)',
                padding: '2.5rem 2rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                transition: 'transform var(--transition-normal), box-shadow var(--transition-normal)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-subtle)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{
                backgroundColor: 'rgba(230, 161, 37, 0.1)',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {stat.icon}
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>{stat.title}</h3>
                <p style={{ margin: 0, fontSize: '1rem' }}>{stat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
