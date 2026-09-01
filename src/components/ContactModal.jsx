import React, { useEffect } from 'react';
import { X, Phone } from 'lucide-react';
import ContactForm from './ContactForm';
import { companyInfo } from '../data/company';
import { useLang } from '../contexts/LanguageContext';

const ContactModal = ({ isOpen, onClose, subject = '' }) => {
  const { t } = useLang();

  // Prevent background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="contact-modal-content"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          padding: '2.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '0.5rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
        >
          <X size={20} />
        </button>

        <div className="contact-modal-grid">
          {/* Left Side: Contact Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
                {t('contact.heading')}
              </h2>
            </div>
            
            {/* Sales */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                {t('contact.sales')}
              </h3>
              <p style={{ fontSize: '1.125rem', marginBottom: '1.5rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {companyInfo.contact.sales.name} <br />
                <span style={{ color: 'var(--text-secondary)' }}>{companyInfo.contact.sales.phone}</span>
              </p>
              <a href={companyInfo.contact.sales.phoneLink} className="btn btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                <Phone size={18} /> {t('contact.call')} {companyInfo.contact.sales.name}
              </a>
            </div>

            {/* Repair */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                {t('contact.repair')}
              </h3>
              <p style={{ fontSize: '1.125rem', marginBottom: '1.5rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {companyInfo.contact.repair.name} <br />
                <span style={{ color: 'var(--text-secondary)' }}>{companyInfo.contact.repair.phone}</span>
              </p>
              <a href={companyInfo.contact.repair.phoneLink} className="btn btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                <Phone size={18} /> {t('contact.call')} {companyInfo.contact.repair.name}
              </a>
            </div>
          </div>

          {/* Right Side: Form */}
          <div className="contact-modal-form-wrapper">
            <ContactForm preselectedSubject={subject} />
          </div>
        </div>
      </div>
      <style>{`
        .contact-modal-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2.5rem;
        }
        @media (min-width: 850px) {
          .contact-modal-grid {
            grid-template-columns: 320px 1fr;
            gap: 3rem;
          }
        }
        
        /* Seamlessly integrate ContactForm into the modal */
        .contact-modal-form-wrapper > div {
          padding: 0 !important;
          border: none !important;
          background-color: transparent !important;
        }
        
        /* Hide the redundant heading from ContactForm if desired, or keep it. 
           Since ContactForm has an h3 heading, we can hide it to avoid double headings */
        .contact-modal-form-wrapper > div > h3:first-of-type {
          display: none;
        }
        
        @media (max-width: 767px) {
          .contact-modal-content {
            padding: 1.5rem !important;
          }
        }
      `}</style>
    </div>
  );
};

const cardStyle = {
  backgroundColor: 'var(--bg-tertiary)',
  padding: '1.5rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
};

export default ContactModal;
