import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, X, Check, Loader2, Plus, Pencil, Shield, Trash2, Mail, Info } from 'lucide-react';

const PERMISSIONS_LIST = [
  { id: 'machines:read', label: 'Visa Maskiner' },
  { id: 'machines:write', label: 'Skapa/Redigera Maskiner' },
  { id: 'machines:delete', label: 'Ta bort Maskiner' },
  { id: 'inventory:read', label: 'Visa Lösöre' },
  { id: 'inventory:write', label: 'Skapa/Redigera Lösöre' },
  { id: 'inventory:delete', label: 'Ta bort Lösöre' },
  { id: 'sales:read', label: 'Visa Försäljning' },
  { id: 'sales:write', label: 'Hantera Försäljning' },
  { id: 'quotes:read', label: 'Visa Förfrågningar' },
  { id: 'quotes:write', label: 'Hantera Förfrågningar' },
  { id: 'quotes:delete', label: 'Ta bort Förfrågningar' },
  { id: 'statistics:read', label: 'Visa Statistik' }
];

const JOB_ROLES = [
  'Säljare',
  'Svetsare',
  'Mekaniker',
  'Transport',
  'Lager',
  'Verkstad',
  'Övrigt'
];

export default function UsersPanel() {
  const { profile, session } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Delete confirm states
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState('');

  // Resend Invite states
  const [pendingResendUser, setPendingResendUser] = useState(null);

  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('employee');
  const [formJobRole, setFormJobRole] = useState('Övrigt');
  const [formPermissions, setFormPermissions] = useState([]);
  const [formNotificationPreferences, setFormNotificationPreferences] = useState({
    machine_inquiries: false,
    inventory_inquiries: false,
    workshop_inquiries: false,
    transport_inquiries: false,
    customer_replies: false,
    new_users: false,
    system_notifications: true
  });

  // Tooltip popover state
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = React.useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setShowTooltip(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isSuperadmin = profile?.role === 'superadmin';
  const isAdmin = profile?.role === 'admin';

  const handleApiRequest = async (action, payload) => {
    try {
      setError('');
      setSuccess('');
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ action, payload })
        }
      );
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Något gick fel');
      }
      return data;
    } catch (err) {
      throw err;
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { users: fetchedUsers } = await handleApiRequest('getUsers');
      setUsers(fetchedUsers || []);
    } catch (err) {
      setError('Kunde inte hämta användare: ' + err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!formEmail.trim()) {
      setError('E-post är obligatorisk');
      return;
    }

    try {
      if (editingUser) {
        const initialPrefs = (Array.isArray(editingUser.user_notification_preferences) ? editingUser.user_notification_preferences[0] : editingUser.user_notification_preferences) || {
          machine_inquiries: false,
          inventory_inquiries: false,
          workshop_inquiries: false,
          transport_inquiries: false,
          customer_replies: false,
          new_users: false,
          system_notifications: true
        };
        const prefsChanged = ['machine_inquiries', 'inventory_inquiries', 'workshop_inquiries', 'transport_inquiries', 'customer_replies', 'new_users', 'system_notifications'].some(
          key => formNotificationPreferences[key] !== initialPrefs[key]
        );

        if (
          formJobRole !== editingUser.job_role || 
          formName !== (editingUser.name || '') ||
          prefsChanged
        ) {
          await handleApiRequest('updateProfile', { 
            userId: editingUser.id, 
            job_role: formJobRole !== editingUser.job_role ? formJobRole : undefined,
            notification_preferences: prefsChanged ? formNotificationPreferences : undefined,
            name: formName !== (editingUser.name || '') ? formName : undefined
          });
        }
        
        if (formRole !== editingUser.role) {
          await handleApiRequest('updateRole', { 
            userId: editingUser.id, 
            role: formRole
          });
        }

        if (formRole === 'intern' || formRole === 'employee') {
          await handleApiRequest('updatePermissions', { userId: editingUser.id, permissions: formPermissions });
        }
        setSuccess('Användare uppdaterad.');
        setShowModal(false);
        fetchUsers();
      } else {
        await handleApiRequest('invite', { 
          email: formEmail, 
          name: formName, 
          role: formRole, 
          job_role: formJobRole,
          permissions: (formRole === 'intern' || formRole === 'employee') ? formPermissions : [],
          notification_preferences: formNotificationPreferences
        });
        setSuccess('Inbjudan skickad till ' + formEmail);
        setShowModal(false);
        fetchUsers();
      }
    } catch (err) {
      // Check if it's the specific "already_invited" error
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.already_invited) {
          setPendingResendUser({ email: formEmail, role: formRole });
          setError('');
          return;
        } else if (parsed.message) {
          setError(parsed.message);
          return;
        }
      } catch(e) {}
      
      setError(err.message);
    }
  };

  const handleResendInvite = async (userObj) => {
    try {
      await handleApiRequest('resendInvite', { email: userObj.email, role: userObj.role });
      setSuccess(`En ny inbjudan har skickats till ${userObj.email}`);
      setPendingResendUser(null);
      setShowModal(false);
    } catch (err) {
      let msg = err.message;
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.message) msg = parsed.message;
      } catch(e) {}
      setError(`Kunde inte skicka ny inbjudan: ${msg}`);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      await handleApiRequest('toggleStatus', { userId: user.id, is_active: !user.is_active });
      setSuccess(`Användaren har ${!user.is_active ? 'aktiverats' : 'inaktiverats'}.`);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteClick = (user) => {
    setDeletingUser(user);
    setDeleteEmailConfirm('');
  };

  const confirmDeleteUser = async () => {
    if (deleteEmailConfirm !== deletingUser.email) {
      setError('E-postadressen matchar inte.');
      return;
    }
    try {
      await handleApiRequest('deleteUser', { userId: deletingUser.id });
      setSuccess('Användaren har raderats.');
      setDeletingUser(null);
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const openNewModal = () => {
    setEditingUser(null);
    setFormEmail('');
    setFormName('');
    setFormRole('employee');
    setFormJobRole('Övrigt');
    setFormPermissions([]);
    setFormNotificationPreferences({
      machine_inquiries: false,
      inventory_inquiries: false,
      workshop_inquiries: false,
      transport_inquiries: false,
      customer_replies: false,
      new_users: false,
      system_notifications: true
    });
    setPendingResendUser(null);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormEmail(user.email);
    setFormName(user.name || '');
    setFormRole(user.role);
    setFormJobRole(user.job_role || 'Övrigt');
    setFormPermissions(user.permissions || []);
    setFormNotificationPreferences((Array.isArray(user.user_notification_preferences) ? user.user_notification_preferences[0] : user.user_notification_preferences) || {
      machine_inquiries: false,
      inventory_inquiries: false,
      workshop_inquiries: false,
      transport_inquiries: false,
      customer_replies: false,
      new_users: false,
      system_notifications: true
    });
    setShowModal(true);
  };

  const togglePermission = (permId) => {
    setFormPermissions(prev => 
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const toggleNotification = (key) => {
    setFormNotificationPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const inputStyle = {
    padding: '0.7rem 0.9rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div className="users-panel-container" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
      <style>{`
        .admin-users-header {
          flex-wrap: wrap;
        }
        @media (max-width: 369px) {
          .admin-users-invite-btn {
            width: 100%;
            justify-content: center;
          }
          .admin-users-header h2 {
            font-size: 1.15rem !important;
            word-break: break-word;
          }
        }
        .admin-notif-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          background-color: var(--bg-primary);
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid var(--border-color);
        }
        @media (max-width: 349px) {
          .admin-users-invite-btn {
            width: 100%;
            justify-content: center;
            margin-top: 0.5rem;
          }
          .admin-user-card-bottom {
            flex-direction: column;
            align-items: flex-start !important;
          }
          .admin-user-card-actions {
            width: 100%;
            justify-content: flex-start;
            flex-wrap: wrap;
            margin-top: 0.5rem;
          }
          .admin-user-card-actions button {
            flex: 1 1 auto;
            text-align: center;
            justify-content: center;
            display: flex;
          }
          .admin-notif-grid {
            grid-template-columns: 1fr !important;
          }
          .admin-modal-buttons {
            flex-direction: column;
          }
          .admin-modal-buttons button {
            width: 100%;
            flex: none !important;
          }
        }
        @media (max-width: 369px) {
          .admin-users-header {
            flex-wrap: wrap;
          }
          .admin-users-invite-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
      <div className="admin-users-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 0 }} ref={tooltipRef}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)' }}>
              Användare & Behörigheter
            </h2>
            <button 
              onClick={() => setShowTooltip(!showTooltip)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
              aria-label="Visa information"
            >
              <Info size={16} />
            </button>
          </div>
          
          {showTooltip && (
            <div style={{ 
              position: 'absolute', top: '100%', left: 0, marginTop: '0.5rem',
              backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              borderRadius: '8px', padding: '1rem', width: '280px', maxWidth: 'calc(100vw - 3rem)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.4)', zIndex: 50,
              color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5
            }}>
              Hantera systemets användare, roller och rättigheter.
            </div>
          )}
        </div>
        <button 
          className="admin-users-invite-btn"
          onClick={openNewModal}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.875rem', backgroundColor: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem' }}
        >
          <Plus size={14} /> Bjud in
        </button>
      </div>

      {error && (
        <div style={{ margin: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '0.875rem 1rem', color: '#f87171', fontSize: '0.9375rem' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} /> 
          <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', flexShrink: 0 }}><X size={16} /></button>
        </div>
      )}

      {success && (
        <div style={{ margin: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', padding: '0.875rem 1rem', color: '#4ade80', fontSize: '0.9375rem' }}>
          <Check size={16} style={{ flexShrink: 0 }} /> 
          <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{success}</span>
          <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', flexShrink: 0 }}><X size={16} /></button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Laddar användare...</div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Användare</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Roll</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const canEdit = isSuperadmin || (isAdmin && (u.role === 'intern' || u.role === 'employee'));
                  
                  const ROLE_LABELS = {
                    superadmin: 'SUPERADMIN',
                    admin: 'ADMIN',
                    employee: 'ANSTÄLLD',
                    intern: 'PRAKTIKANT'
                  };
                  
                  const ROLE_COLORS = {
                    superadmin: { bg: 'rgba(239,68,68,0.1)', text: '#ef4444' },
                    admin: { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6' },
                    employee: { bg: 'rgba(168,85,247,0.1)', text: '#a855f7' },
                    intern: { bg: 'rgba(107,114,128,0.1)', text: 'var(--text-secondary)' }
                  };
                  
                  const colors = ROLE_COLORS[u.role] || ROLE_COLORS.intern;

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', color: 'var(--text-primary)' }}>
                        <div style={{ fontWeight: 600 }}>
                          {u.name || 'Okänt namn'}
                          {u.role === 'superadmin' && <Shield size={13} style={{ marginLeft: '6px', color: 'var(--text-muted)' }} title="Superadmin" />}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Yrke: {u.job_role || 'Övrigt'}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                          backgroundColor: colors.bg,
                          color: colors.text
                        }}>
                          {ROLE_LABELS[u.role] || u.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {u.is_pending ? (
                          <span style={{ color: '#f59e0b', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                            <Mail size={14} /> INBJUDEN
                          </span>
                        ) : u.is_active ? (
                          <span style={{ color: '#22c55e', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                            <Check size={14} /> AKTIV
                          </span>
                        ) : (
                          <span style={{ color: '#ef4444', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                            <X size={14} /> INAKTIV
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            {u.is_pending && (
                              <button onClick={() => {
                                if (window.confirm('Vill du skicka en ny inbjudan till ' + u.email + '?')) {
                                  handleResendInvite(u);
                                }
                              }} style={{ padding: '0.4rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#f59e0b', cursor: 'pointer' }} title="Skicka ny inbjudan">
                                <Mail size={14} />
                              </button>
                            )}
                            <button onClick={() => openEditModal(u)} style={{ padding: '0.4rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer' }} title="Redigera">
                              <Pencil size={14} />
                            </button>
                            {u.id !== profile?.id && !u.is_pending && (
                              <button onClick={() => handleToggleStatus(u)} style={{ padding: '0.4rem', background: 'var(--bg-primary)', border: `1px solid ${u.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, borderRadius: '6px', color: u.is_active ? '#f87171' : '#4ade80', cursor: 'pointer' }} title={u.is_active ? 'Inaktivera' : 'Aktivera'}>
                                {u.is_active ? <Trash2 size={14} /> : <Check size={14} />}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="admin-card-list">
            {users.map(u => {
              const canEdit = isSuperadmin || (isAdmin && (u.role === 'intern' || u.role === 'employee'));
              const ROLE_LABELS = { superadmin: 'SUPERADMIN', admin: 'ADMIN', employee: 'ANSTÄLLD', intern: 'PRAKTIKANT' };
              const ROLE_COLORS = {
                superadmin: { bg: 'rgba(239,68,68,0.1)', text: '#ef4444' },
                admin: { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6' },
                employee: { bg: 'rgba(168,85,247,0.1)', text: '#a855f7' },
                intern: { bg: 'rgba(107,114,128,0.1)', text: 'var(--text-secondary)' }
              };
              const colors = ROLE_COLORS[u.role] || ROLE_COLORS.intern;

              return (
                <div key={u.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div className="admin-user-card-top" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '0.4rem' }}>
                    <span className="admin-user-role-badge" style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: colors.bg, color: colors.text, whiteSpace: 'nowrap' }}>
                      {ROLE_LABELS[u.role] || u.role.toUpperCase()}
                    </span>
                    <div style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word', width: '100%' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {u.name || 'Okänt namn'}
                        {u.role === 'superadmin' && <Shield size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', overflowWrap: 'anywhere' }}>{u.email}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Yrke: {u.job_role || 'Övrigt'}</div>
                    </div>
                  </div>
                  
                  <div className="admin-user-card-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', gap: '0.5rem' }}>
                    <div style={{ flexShrink: 0 }}>
                      {u.is_pending ? (
                        <span style={{ color: '#f59e0b', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}><Mail size={13} /> INBJUDEN</span>
                      ) : u.is_active ? (
                        <span style={{ color: '#22c55e', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}><Check size={13} /> AKTIV</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}><X size={13} /> INAKTIV</span>
                      )}
                    </div>

                    {canEdit && (
                      <div className="admin-user-card-actions" style={{ display: 'flex', gap: '0.4rem' }}>
                        {u.is_pending && (
                          <button onClick={() => { if (window.confirm('Vill du skicka en ny inbjudan?')) handleResendInvite(u); }} style={{ padding: '0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#f59e0b', cursor: 'pointer' }}><Mail size={14} /></button>
                        )}
                        <button onClick={() => openEditModal(u)} style={{ padding: '0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer' }}><Pencil size={14} /></button>
                        {u.id !== profile?.id && !u.is_pending && (
                          <button onClick={() => handleToggleStatus(u)} style={{ padding: '0.5rem', background: 'var(--bg-primary)', border: `1px solid ${u.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, borderRadius: '6px', color: u.is_active ? '#f87171' : '#4ade80', cursor: 'pointer' }}>
                            {u.is_active ? <Trash2 size={14} /> : <Check size={14} />}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 1.5rem', color: 'var(--text-primary)', fontSize: '1.25rem' }}>{editingUser ? 'Redigera användare' : 'Bjud in användare'}</h3>
            
            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>E-post</label>
                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} required disabled={!!editingUser || !!pendingResendUser} style={{...inputStyle, opacity: (editingUser || pendingResendUser) ? 0.6 : 1}} />
                {!editingUser && !pendingResendUser && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ett inbjudningsmejl skickas till denna adress.</span>}
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Namn (Visningsnamn)</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Frivilligt namn" style={inputStyle} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Behörighetsroll</label>
                <select value={formRole} onChange={e => setFormRole(e.target.value)} disabled={editingUser?.id === profile?.id} style={inputStyle}>
                  <option value="intern">PRAKTIKANT (Read-only)</option>
                  <option value="employee">ANSTÄLLD (Operativ access)</option>
                  {isSuperadmin && <option value="admin">ADMIN (Operativ + Användarhantering)</option>}
                  {isSuperadmin && <option value="superadmin">SUPERADMIN (Full tillgång)</option>}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Yrkesroll</label>
                <select value={formJobRole} onChange={e => setFormJobRole(e.target.value)} style={inputStyle}>
                  {JOB_ROLES.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              {formRole === 'intern' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Specifika behörigheter (Praktikant)</label>
                  <div className="admin-notif-grid">
                    {PERMISSIONS_LIST.filter(p => !p.id.endsWith(':write') && !p.id.endsWith(':delete')).map(perm => (
                      <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={formPermissions.includes(perm.id)} onChange={() => togglePermission(perm.id)} style={{ flexShrink: 0 }} />
                        <span style={{ wordBreak: 'break-word', minWidth: 0 }}>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Notifikationer</label>
                <div className="admin-notif-grid">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formNotificationPreferences.machine_inquiries} onChange={() => toggleNotification('machine_inquiries')} style={{ flexShrink: 0 }} />
                    <span style={{ wordBreak: 'break-word', minWidth: 0 }}>Maskinförfrågningar</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formNotificationPreferences.inventory_inquiries} onChange={() => toggleNotification('inventory_inquiries')} style={{ flexShrink: 0 }} />
                    <span style={{ wordBreak: 'break-word', minWidth: 0 }}>Lösöresförfrågningar</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formNotificationPreferences.workshop_inquiries} onChange={() => toggleNotification('workshop_inquiries')} style={{ flexShrink: 0 }} />
                    <span style={{ wordBreak: 'break-word', minWidth: 0 }}>Verkstad & Smide</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formNotificationPreferences.transport_inquiries} onChange={() => toggleNotification('transport_inquiries')} style={{ flexShrink: 0 }} />
                    <span style={{ wordBreak: 'break-word', minWidth: 0 }}>Transport</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formNotificationPreferences.customer_replies} onChange={() => toggleNotification('customer_replies')} style={{ flexShrink: 0 }} />
                    <span style={{ wordBreak: 'break-word', minWidth: 0 }}>Kundsvar</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formNotificationPreferences.new_users} onChange={() => toggleNotification('new_users')} style={{ flexShrink: 0 }} />
                    <span style={{ wordBreak: 'break-word', minWidth: 0 }}>Nya användare</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formNotificationPreferences.system_notifications} onChange={() => toggleNotification('system_notifications')} style={{ flexShrink: 0 }} />
                    <span style={{ wordBreak: 'break-word', minWidth: 0 }}>Systemnotiser</span>
                  </label>
                </div>
              </div>

              {isSuperadmin && editingUser && (
                <div style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
                  <h4 style={{ color: '#ef4444', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertTriangle size={16} /> Farlig zon
                  </h4>
                  {editingUser.role === 'superadmin' ? (
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      <Shield size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      Superadmin-konton kan inte raderas här.
                    </div>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => handleDeleteClick(editingUser)}
                      style={{ padding: '0.6rem 1rem', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Trash2 size={16} /> Radera användare
                    </button>
                  )}
                </div>
              )}

              {pendingResendUser ? (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px' }}>
                  <p style={{ margin: '0 0 1rem', color: 'var(--text-primary)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                    Den här användaren har redan blivit inbjuden men har inte aktiverat sitt konto än. Vill du skicka en ny inbjudan?
                  </p>
                  <div className="admin-modal-buttons" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setPendingResendUser(null)} style={{ flex: '1 1 120px', padding: '0.75rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'center' }}>Avbryt</button>
                    <button type="button" onClick={() => handleResendInvite(pendingResendUser)} style={{ flex: '1 1 120px', padding: '0.75rem', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                      <Mail size={16} /> Skicka ny inbjudan
                    </button>
                  </div>
                </div>
              ) : (
                <div className="admin-modal-buttons" style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ flex: '1 1 120px', padding: '0.75rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'center' }}>Avbryt</button>
                  <button type="submit" style={{ flex: '1 1 120px', padding: '0.75rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, textAlign: 'center' }}>{editingUser ? 'Spara ändringar' : 'Skicka inbjudan'}</button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {deletingUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '1.5rem' }}>
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid #ef4444', borderRadius: '12px', padding: '2rem', maxWidth: '420px', width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <AlertTriangle size={32} color="#ef4444" />
            </div>
            <h3 style={{ margin: '0 0 1rem', color: 'var(--text-primary)', fontSize: '1.25rem', textAlign: 'center' }}>Radera användare</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', textAlign: 'center', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              Du håller på att radera <strong>{deletingUser.name || deletingUser.email}</strong>.<br />
              Användaren kommer inte längre att kunna logga in.
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem', textAlign: 'center' }}>Skriv e-postadressen för att bekräfta:</label>
              <input type="text" placeholder={deletingUser.email} value={deleteEmailConfirm} onChange={e => setDeleteEmailConfirm(e.target.value)} style={{...inputStyle, textAlign: 'center'}} />
            </div>
            <div className="admin-modal-buttons" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setDeletingUser(null)} style={{ flex: '1 1 120px', padding: '0.75rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'center' }}>Avbryt</button>
              <button type="button" onClick={confirmDeleteUser} disabled={deleteEmailConfirm !== deletingUser.email} style={{ flex: '1 1 120px', padding: '0.75rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: deleteEmailConfirm === deletingUser.email ? 'pointer' : 'not-allowed', fontWeight: 600, opacity: deleteEmailConfirm === deletingUser.email ? 1 : 0.5, textAlign: 'center' }}>Radera permanent</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
