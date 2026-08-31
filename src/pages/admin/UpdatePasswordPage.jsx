import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const UpdatePasswordPage = () => {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    console.log("Update password started");
    
    // Diagnostik: Kolla om sessionen finns PÅ RIKTIGT precis innan vi sparar
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log("getSession() returnerar session:", !!sessionData?.session);
    if (sessionData?.session?.user) {
      console.log("user.id:", sessionData.session.user.id);
    }
    if (sessionError) {
      console.error("getSession() fel:", sessionError.message);
    }

    if (!sessionData?.session) {
      setError('Säkerhetssessionen har gått ut eller saknas. Vänligen begär en ny länk.');
      return;
    }

    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken långt.');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Lösenorden matchar inte.');
      return;
    }
    
    setSubmitting(true);

    const { error: updateError } = await updatePassword(password);
    console.log("om updateUser() körs: JA");

    if (updateError) {
      console.error("exakt Supabase error message:", updateError.message);
      setError(updateError.message);
      setSubmitting(false);
    } else {
      console.log("Update password succeeded");
      setSuccess(true);
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.bgGlow} aria-hidden="true" />

      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoMark}>
            <span style={{ color: 'var(--accent-primary)', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'Outfit, sans-serif' }}>
              H
            </span>
          </div>
          <h1 style={styles.heading}>Återställ lösenord</h1>
          <p style={styles.subheading}>Ange ditt nya lösenord nedan</p>
        </div>

        {error && (
          <div style={styles.errorBox} role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
              Ditt lösenord har uppdaterats!
            </div>
            <button
              onClick={() => navigate('/admin', { replace: true })}
              style={styles.submitButton}
            >
              Gå till Admin
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate style={styles.form}>
            <div style={styles.fieldGroup}>
              <label htmlFor="new-password" style={styles.label}>
                Nytt lösenord
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
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
                  style={styles.eyeButton}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <label htmlFor="confirm-password" style={styles.label}>
                Bekräfta nytt lösenord
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  disabled={submitting}
                  style={{ ...styles.input, paddingRight: '3rem' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(230,161,37,0.12)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !password || !confirmPassword}
              style={{
                ...styles.submitButton,
                opacity: (submitting || !password || !confirmPassword) ? 0.6 : 1,
                cursor: (submitting || !password || !confirmPassword) ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? (
                <>
                  <div style={styles.buttonSpinner} />
                  Uppdaterar…
                </>
              ) : (
                <>
                  <Lock size={18} />
                  Spara lösenord
                </>
              )}
            </button>
          </form>
        )}
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

/* ── Styles (reused from LoginPage for consistency) ── */
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
};

export default UpdatePasswordPage;
