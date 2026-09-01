import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import { createQuoteRequest } from '../lib/quoteService';

const QuoteRequestForm = ({ preselectedType = 'other', machine = null, inventoryItem = null, onSuccess, onClose, onStatusChange }) => {
  const { t } = useLang();
  
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    request_type: preselectedType,
    message: ''
  });
  
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('');

  // Always keep request_type in sync with preselectedType if it changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, request_type: preselectedType }));
  }, [preselectedType]);

  // Determine dynamic heading and CTA based on context
  let heading = t('quote.headingDefault');
  let cta = t('quote.ctaDefault');
  
  if (machine) {
    heading = t('quote.headingMachine');
    cta = t('quote.ctaMachine');
  } else if (inventoryItem) {
    heading = t('quote.headingInventory');
    cta = t('quote.ctaInventory');
  } else if (preselectedType === 'workshop') {
    heading = t('quote.headingWorkshop');
    cta = t('quote.ctaWorkshop');
  } else if (preselectedType === 'metalwork') {
    heading = t('quote.headingMetalwork');
    cta = t('quote.ctaMetalwork');
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Client-side validation
    if (!formData.name || !formData.email || !formData.request_type || !formData.message) {
      setErrorMsg(t('quote.errorValidation'));
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setErrorMsg(t('quote.errorValidation'));
      return;
    }

    // Simple spam/double-click protection via sessionStorage
    const lastSubmit = sessionStorage.getItem('last_quote_submit');
    if (lastSubmit && Date.now() - parseInt(lastSubmit, 10) < 30000) {
      setErrorMsg(t('quote.errorSpam'));
      return;
    }

    setStatus('submitting');
    if (onStatusChange) onStatusChange('submitting');

    const requestData = {
      ...formData,
      machine_id: machine ? machine.id : null,
      inventory_item_id: inventoryItem ? inventoryItem.id : null,
    };

    console.log('QUOTE REQUEST PAYLOAD:', requestData);
    const result = await createQuoteRequest(requestData);
    console.log('QUOTE REQUEST RESULT:', result);
    const { error } = result;

    if (error) {
      console.error('QUOTE REQUEST ERROR:', error);
      setStatus('error');
      if (onStatusChange) onStatusChange('error');
      setErrorMsg(t('quote.errorSubmit') + ' | DEV: ' + error.message);
    } else {
      sessionStorage.setItem('last_quote_submit', Date.now().toString());
      setStatus('success');
      if (onStatusChange) onStatusChange('success');
      if (onSuccess) onSuccess();
    }
  };

  if (status === 'success') {
    return (
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        padding: '3rem 2rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <CheckCircle size={64} color="var(--accent-primary)" style={{ marginBottom: '1.5rem' }} />
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>{t('quote.successTitle')}</h3>
        <p style={{ margin: 0, fontSize: '1.125rem', color: 'var(--text-secondary)' }}>{t('quote.successDesc')}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ marginTop: '2rem' }}
          >
            {t('quote.close')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--bg-primary)',
      padding: '2rem',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-color)',
    }}>
      <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', fontSize: '1.5rem' }}>{heading}</h3>
      
      {machine && (
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{t('quote.aboutMachine')}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{machine.name}</span>
        </div>
      )}

      {inventoryItem && (
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{t('quote.aboutInventory')}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{inventoryItem.name}</span>
        </div>
      )}

      {status === 'error' && errorMsg && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: '#f87171' }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <div>
            <label htmlFor="name" style={labelStyle}>{t('quote.name')} *</label>
            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required style={inputStyle} />
          </div>
          <div>
            <label htmlFor="company" style={labelStyle}>{t('quote.company')}</label>
            <input type="text" id="company" name="company" value={formData.company} onChange={handleChange} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <div>
            <label htmlFor="email" style={labelStyle}>{t('quote.email')} *</label>
            <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required style={inputStyle} />
          </div>
          <div>
            <label htmlFor="phone" style={labelStyle}>{t('quote.phone')}</label>
            <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} style={inputStyle} />
          </div>
        </div>

        <div>
          <label htmlFor="request_type" style={labelStyle}>{t('quote.type')} *</label>
          <select id="request_type" name="request_type" value={formData.request_type} onChange={handleChange} style={{ ...inputStyle, appearance: 'none' }} required>
            <option value="workshop">{t('quote.types.workshop')}</option>
            <option value="metalwork">{t('quote.types.metalwork')}</option>
            <option value="custom">{t('quote.types.custom')}</option>
            <option value="boat_trailer">{t('quote.types.boat_trailer')}</option>
            <option value="special_trailer">{t('quote.types.special_trailer')}</option>
            <option value="repair">{t('quote.types.repair')}</option>
            <option value="machine">{t('quote.types.machine')}</option>
            <option value="inventory">{t('quote.types.inventory')}</option>
            <option value="transport">{t('quote.types.transport')}</option>
            <option value="machine_transport">{t('quote.types.machine_transport')}</option>
            <option value="sell_machine">{t('quote.types.sell_machine')}</option>
            <option value="requested">{t('quote.types.requested')}</option>
            <option value="other">{t('quote.types.other')}</option>
          </select>
        </div>

        <div>
          <label htmlFor="message" style={labelStyle}>{t('quote.message')} *</label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows="4"
            required
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder={t('quote.messagePlaceholder')}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '0.5rem', opacity: status === 'submitting' ? 0.7 : 1 }}
          disabled={status === 'submitting'}
        >
          {status === 'submitting' ? t('quote.submitting') : cta}
        </button>
      </form>
    </div>
  );
};

const labelStyle = {
  display: 'block',
  marginBottom: '0.4rem',
  fontWeight: '500',
  fontSize: '0.9375rem',
  color: 'var(--text-secondary)'
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
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

export default QuoteRequestForm;
