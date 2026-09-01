import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Phone } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import ContactModal from './ContactModal';

const Hero = () => {
  const { t } = useLang();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  return (
    <section
      id="home"
      style={{
        position: 'relative',
        minHeight: 'clamp(500px, 100vh, 1000px)',
        display: 'flex',
        alignItems: 'center',
        paddingTop: '80px',
        overflow: 'hidden',
      }}
    >
      {/* Background Image */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: -2,
          backgroundImage: 'url("https://images.unsplash.com/photo-1592837943003-888e2501a351?q=80&w=2070&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Dark Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: -1,
          background: 'linear-gradient(to right, rgba(18,20,21,0.9) 0%, rgba(18,20,21,0.7) 50%, rgba(18,20,21,0.4) 100%)',
        }}
      />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '800px' }}>
          <span className="eyebrow fade-up delay-100">{t('hero.eyebrow')}</span>

          <h1 className="fade-up delay-200" style={{ marginBottom: '1.5rem', color: '#ffffff' }}>
            {t('hero.title1')} <br />
            <span style={{ color: 'var(--accent-primary)' }}>{t('hero.title2')}</span>
          </h1>

          <p className="fade-up delay-300" style={{ fontSize: '1.25rem', marginBottom: '2.5rem', color: 'rgba(255,255,255,0.8)', maxWidth: '600px' }}>
            {t('hero.subtitle')}
          </p>

          <div className="fade-up delay-300" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '4rem' }}>
            <Link to="/maskiner" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              {t('hero.ctaMachines')} <ArrowRight size={18} />
            </Link>
            <button 
              onClick={() => setIsContactModalOpen(true)} 
              className="btn btn-secondary" 
              style={{ cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Phone size={18} /> {t('hero.ctaContact')}
            </button>
          </div>

          {/* Tag row */}
          <div className="hero-tags fade-up delay-300">
            <span>{t('hero.tag1')}</span>
            <span style={{ color: 'var(--accent-primary)' }}>•</span>
            <span>{t('hero.tag2')}</span>
            <span style={{ color: 'var(--accent-primary)' }}>•</span>
            <span>{t('hero.tag3')}</span>
            <span style={{ color: 'var(--accent-primary)' }}>•</span>
            <span>{t('hero.tag4')}</span>
          </div>
        </div>
      </div>

      <ContactModal 
        isOpen={isContactModalOpen} 
        onClose={() => setIsContactModalOpen(false)} 
      />

      <style>{`
        .hero-tags {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 1.5rem;
          font-size: 0.9375rem;
          font-weight: 600;
          color: rgba(255,255,255,0.6);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        @media (max-width: 480px) {
          .hero-tags {
            justify-content: center;
            flex-wrap: nowrap;
            white-space: nowrap;
            font-size: 0.625rem;
            gap: 0.4rem;
            letter-spacing: 0.01em;
          }
        }
        @media (min-width: 481px) and (max-width: 767px) {
          .hero-tags {
            font-size: 0.75rem;
            gap: 0.75rem;
          }
        }
      `}</style>
    </section>
  );
};

export default Hero;
