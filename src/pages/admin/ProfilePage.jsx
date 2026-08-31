import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Check, AlertTriangle, Save, Bell, BellOff, BellRing, Loader } from 'lucide-react';
import {
  getPushSubscriptionStatus,
  subscribeToPush,
  unsubscribeCurrentDevice,
  sendTestNotification,
} from '../../lib/pushNotificationService';

export default function ProfilePage() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  // ── Profile fields ──────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');

  // ── Notification preferences ─────────────────────────────────────────────
  const [notifications, setNotifications] = useState({
    machine_inquiries:   false,
    inventory_inquiries: false,
    workshop_inquiries:  false,
    transport_inquiries: false,
    general_inquiries:   false,
    customer_replies:    false,
    new_users:           false,
    system_notifications: true
  });

  // ── Push notification state ────────────────────────────────────────────────
  // 'checking' | 'unsupported' | 'denied' | 'inactive' | 'active' | 'error'
  const [pushStatus, setPushStatus]       = useState('checking');
  const [pushLoading, setPushLoading]     = useState(false);
  const [pushError, setPushError]         = useState('');
  const [pushSuccess, setPushSuccess]     = useState('');
  const [testLoading, setTestLoading]     = useState(false);
  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setName(profile.name || '');
      setPhone(profile.phone || '');
      
      const fetchNotifications = async () => {
        const { data } = await supabase
          .from('user_notification_preferences')
          .select('*')
          .eq('user_id', profile.id)
          .single();
          
        if (data) {
          setNotifications(prev => ({ ...prev, ...data }));
        }
      };
      
      fetchNotifications();

      // Kolla push-status asynkront
      getPushSubscriptionStatus(profile.id)
        .then(status => setPushStatus(status))
        .catch(() => setPushStatus('error'));
    }
  }, [profile]);

  const toggleNotification = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // ── Push handlers ──────────────────────────────────────────────────────────
  const handleSubscribe = async () => {
    setPushLoading(true);
    setPushError('');
    setPushSuccess('');
    const result = await subscribeToPush();
    if (result.success) {
      setPushStatus('active');
      setPushSuccess('Push-notifikationer aktiverade för den här enheten.');
    } else {
      setPushError(result.error);
      if (result.code === 'permission_denied') setPushStatus('denied');
    }
    setPushLoading(false);
  };

  const handleUnsubscribe = async () => {
    setPushLoading(true);
    setPushError('');
    setPushSuccess('');
    const result = await unsubscribeCurrentDevice();
    if (result.success) {
      setPushStatus('inactive');
      setPushSuccess('Push-notifikationer inaktiverade för den här enheten.');
    } else {
      setPushError(result.error);
    }
    setPushLoading(false);
  };

  const handleTestNotification = async () => {
    setTestLoading(true);
    setPushError('');
    setPushSuccess('');
    const result = await sendTestNotification(session);
    if (result.success) {
      setPushSuccess(`Testnotifikation skickad till ${result.sent} enhet(er).`);
    } else {
      setPushError(result.error);
    }
    setTestLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Update basic profile info using the RPC
      const { error: profileError } = await supabase.rpc('update_own_profile', {
        p_first_name: firstName,
        p_last_name: lastName,
        p_name: name,
        p_phone: phone
      });

      if (profileError) throw profileError;

      // 2. Update notification preferences using RLS
      const prefPayload = { ...notifications };
      delete prefPayload.id;
      delete prefPayload.user_id;
      delete prefPayload.created_at;
      delete prefPayload.updated_at;

      const { error: notifError } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: profile.id,
          ...prefPayload
        }, { onConflict: 'user_id' });

      if (notifError) throw notifError;

      setSuccess('Profilen har uppdaterats.');
    } catch (err) {
      setError(err.message || 'Ett fel inträffade när profilen skulle sparas.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    width: '100%',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '0.4rem'
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Header (similar to forms) */}
      <header style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
              aria-label="Tillbaka"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 style={{ fontSize: '1.25rem', fontFamily: 'Outfit,sans-serif', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Min profil</h1>
          </div>
          <button 
            type="button"
            onClick={handleSave}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Sparar...' : <><Save size={18} /> Spara</>}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '1rem', marginBottom: '2rem', color: '#f87171' }}>
            <AlertTriangle size={18} /> <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', padding: '1rem', marginBottom: '2rem', color: '#4ade80' }}>
            <Check size={18} /> <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.125rem', margin: '0 0 1.5rem', color: 'var(--text-primary)' }}>Personuppgifter</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div>
                <label style={labelStyle}>Visningsnamn *</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required
                  style={inputStyle} 
                  placeholder="Hur du visas i systemet"
                />
              </div>
              <div>
                <label style={labelStyle}>E-postadress</label>
                <input 
                  type="email" 
                  value={profile?.email || ''} 
                  disabled
                  style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} 
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Din inloggningsadress (kan ej ändras här)</span>
              </div>
              <div>
                <label style={labelStyle}>Förnamn</label>
                <input 
                  type="text" 
                  value={firstName} 
                  onChange={e => setFirstName(e.target.value)} 
                  style={inputStyle} 
                />
              </div>
              <div>
                <label style={labelStyle}>Efternamn</label>
                <input 
                  type="text" 
                  value={lastName} 
                  onChange={e => setLastName(e.target.value)} 
                  style={inputStyle} 
                />
              </div>
              <div>
                <label style={labelStyle}>Telefonnummer</label>
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  style={inputStyle} 
                />
              </div>
              <div>
                <label style={labelStyle}>Behörighetsroll</label>
                <input 
                  type="text" 
                  value={(profile?.role || '').toUpperCase()} 
                  disabled
                  style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed', fontWeight: 600 }} 
                />
              </div>
              <div>
                <label style={labelStyle}>Yrkesroll</label>
                <input 
                  type="text" 
                  value={profile?.job_role || 'Övrigt'} 
                  disabled
                  style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} 
                />
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>Notifikationsinställningar</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Välj vilka typer av notifikationer du vill ta emot.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifications.machine_inquiries} onChange={() => toggleNotification('machine_inquiries')} />
                Nya maskinförfrågningar
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifications.inventory_inquiries} onChange={() => toggleNotification('inventory_inquiries')} />
                Nya lösöresförfrågningar
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifications.workshop_inquiries} onChange={() => toggleNotification('workshop_inquiries')} />
                Verkstad & smide
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifications.transport_inquiries} onChange={() => toggleNotification('transport_inquiries')} />
                Transport
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifications.general_inquiries} onChange={() => toggleNotification('general_inquiries')} />
                Generella kundförfrågningar
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifications.customer_replies} onChange={() => toggleNotification('customer_replies')} />
                Kundsvar
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifications.new_users} onChange={() => toggleNotification('new_users')} />
                Nya användare
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifications.system_notifications} onChange={() => toggleNotification('system_notifications')} />
                Systemnotiser
              </label>
            </div>
          </div>
        </form>

        {/* ── Push-notifikationer (separat sektion, utanför formuläret) ── */}
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem', marginTop: '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Bell size={20} style={{ color: 'var(--accent-primary)' }} />
            <h2 style={{ fontSize: '1.125rem', margin: 0, color: 'var(--text-primary)' }}>Push-notifikationer</h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Aktivera för att få notiser direkt i webbläsaren – även när fliken är stängd.
            Push-notiser styrs av dina notifikationsinställningar ovan.
          </p>

          {/* Felmeddelande (push) */}
          {pushError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', color: '#f87171' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '0.9rem' }}>{pushError}</span>
            </div>
          )}

          {/* Framgångsmeddelande (push) */}
          {pushSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', color: '#4ade80' }}>
              <Check size={18} />
              <span style={{ fontSize: '0.9rem' }}>{pushSuccess}</span>
            </div>
          )}

          {/* Status-display */}
          {pushStatus === 'checking' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.875rem' }}>Kontrollerar status...</span>
            </div>
          )}

          {pushStatus === 'unsupported' && (
            <div style={{ backgroundColor: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.25)', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Push stöds inte</strong><br />
                Din webbläsare stöder inte push-notifikationer. Använd Chrome, Edge eller Firefox på dator,
                eller installera appen som PWA på Android.
              </p>
            </div>
          )}

          {pushStatus === 'denied' && (
            <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: '#f87171' }}>Tillstånd nekat</strong><br />
                Du har blockerat notifikationer för den här webbplatsen. För att aktivera dem:
                klicka på hänglåset/ikonen i adressfältet → Webbplatsinställningar → Notifikationer → Tillåt.
              </p>
            </div>
          )}

          {pushStatus === 'active' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
              <span style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', fontWeight: 500 }}>Aktiverad på den här enheten</span>
            </div>
          )}

          {pushStatus === 'inactive' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>Inte aktiverad på den här enheten</span>
            </div>
          )}

          {/* Knappar */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {(pushStatus === 'inactive' || pushStatus === 'error') && (
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={pushLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', cursor: pushLoading ? 'not-allowed' : 'pointer', opacity: pushLoading ? 0.7 : 1 }}
              >
                {pushLoading ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Aktiverar...</> : <><BellRing size={16} /> Aktivera push-notifikationer</>}
              </button>
            )}

            {pushStatus === 'active' && (
              <>
                <button
                  type="button"
                  onClick={handleUnsubscribe}
                  disabled={pushLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 500, fontSize: '0.9375rem', cursor: pushLoading ? 'not-allowed' : 'pointer', opacity: pushLoading ? 0.7 : 1 }}
                >
                  {pushLoading ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Inaktiverar...</> : <><BellOff size={16} /> Inaktivera på den här enheten</>}
                </button>

                <button
                  type="button"
                  onClick={handleTestNotification}
                  disabled={testLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', backgroundColor: 'transparent', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', borderRadius: '8px', fontWeight: 500, fontSize: '0.9375rem', cursor: testLoading ? 'not-allowed' : 'pointer', opacity: testLoading ? 0.7 : 1 }}
                >
                  {testLoading ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Skickar...</> : <><Bell size={16} /> Skicka testnotifikation</>}
                </button>
              </>
            )}
          </div>

          {/* iOS-information */}
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '1rem', marginBottom: 0 }}>
            iOS/iPadOS: Push-notifikationer kräver att appen är installerad via "Lägg till på hemskärmen" (Safari → Dela → Lägg till).
            Fungerar direkt i Chrome, Edge och Firefox på dator och Android.
          </p>
        </div>
      </main>
    </div>
  );
}
