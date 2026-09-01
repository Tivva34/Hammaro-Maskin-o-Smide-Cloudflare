import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Tractor, Hammer } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import ContactModal from '../components/ContactModal';

/* ─────────────────────────────────────────────────────────────
   Om Hammarö Maskin & Smide – /om-oss
   ───────────────────────────────────────────────────────────── */

const AboutPage = () => {
  const { t } = useLang();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactModalSubject, setContactModalSubject] = useState('');

  useEffect(() => {
    document.title = 'Om oss | Hammarö Maskin & Smide';
    return () => { document.title = 'Hammarö Maskin & Smide'; };
  }, []);

  return (
    <>
      {/* ── 1. Hero ─────────────────────────────────────────────── */}
      <section
        className="section about-hero-section"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div className="container">
          <div className="about-hero-inner">

            {/* Text */}
            <div className="about-hero-text">
              <span className="eyebrow fade-up">{t('about.eyebrow')}</span>
              <h1 className="fade-up delay-100" style={{ marginBottom: '1.5rem' }}>
                <span style={{ color: 'var(--text-primary)' }}>{t('about.nameRow1')}</span>
                <br />
                <span style={{ color: 'var(--accent-primary)' }}>{t('about.nameRow2')}</span>
              </h1>
              <p
                className="fade-up delay-200"
                style={{ fontSize: '1.2rem', lineHeight: '1.7', marginBottom: '2.5rem' }}
              >
                {t('about.intro')}
              </p>
              <div className="fade-up delay-200" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                <button 
                  onClick={() => { setContactModalSubject(''); setIsContactModalOpen(true); }} 
                  className="btn btn-primary" 
                  style={{ textDecoration: 'none', cursor: 'pointer', border: 'none', fontFamily: 'inherit', fontSize: '1rem' }}
                >
                  {t('about.ctaContact')} <ArrowRight size={18} />
                </button>
                <Link to="/maskiner" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                  {t('about.ctaMachines')}
                </Link>
              </div>
            </div>

            {/* Logo */}
            <div className="about-hero-logo fade-up delay-300">
              <div className="about-hero-logo-wrap">
                <img
                  src={`${import.meta.env.BASE_URL}images/logo.gif`}
                  alt="Hammarö Maskin och Smide – logotyp"
                  style={{ width: '100%', maxWidth: '100%', height: 'auto', objectFit: 'contain' }}
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 2. Familjeföretaget ─────────────────────────────────── */}
      <section className="section" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="container">
          <div style={{ maxWidth: '720px' }}>
            <span className="eyebrow fade-up">{t('about.familyEyebrow')}</span>
            <h2 className="fade-up delay-100" style={{ marginBottom: '1.5rem' }}>
              {t('about.familyHeading')}
            </h2>
            <p className="fade-up delay-100" style={{ fontSize: '1.125rem', lineHeight: '1.75' }}>
              {t('about.familyP1')}
            </p>
            <p className="fade-up delay-200" style={{ fontSize: '1.125rem', lineHeight: '1.75' }}>
              {t('about.familyP2')}
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. Vad vi gör ───────────────────────────────────────── */}
      <section className="section" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        <div className="container">
          <span className="eyebrow fade-up" style={{ display: 'block', marginBottom: '0.75rem' }}>
            {t('about.whatEyebrow')}
          </span>
          <h2 className="fade-up delay-100" style={{ marginBottom: '3rem', maxWidth: '480px' }}>
            {t('about.whatHeading')}
          </h2>

          <div className="about-cards">

            {/* Maskiner */}
            <div className="about-card fade-up delay-100">
              <div className="about-card-icon">
                <Tractor size={36} color="var(--accent-primary)" strokeWidth={1.5} />
              </div>
              <h3 style={{ fontSize: '1.375rem', marginBottom: '0.875rem', color: 'var(--text-primary)' }}>
                {t('about.machinesTitle')}
              </h3>
              <p style={{ flexGrow: 1 }}>{t('about.machinesDesc')}</p>
              <Link
                to="/maskiner"
                className="btn btn-secondary"
                style={{ textDecoration: 'none', marginTop: '1.5rem', alignSelf: 'flex-start' }}
              >
                {t('about.machinesCta')}
              </Link>
            </div>

            {/* Smide */}
            <div className="about-card fade-up delay-200">
              <div className="about-card-icon">
                <Hammer size={36} color="var(--accent-primary)" strokeWidth={1.5} />
              </div>
              <h3 style={{ fontSize: '1.375rem', marginBottom: '0.875rem', color: 'var(--text-primary)' }}>
                {t('about.smideTitle')}
              </h3>
              <p style={{ flexGrow: 1 }}>{t('about.smideDesc')}</p>
              <button
                onClick={() => { setContactModalSubject('manufacturing'); setIsContactModalOpen(true); }}
                className="btn btn-secondary"
                style={{ textDecoration: 'none', marginTop: '1.5rem', alignSelf: 'flex-start', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem' }}
              >
                {t('about.smideCta')}
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* ── 4. Avslutande CTA ───────────────────────────────────── */}
      <section
        className="section"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
        }}
      >
        <div className="container">
          <div className="about-cta fade-up">
            <div className="about-cta-text">
              <h2 style={{ marginBottom: '1rem' }}>{t('about.ctaHeading')}</h2>
              <p style={{ maxWidth: '520px', marginBottom: 0 }}>{t('about.ctaDesc')}</p>
            </div>
            <div className="about-cta-buttons">
              <button 
                onClick={() => { setContactModalSubject('buy'); setIsContactModalOpen(true); }} 
                className="btn btn-primary" 
                style={{ textDecoration: 'none', cursor: 'pointer', border: 'none', fontFamily: 'inherit', fontSize: '1rem' }}
              >
                {t('about.ctaContact2')} <ArrowRight size={18} />
              </button>
              <Link to="/maskiner" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                {t('about.ctaMachines2')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ContactModal 
        isOpen={isContactModalOpen} 
        onClose={() => setIsContactModalOpen(false)} 
        subject={contactModalSubject}
      />

      {/* ── Styles ──────────────────────────────────────────────── */}
      <style>{`
        .about-hero-section {
          padding-top: 3rem !important;
        }
        @media (min-width: 768px) {
          .about-hero-section {
            padding-top: 4rem !important;
          }
        }
        .about-hero-inner {
          display: grid;
          grid-template-columns: 1fr;
          gap: 3rem;
          align-items: center;
        }
        @media (min-width: 1024px) {
          .about-hero-inner {
            grid-template-columns: 1.2fr 1fr;
            gap: 5rem;
          }
        }
        .about-hero-text { max-width: 640px; }
        .about-hero-logo {
          display: flex;
          justify-content: center;
        }
        .about-hero-logo-wrap {
          background-color: #ffffff;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          padding: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 480px;
          box-shadow: var(--shadow-subtle);
        }
        .about-cards {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }
        @media (min-width: 768px) {
          .about-cards { grid-template-columns: 1fr 1fr; }
        }
        .about-card {
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 2.5rem;
          display: flex;
          flex-direction: column;
          transition: transform var(--transition-normal), box-shadow var(--transition-normal);
        }
        .about-card:hover {
          transform: translateY(-6px);
          box-shadow: var(--shadow-hover);
        }
        .about-card-icon {
          margin-bottom: 1.5rem;
          width: 64px;
          height: 64px;
          background-color: var(--bg-tertiary);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-color);
        }
        .about-cta {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          align-items: flex-start;
        }
        @media (min-width: 768px) {
          .about-cta {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }
        .about-cta-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          flex-shrink: 0;
        }
      `}</style>
    </>
  );
};

export default AboutPage;
