import React from 'react';
import { Link } from 'react-router-dom';
import { companyInfo } from '../data/company';
import { useLang } from '../contexts/LanguageContext';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { t } = useLang();

  return (
    <footer style={{ backgroundColor: 'var(--bg-tertiary)', paddingTop: '6rem', paddingBottom: '2rem', borderTop: '1px solid var(--border-color)' }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'clamp(2rem, 5vw, 4rem)',
          marginBottom: '4rem',
        }}>

          {/* Brand */}
          <div style={{ gridColumn: '1 / -1', maxWidth: '300px' }}>
            <Link to="/" style={{ display: 'flex', flexDirection: 'column', fontWeight: '800', fontFamily: 'Outfit, sans-serif', lineHeight: '1', fontSize: '1.5rem', marginBottom: '1.5rem', textDecoration: 'none', color: 'inherit' }}>
              <span>HAMMARÖ</span>
              <span style={{ color: 'var(--accent-primary)' }}>MASKIN &amp; SMIDE</span>
            </Link>
            <p style={{ color: 'var(--text-primary)' }}>{t('footer.tagline')}</p>
          </div>

          {/* Nav links */}
          <div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem', fontSize: '1.125rem', fontWeight: 700 }}>
              {t('footer.links')}
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li><Link to="/"         style={linkStyle}>{t('nav.home')}</Link></li>
              <li><Link to="/maskiner" style={linkStyle}>{t('nav.machines')}</Link></li>
              <li><Link to="/verkstad" style={linkStyle}>{t('nav.workshop')}</Link></li>
              <li><Link to="/om-oss"   style={linkStyle}>{t('nav.about')}</Link></li>
              <li><Link to="/kontakt"  style={linkStyle}>{t('nav.contact')}</Link></li>
            </ul>
          </div>

          {/* Contact info */}
          <div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem', fontSize: '1.125rem', fontWeight: 700 }}>
              {t('footer.contact')}
            </h3>
            <address style={{ fontStyle: 'normal', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span>{companyInfo.address.street}<br />{companyInfo.address.zip} {companyInfo.address.city}</span>
              <a href={companyInfo.contact.phoneLink} style={{ color: 'var(--text-secondary)' }}>{companyInfo.contact.phone}</a>
            </address>
          </div>

          {/* Actions */}
          <div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem', fontSize: '1.125rem', fontWeight: 700 }}>
              {t('footer.actions')}
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li><a href={companyInfo.contact.phoneLink} style={{ color: 'var(--accent-primary)' }}>{t('footer.call')}</a></li>
              <li><Link to="/maskiner" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>{t('footer.viewMachines')}</Link></li>
              <li><Link to="/kontakt"  style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>{t('footer.contactUs')}</Link></li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.875rem',
          color: 'var(--text-primary)',
        }}>
          <span>&copy; {currentYear} {companyInfo.name}. {t('footer.rights')}</span>
          <span>Redesign Concept Demo</span>
        </div>
      </div>
    </footer>
  );
};

const linkStyle = { color: 'var(--text-secondary)', textDecoration: 'none' };

export default Footer;
