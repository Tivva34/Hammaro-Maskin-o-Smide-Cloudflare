import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import { createQuoteRequest } from '../lib/quoteService';

const ContactForm = ({ preselectedSubject = '' }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: preselectedSubject,
    message: ''
  });

  useEffect(() => {
    setFormData(prev => ({ ...prev, subject: preselectedSubject }));
  }, [preselectedSubject]);
  
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const { t } = useLang();

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Client-side validation
    if (!formData.name || !formData.email || !formData.message) {
      setErrorMsg(t('quote.errorValidation') || 'Fyll i alla obligatoriska fält.');
      return;
    }
    
    // Simple spam/double-click protection via sessionStorage
    const lastSubmit = sessionStorage.getItem('last_contact_submit');
    if (lastSubmit && Date.now() - parseInt(lastSubmit, 10) < 30000) {
      setErrorMsg(t('quote.errorSpam') || 'Du har redan skickat en förfrågan nyligen. Vänligen vänta en stund.');
      return;
    }

    setStatus('submitting');
    
    // Format message to include subject if one was selected
    let finalMessage = formData.message;
    if (formData.subject) {
      const subjectLabel = t(`form.opt_${formData.subject}`) || formData.subject;
      finalMessage = `Ärende: ${subjectLabel}\n\n${formData.message}`;
    }

    const requestData = {
      name: formData.name,
      company: '', // Optional/not in contact form
      email: formData.email,
      phone: formData.phone,
      message: finalMessage,
      request_type: 'contact',
      machine_id: null,
      inventory_item_id: null,
    };

    const { error } = await createQuoteRequest(requestData);

    if (error) {
      console.error('CONTACT REQUEST ERROR:', error);
      setStatus('error');
      setErrorMsg((t('quote.errorSubmit') || 'Det gick inte att skicka förfrågan.') + ' | DEV: ' + error.message);
    } else {
      sessionStorage.setItem('last_contact_submit', Date.now().toString());
      setStatus('success');
      // Clear form except user info maybe? The user requested: "töm formuläret"
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
      });
    }
  };

  if (status === 'success') {
    return (
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        padding: '4rem 2rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <CheckCircle size={64} color="var(--accent-primary)" style={{ marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>{t('form.successTitle')}</h3>
        <p style={{ margin: 0, fontSize: '1.125rem', color: 'var(--text-secondary)' }}>{t('form.successDesc')}</p>
        {/* Enligt instruktionerna: "visa inte 'Skicka en till förfrågan', behåll samma UX som QuoteRequestForm"
            QuoteRequestForm har dock en Stäng-knapp OM onClose skickas in. ContactForm skickas inte in i en modal.
            Vi lämnar det rent, användaren får navigera vidare via menyn. */}
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--bg-primary)',
      padding: '3rem',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-color)',
    }}>
      <h3 style={{ marginBottom: '2rem', color: 'var(--text-primary)' }}>{t('form.heading')}</h3>

      {status === 'error' && errorMsg && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: '#f87171' }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <div>
          <label htmlFor="name" style={labelStyle}>{t('form.name')} *</label>
          <input type="text" id="name" value={formData.name} onChange={handleChange} required style={inputStyle} placeholder={t('form.namePlaceholder')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          <div>
            <label htmlFor="email" style={labelStyle}>{t('form.email')} *</label>
            <input type="email" id="email" value={formData.email} onChange={handleChange} required style={inputStyle} placeholder={t('form.emailPlaceholder')} />
          </div>
          <div>
            <label htmlFor="phone" style={labelStyle}>{t('form.phone')}</label>
            <input type="tel" id="phone" value={formData.phone} onChange={handleChange} style={inputStyle} placeholder={t('form.phonePlaceholder')} />
          </div>
        </div>

        <div>
          <label htmlFor="subject" style={labelStyle}>{t('form.subject')}</label>
          <select id="subject" value={formData.subject} onChange={handleChange} style={{ ...inputStyle, appearance: 'none' }}>
            <option value="" disabled>{t('form.subjectPlaceholder')}</option>
            <option value="buy">{t('form.opt_buy')}</option>
            <option value="sell">{t('form.opt_sell')}</option>
            <option value="repair">{t('form.opt_repair')}</option>
            <option value="manufacturing">{t('form.opt_manufacturing')}</option>
            <option value="transport">{t('form.opt_transport')}</option>
            <option value="other">{t('form.opt_other')}</option>
          </select>
        </div>

        <div>
          <label htmlFor="message" style={labelStyle}>{t('form.message')} *</label>
          <textarea
            id="message"
            value={formData.message}
            onChange={handleChange}
            rows="4"
            required
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder={t('form.messagePlaceholder')}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '1rem', opacity: status === 'submitting' ? 0.7 : 1 }}
          disabled={status === 'submitting'}
        >
          {status === 'submitting' ? t('form.submitting') : t('form.submit')}
        </button>
      </form>
    </div>
  );
};

const labelStyle = {
  display: 'block',
  marginBottom: '0.5rem',
  fontWeight: '500',
  fontSize: '0.9375rem',
  color: 'var(--text-secondary)'
};

const inputStyle = {
  width: '100%',
  padding: '0.875rem 1rem',
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: '1rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color var(--transition-fast)',
  boxSizing: 'border-box'
};

export default ContactForm;
