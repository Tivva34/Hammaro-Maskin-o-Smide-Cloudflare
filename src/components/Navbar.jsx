import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { companyInfo } from '../data/company';
import { useLang } from '../contexts/LanguageContext';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });
  const location = useLocation();
  const { lang, setLang, t } = useLang();

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when menu is open – without layout shift
  useEffect(() => {
    if (mobileMenuOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
      }
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const toggleTheme = () => {
    const newTheme = !isLightMode;
    setIsLightMode(newTheme);
    const themeString = newTheme ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', themeString);
    localStorage.setItem('theme', themeString);
    
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', newTheme ? '#ffffff' : '#1e2123');
    }
  };

  const navLinks = [
    { name: t('nav.home'), to: '/' },
    { name: t('nav.machines'), to: '/maskiner' },
    { name: t('nav.inventory'), to: '/losore' },
    { name: t('nav.workshop'), to: '/verkstad' },
    { name: t('nav.about'), to: '/om-oss' },
    { name: t('nav.contact'), to: '/kontakt' },
  ];

  const closeMenu = () => setMobileMenuOpen(false);
  const toggleMenu = () => setMobileMenuOpen(prev => !prev);

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  /* ── Language switcher button ─────────────────────────────── */
  const LangSwitch = ({ mobile = false }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: mobile ? '1.1rem' : '1rem',
    }}>
      <button
        onClick={() => setLang('sv')}
        aria-label="Svenska"
        title="Svenska"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.25rem 0',
          borderRadius: 'var(--radius-sm)',
          opacity: lang === 'sv' ? 1 : 0.5,
          transition: 'opacity var(--transition-fast)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 10" width="22" style={{ borderRadius: '2px', display: 'block', boxShadow: '0 0 2px rgba(0,0,0,0.3)' }}>
          <title>SE</title>
          <rect width="16" height="10" fill="#005293" />
          <rect x="5" width="2" height="10" fill="#fecb00" />
          <rect y="4" width="16" height="2" fill="#fecb00" />
        </svg>
      </button>
      <span style={{ color: 'var(--border-color)', userSelect: 'none', lineHeight: 1 }}>|</span>
      <button
        onClick={() => setLang('en')}
        aria-label="English"
        title="English"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.25rem 0',
          borderRadius: 'var(--radius-sm)',
          opacity: lang === 'en' ? 1 : 0.5,
          transition: 'opacity var(--transition-fast)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" width="22" style={{ borderRadius: '2px', display: 'block', boxShadow: '0 0 2px rgba(0,0,0,0.3)' }}>
          <title>EN</title>
          <rect width="60" height="30" fill="#012169"/>
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4"/>
          <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10"/>
          <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6"/>
        </svg>
      </button>
    </div>
  );

  return (
    <>
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <header className={`site-header${isScrolled ? ' site-header--scrolled' : ''}`}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

          {/* Logo */}
          <Link
            to="/"
            onClick={closeMenu}
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontWeight: '800',
              fontFamily: 'Outfit, sans-serif',
              lineHeight: '1',
              fontSize: '1.25rem',
              textDecoration: 'none',
            }}
          >
            <span style={{ color: 'var(--text-primary)' }}>HAMMARÖ</span>
            <span style={{ color: 'var(--accent-primary)' }}>MASKIN &amp; SMIDE</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="desktop-nav" aria-label="Primär navigation">
            <ul style={{ display: 'flex', gap: '2rem', listStyle: 'none', margin: 0, padding: 0 }}>
              {navLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    style={{
                      fontSize: '0.9375rem',
                      fontWeight: '500',
                      color: isActive(link.to) ? 'var(--text-primary)' : 'var(--text-secondary)',
                      textDecoration: 'none',
                      borderBottom: isActive(link.to) ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      paddingBottom: '2px',
                      transition: 'color 0.2s, border-color 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = isActive(link.to) ? 'var(--text-primary)' : 'var(--text-secondary)'; }}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Right-side controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>

            {/* Language switcher – desktop */}
            <div className="desktop-nav">
              <LangSwitch />
            </div>

            {/* Theme toggle – always visible */}
            <button
              onClick={toggleTheme}
              aria-label={t('nav.toggleTheme')}
              style={{
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '44px',
                minHeight: '44px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {isLightMode ? <Moon size={22} /> : <Sun size={22} />}
            </button>

            {/* Desktop CTA */}
            <Link
              to="/kontakt"
              className="btn btn-primary desktop-cta"
              style={{ textDecoration: 'none' }}
            >
              {t('nav.contactCta')}
            </Link>

            {/* Hamburger / Close – mobile only */}
            <button
              className="mobile-toggle"
              onClick={toggleMenu}
              aria-label={mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              style={{
                color: 'var(--text-primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '44px',
                minHeight: '44px',
                borderRadius: '6px',
                transition: 'background 0.2s',
              }}
            >
              {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── MOBILE MENU OVERLAY ─────────────────────────────────── */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Mobilmeny"
        aria-hidden={!mobileMenuOpen}
        className="mobile-menu-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          backgroundColor: 'var(--bg-primary)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(100%)',
          opacity: mobileMenuOpen ? 1 : 0,
          visibility: mobileMenuOpen ? 'visible' : 'hidden',
          transition: 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.32s',
          pointerEvents: mobileMenuOpen ? 'auto' : 'none',
        }}
      >
        {/* Top bar inside overlay */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          <span style={{
            display: 'flex',
            flexDirection: 'column',
            fontWeight: '800',
            fontFamily: 'Outfit, sans-serif',
            lineHeight: '1',
            fontSize: '1.1rem',
          }}>
            <span style={{ color: 'var(--text-primary)' }}>HAMMARÖ</span>
            <span style={{ color: 'var(--accent-primary)' }}>MASKIN &amp; SMIDE</span>
          </span>

          <button
            onClick={closeMenu}
            aria-label={t('nav.closeMenu')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '48px',
              minHeight: '48px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'background 0.2s, border-color 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.borderColor = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Nav links */}
        <nav aria-label="Mobilnavigation" style={{ flex: 1, padding: '1rem 1.5rem' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {navLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  onClick={closeMenu}
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    fontFamily: 'Outfit, sans-serif',
                    color: isActive(link.to) ? 'var(--accent-primary)' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    textDecoration: 'none',
                    padding: '1rem 0',
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'color 0.2s',
                  }}
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* CTA buttons + language + theme */}
        <div style={{
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          borderTop: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          <Link
            to="/kontakt"
            onClick={closeMenu}
            className="btn btn-primary"
            style={{ width: '100%', textDecoration: 'none', textAlign: 'center' }}
          >
            {t('nav.contactCta')}
          </Link>
          <a
            href={companyInfo.contact.phoneLink}
            className="btn btn-secondary"
            style={{ width: '100%', textAlign: 'center' }}
          >
            {t('nav.callDirect')}
          </a>

          {/* Language switcher – mobile */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <LangSwitch mobile />
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={t('nav.toggleTheme')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
            }}
          >
            {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
            <span>{isLightMode ? t('nav.darkMode') : t('nav.lightMode')}</span>
          </button>
        </div>
      </div>

      {/* ── Styles ─────────────────────────────────────────────── */}
      <style>{`
        .site-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          padding-top: 1.5rem;
          padding-bottom: 1.5rem;
          background-color: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
          transition: padding 0.3s cubic-bezier(0.4,0,0.2,1),
                      box-shadow 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        .site-header--scrolled {
          padding-top: 1rem;
          padding-bottom: 1rem;
          box-shadow: var(--shadow-subtle);
        }

        /* --- Desktop --- */
        @media (min-width: 1024px) {
          .desktop-nav  { display: block !important; }
          .desktop-cta  { display: inline-flex !important; }
          .mobile-toggle { display: none !important; }
          .mobile-menu-overlay { display: none !important; }
        }

        /* --- Mobile --- */
        @media (max-width: 1023px) {
          .desktop-nav  { display: none !important; }
          .desktop-cta  { display: none !important; }
          .mobile-toggle { display: flex !important; }
        }
      `}</style>
    </>
  );
};

export default Navbar;
