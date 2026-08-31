import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const LoginPage = () => {
  const { user, loading, signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Already logged in → go straight to /admin
  useEffect(() => {
    if (!loading && user) {
      navigate('/admin', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setSubmitting(true);

    if (isForgotPassword) {
      if (!email.trim()) {
        setError('Vänligen ange din e-postadress.');
        setSubmitting(false);
        return;
      }
      const { error: resetError } = await resetPassword(email.trim());
      if (resetError) {
        if (resetError.message.includes('not found')) {
          setError('Ingen användare hittades med denna e-postadress.');
        } else {
          setError(resetError.message);
        }
      } else {
        setSuccessMessage('Återställningslänk har skickats till din e-post. Kontrollera din inkorg.');
        setIsForgotPassword(false);
        setPassword('');
      }
      setSubmitting(false);
      return;
    }

    const { error: authError } = await signIn(email.trim(), password);

    if (authError) {
      // Translate common Supabase error messages to Swedish
      if (authError.message.includes('Invalid login credentials')) {
        setError('Fel e-postadress eller lösenord.');
      } else if (authError.message.includes('Email not confirmed')) {
        setError('E-postadressen är inte bekräftad. Kontrollera din inkorg.');
      } else if (authError.message.includes('Too many requests')) {
        setError('För många inloggningsförsök. Vänta en stund och försök igen.');
      } else {
        setError(authError.message);
      }
      setSubmitting(false);
    }
    // On success, onAuthStateChange fires → user is set → useEffect above redirects
  };

  // While initial session check runs, show spinner
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Background decoration */}
      <div style={styles.bgGlow} aria-hidden="true" />

      <div style={styles.card}>
        {/* Logo / Header */}
        <div style={styles.header}>
          <div style={styles.logoMark}>
            <span style={{ color: 'var(--accent-primary)', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'Outfit, sans-serif' }}>
              H
            </span>
          </div>
          <h1 style={styles.heading}>Admin</h1>
          <p style={styles.subheading}>
            Hammarö Maskin &amp; Smide
          </p>
        </div>

        {/* Error alert */}
        {error && (
          <div style={styles.errorBox} role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Success alert */}
        {successMessage && (
          <div style={{...styles.errorBox, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.25)', color: '#22c55e'}} role="alert">
            <span>{successMessage}</span>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} noValidate style={styles.form}>
          {/* Email */}
          <div style={styles.fieldGroup}>
            <label htmlFor="login-email" style={styles.label}>
              E-postadress
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="admin@example.com"
              disabled={submitting}
              style={styles.input}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(230,161,37,0.12)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Password */}
          {!isForgotPassword && (
            <div style={styles.fieldGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="login-password" style={styles.label}>
                  Lösenord
                </label>
                <button 
                  type="button" 
                  onClick={() => { setIsForgotPassword(true); setError(''); setSuccessMessage(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8125rem', cursor: 'pointer', padding: 0 }}
                >
                  Glömt lösenord?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  disabled={submitting}
                  style={{ ...styles.input, paddingRight: '3rem' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(230,161,37,0.12)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Dölj lösenord' : 'Visa lösenord'}
                  style={styles.eyeButton}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            disabled={submitting || !email || (!isForgotPassword && !password)}
            style={{
              ...styles.submitButton,
              opacity: (submitting || !email || (!isForgotPassword && !password)) ? 0.6 : 1,
              cursor: (submitting || !email || (!isForgotPassword && !password)) ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? (
              <>
                <div style={styles.buttonSpinner} />
                {isForgotPassword ? 'Skickar…' : 'Loggar in…'}
              </>
            ) : (
              <>
                {!isForgotPassword && <LogIn size={18} />}
                {isForgotPassword ? 'Återställ lösenord' : 'Logga in'}
              </>
            )}
          </button>

          {isForgotPassword && (
            <button 
              type="button" 
              onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMessage(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', padding: '0.5rem', marginTop: '-0.5rem' }}
            >
              Tillbaka till inloggning
            </button>
          )}
        </form>

        {/* Footer note */}
        <p style={styles.footerNote}>
          Adminåtkomst hanteras via Supabase Auth.
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

/* ── Styles ──────────────────────────────────────────────────────────────── */
const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'absolute',
    top: '-200px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '600px',
    height: '600px',
    background: 'radial-gradient(circle, rgba(230,161,37,0.06) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
    animation: 'fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  logoMark: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '52px',
    height: '52px',
    backgroundColor: 'rgba(230,161,37,0.1)',
    border: '1px solid rgba(230,161,37,0.25)',
    borderRadius: '12px',
    marginBottom: '1rem',
  },
  heading: {
    fontSize: '1.75rem',
    fontFamily: 'Outfit, sans-serif',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 0.25rem 0',
    letterSpacing: '-0.02em',
  },
  subheading: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    backgroundColor: 'rgba(220,53,53,0.1)',
    border: '1px solid rgba(220,53,53,0.25)',
    color: '#f87171',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    marginBottom: '1.25rem',
    lineHeight: '1.5',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  },
  eyeButton: {
    position: 'absolute',
    right: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    padding: '0.25rem',
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.875rem',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    transition: 'background-color 0.2s, transform 0.1s',
    marginTop: '0.25rem',
  },
  buttonSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(0,0,0,0.2)',
    borderTopColor: 'var(--text-inverse)',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '1.5rem',
    marginBottom: 0,
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid var(--border-color)',
    borderTopColor: 'var(--accent-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};

export default LoginPage;
