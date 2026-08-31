import React from 'react';
import { Phone, MapPin } from 'lucide-react';
import ContactForm from './ContactForm';
import { companyInfo } from '../data/company';
import { useLang } from '../contexts/LanguageContext';

const ContactSection = () => {
  const { t } = useLang();

  return (
    <section id="kontakt" className="section" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="eyebrow">{t('contact.eyebrow')}</span>
          <h2>{t('contact.heading')}</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4rem' }} className="contact-grid">

          {/* Contact Info */}
          <div>
            <div style={{ display: 'grid', gap: '2rem', marginBottom: '3rem' }}>

              {/* Sales */}
              <div style={cardStyle}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  {t('contact.sales')}
                </h3>
                <p style={{ fontSize: '1.125rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                  {companyInfo.contact.sales.name} <br />
                  <span style={{ color: 'var(--text-secondary)' }}>{companyInfo.contact.sales.phone}</span>
                </p>
                <a href={companyInfo.contact.sales.phoneLink} className="btn btn-secondary" style={{ width: '100%' }}>
                  <Phone size={18} /> {t('contact.call')} {companyInfo.contact.sales.name}
                </a>
              </div>

              {/* Repair */}
              <div style={cardStyle}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  {t('contact.repair')}
                </h3>
                <p style={{ fontSize: '1.125rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                  {companyInfo.contact.repair.name} <br />
                  <span style={{ color: 'var(--text-secondary)' }}>{companyInfo.contact.repair.phone}</span>
                </p>
                <a href={companyInfo.contact.repair.phoneLink} className="btn btn-secondary" style={{ width: '100%' }}>
                  <Phone size={18} /> {t('contact.call')} {companyInfo.contact.repair.name}
                </a>
              </div>
            </div>

            {/* Address */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <MapPin size={24} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '0.25rem' }} />
              <div>
                <h4 style={{ fontSize: '1.125rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  {companyInfo.name}
                </h4>
                <p style={{ margin: 0 }}>
                  {companyInfo.address.street}<br />
                  {companyInfo.address.zip} {companyInfo.address.city}
                </p>
                <a
                  href={companyInfo.contact.phoneLink}
                  style={{ display: 'inline-block', marginTop: '1rem', fontWeight: '600' }}
                >
                  {t('contact.exchange')}: {companyInfo.contact.phone}
                </a>
              </div>
            </div>
          </div>

          {/* Form */}
          <div>
            <ContactForm />
          </div>

        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .contact-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </section>
  );
};

const cardStyle = {
  backgroundColor: 'var(--bg-primary)',
  padding: '2rem',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-color)',
};

export default ContactSection;
