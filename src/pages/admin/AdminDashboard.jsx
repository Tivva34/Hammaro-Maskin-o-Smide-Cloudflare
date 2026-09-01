import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { LogOut, Plus, Pencil, Trash2, AlertTriangle, X, RefreshCw, Search, Sun, Moon, Lock, User, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getMachines,
  deleteMachine,
  getStatusLabel,
  getStatusColor,
} from '../../lib/machinesService';
import {
  getInventoryItems,
  deleteInventoryItem,
  getInventoryStatusLabel,
  getInventoryStatusColor,
} from '../../lib/inventoryService';
import { getQuoteRequests } from '../../lib/quoteService';
import QuoteRequestsPanel from '../../components/admin/QuoteRequestsPanel';
import StatisticsPanel from '../../components/admin/StatisticsPanel';
import SalesPanel from '../../components/admin/SalesPanel';
import UsersPanel from '../../components/admin/UsersPanel';
import translations from '../../i18n/translations';

// ─── Confirmation modal ────────────────────────────────────────────────────────
const DeleteModal = ({ machine, onConfirm, onCancel, deleting }) => (
  <div style={modal.overlay} onClick={onCancel}>
    <div style={modal.box} onClick={e => e.stopPropagation()}>
      <div style={modal.iconRow}>
        <AlertTriangle size={28} color="#ef4444" />
      </div>
      <h2 style={modal.heading}>Ta bort {machine.category ? 'maskin' : 'lösöre'}?</h2>
      <p style={modal.text}>
        <strong style={{ color: 'var(--text-primary)' }}>{machine.name}</strong> tas bort permanent.
        Alla bilder kopplade till {machine.category ? 'maskinen' : 'objektet'} tas också bort från databasen.
      </p>
      <div style={modal.actions}>
        <button onClick={onCancel} disabled={deleting} style={modal.cancelBtn}>
          Avbryt
        </button>
        <button onClick={onConfirm} disabled={deleting} style={modal.deleteBtn}>
          {deleting ? 'Tar bort…' : 'Ta bort'}
        </button>
      </div>
    </div>
  </div>
);

const modal = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 200,
    backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
  },
  box: {
    backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)',
    borderRadius: '16px', padding: '2rem', maxWidth: '420px', width: '100%',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  iconRow: { display: 'flex', justifyContent: 'center', marginBottom: '1rem' },
  heading: { fontSize: '1.25rem', fontFamily: 'Outfit,sans-serif', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 0.75rem' },
  text: { color: 'var(--text-secondary)', fontSize: '0.9375rem', textAlign: 'center', margin: '0 0 1.5rem', lineHeight: 1.6 },
  actions: { display: 'flex', gap: '0.75rem' },
  cancelBtn: {
    flex: 1, padding: '0.75rem', background: 'transparent',
    border: '1px solid var(--border-color)', borderRadius: '8px',
    color: 'var(--text-primary)', fontSize: '0.9375rem', fontFamily: 'Inter,sans-serif',
    cursor: 'pointer',
  },
  deleteBtn: {
    flex: 1, padding: '0.75rem', background: '#ef4444',
    border: 'none', borderRadius: '8px',
    color: '#fff', fontSize: '0.9375rem', fontWeight: 600, fontFamily: 'Inter,sans-serif',
    cursor: 'pointer',
  },
};

// ─── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status, type = 'machine' }) => {
  const label = type === 'machine' ? getStatusLabel(status) : getInventoryStatusLabel(status);
  const color = type === 'machine' ? getStatusColor(status) : getInventoryStatusColor(status);
  
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
      backgroundColor: `${color}22`,
      color: color,
      border: `1px solid ${color}44`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
};

// ─── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, accent, isActive, onClick }) => (
  <button onClick={onClick} className="stat-card" style={{
    backgroundColor: isActive ? 'var(--bg-primary)' : 'var(--bg-surface)',
    border: isActive ? `1px solid ${accent || 'var(--text-primary)'}` : '1px solid var(--border-color)',
    borderTop: accent ? `3px solid ${accent}` : '3px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
    boxShadow: isActive ? `0 0 0 1px ${accent || 'var(--text-primary)'}` : 'none',
    width: '100%',
    display: 'block'
  }}
  onMouseEnter={e => {
    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
  }}
  onMouseLeave={e => {
    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
  }}>
    <div className="stat-card-value" style={{ fontWeight: 700, fontFamily: 'Outfit,sans-serif', color: accent || 'var(--text-primary)', lineHeight: 1 }}>
      {value}
    </div>
    <div className="stat-card-label" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 400 }}>
      {label}
    </div>
  </button>
);

// ─── Main component ────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const { user, profile, session, signOut, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAdminOrSuper = profile?.role === 'superadmin' || profile?.role === 'admin';
  const hasPerm = (perm) => isAdminOrSuper || (profile?.permissions || []).includes(perm);

  const canViewMachines = hasPerm('machines:read') || profile?.role === 'employee';
  const canWriteMachines = hasPerm('machines:write') || profile?.role === 'employee';
  const canDeleteMachines = hasPerm('machines:delete');
  const canViewInventory = hasPerm('inventory:read') || profile?.role === 'employee';
  const canWriteInventory = hasPerm('inventory:write') || profile?.role === 'employee';
  const canDeleteInventory = hasPerm('inventory:delete');
  const canViewQuotes = hasPerm('quotes:read') || profile?.role === 'employee';
  const canViewStats = isAdminOrSuper; // explicitly blocking employee and intern
  const canViewUsers = isAdminOrSuper;

  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('Lösenordet måste vara minst 6 tecken långt.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Lösenorden matchar inte.');
      return;
    }

    setIsUpdatingPassword(true);
    const { error: updateErr } = await updatePassword(newPassword);
    setIsUpdatingPassword(false);

    if (updateErr) {
      setPasswordError(updateErr.message);
    } else {
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(false);
      }, 2000);
    }
  };

  const validTabs = [
    canViewMachines && 'machines',
    canViewInventory && 'inventory',
    canViewQuotes && 'quotes',
    canViewStats && 'stats',
    canViewStats && 'sales',
    canViewUsers && 'users'
  ].filter(Boolean);

  const tabParam = searchParams.get('tab');
  const activeTab = validTabs.includes(tabParam) 
    ? (tabParam === 'sales' ? 'stats' : tabParam) 
    : (validTabs[0] || '');
  const [statsSubTab, setStatsSubTab] = useState(tabParam === 'sales' ? 'sales' : 'statistics');

  const handleTabChange = (tab) => {
    setSearchParams(prev => {
      prev.set('tab', tab);
      return prev;
    });
    setStatusFilter('all');
  };

  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'published' | 'draft' | 'reserved' | 'sold'
  const [searchQuery, setSearchQuery] = useState('');
  const [machines, setMachines]     = useState([]);
  const [inventory, setInventory]   = useState([]);
  const [newQuotesCount, setNewQuotesCount] = useState(0);
  const [unreadRepliesCount, setUnreadRepliesCount] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [toDelete, setToDelete]     = useState(null);   // item to confirm delete
  const [deleting, setDeleting]     = useState(false);

  const loadRequestId = React.useRef(0);

  const load = useCallback(async (isSilent = false) => {
    const reqId = ++loadRequestId.current;
    
    if (!isSilent) setLoading(true);
    if (reqId === loadRequestId.current) setError('');
    
    // Load machines
    const { data: mData, error: mErr } = await getMachines();
    
    if (reqId !== loadRequestId.current) return;
    
    if (mErr) {
      setError('Kunde inte hämta maskiner: ' + mErr.message);
      
      // JWT ISSUED AT FUTURE DIAGNOSTICS
      if (mErr.message.includes('future') && session) {
        try {
          const payload = JSON.parse(atob(session.access_token.split('.')[1]));
          console.log("--- JWT ISSUED AT FUTURE DIAGNOSTICS ---");
          console.log("Session exists:", !!session);
          console.log("User ID:", session.user?.id);
          console.log("Token issued-at (iat):", new Date(payload.iat * 1000).toISOString(), `(${payload.iat})`);
          console.log("Token expiry (exp):", new Date(payload.exp * 1000).toISOString(), `(${payload.exp})`);
          console.log("Current client time:", new Date().toISOString(), `(${Math.floor(Date.now() / 1000)})`);
          console.log("Clock diff (client - iat):", Math.floor(Date.now() / 1000) - payload.iat, "seconds");
          console.log("----------------------------------------");
        } catch(e) {
          console.error("Could not parse JWT for diagnostics", e);
        }
      }
    } else {
      setMachines(mData ?? []);
    }

    // Load inventory
    const { data: iData, error: iErr } = await getInventoryItems();
    if (reqId !== loadRequestId.current) return;
    
    if (iErr) {
      setError((prev) => prev ? prev + ' | ' + iErr.message : 'Kunde inte hämta lösöre: ' + iErr.message);
    } else {
      setInventory(iData ?? []);
    }
    
    // Check new quotes count
    const { data: qData } = await getQuoteRequests();
    if (reqId !== loadRequestId.current) return;
    
    if (qData) {
      setNewQuotesCount(qData.filter(q => q.status === 'new').length);

      const actionCount = qData.filter(q => {
        if (q.status === 'new') return false; // Handled by newQuotesCount
        if (q.status === 'completed' || q.status === 'archived') return false;
        const sorted = [...(q.messages || [])].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        const last = sorted[sorted.length - 1];
        return last?.sender_type === 'customer';
      }).length;

      setUnreadRepliesCount(actionCount);
    }
    
    if (!isSilent) setLoading(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const handleQuotesUpdated = useCallback((newCount, actionCount) => {
    if (newCount !== undefined) setNewQuotesCount(newCount);
    if (actionCount !== undefined) setUnreadRepliesCount(actionCount);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login', { replace: true });
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    
    const isMachine = toDelete.itemType === 'machine';
    
    if (isMachine) {
      const { error: err } = await deleteMachine(toDelete.id);
      if (err) {
        setError('Radering misslyckades: ' + err.message);
      } else {
        setMachines(prev => prev.filter(m => m.id !== toDelete.id));
      }
    } else {
      const { error: err } = await deleteInventoryItem(toDelete.id);
      if (err) {
        setError('Radering misslyckades: ' + err.message);
      } else {
        setInventory(prev => prev.filter(i => i.id !== toDelete.id));
      }
    }
    
    setDeleting(false);
    setToDelete(null);
  };

  // Stats
  const stats = {
    total:     machines.length,
    published: machines.filter(m => m.status === 'published').length,
    draft:     machines.filter(m => m.status === 'draft').length,
    reserved:  machines.filter(m => m.status === 'reserved').length,
    sold:      machines.filter(m => m.status === 'sold').length,
  };
  
  const inventoryStats = {
    total:     inventory.length,
    published: inventory.filter(i => i.status === 'published').length,
    draft:     inventory.filter(i => i.status === 'draft').length,
    reserved:  inventory.filter(i => i.status === 'reserved').length,
    sold:      inventory.filter(i => i.status === 'sold').length,
  };

  const statusSortOrder = { draft: 1, reserved: 2, published: 3, sold: 4 };

  const filteredMachines = machines.filter(m => {
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    if (!matchesStatus) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.slug && m.slug.toLowerCase().includes(q)) ||
      (m.type && m.type.toLowerCase().includes(q)) ||
      (m.brand && m.brand.toLowerCase().includes(q)) ||
      (m.model && m.model.toLowerCase().includes(q)) ||
      (m.description && m.description.toLowerCase().includes(q)) ||
      (m.description_en && m.description_en.toLowerCase().includes(q))
    );
  }).sort((a, b) => (statusSortOrder[a.status] || 99) - (statusSortOrder[b.status] || 99));

  const filteredInventory = inventory.filter(m => {
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    if (!matchesStatus) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.description && m.description.toLowerCase().includes(q)) ||
      (m.category && m.category.toLowerCase().includes(q)) ||
      (m.description_en && m.description_en.toLowerCase().includes(q))
    );
  }).sort((a, b) => (statusSortOrder[a.status] || 99) - (statusSortOrder[b.status] || 99));

  const headerActionsRender = (
    <>
            <button
              onClick={toggleTheme}
              aria-label="Byt tema"
              className="admin-action-btn"
              style={{
                color: 'var(--text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.5rem',
              }}
            >
              {isLightMode ? <Moon size={20} /> : <Sun size={20} />} <span className="admin-show-mobile-text" style={{ marginLeft: '0.4rem' }}>Byt tema</span>
            </button>
            <Link
              to="/admin/profile"
              title="Min profil"
              className="admin-action-btn"
              onClick={() => setIsMobileMenuOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'none' }}
            >
              <User size={15} /><span className="admin-hide-mobile">Min profil</span><span className="admin-show-mobile-text">Min profil</span>
            </Link>
            <button
              onClick={() => { setShowPasswordModal(true); setIsMobileMenuOpen(false); }}
              title="Byt lösenord"
              className="admin-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer' }}
            >
              <Lock size={15} /><span className="admin-hide-mobile">Byt lösenord</span><span className="admin-show-mobile-text">Byt lösenord</span>
            </button>
            <button
              id="admin-logout-btn"
              onClick={handleSignOut}
              className="admin-action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer' }}
            >
              <LogOut size={15} /><span className="admin-hide-mobile">Logga ut</span><span className="admin-show-mobile-text">Logga ut</span>
            </button>
    </>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top bar ── */}
      <header style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          <Link to="/admin" style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.01em', textDecoration: 'none' }}>
            <span style={{ color: 'var(--text-primary)' }}>HAMMARÖ</span>{' '}
            <span style={{ color: 'var(--accent-primary)' }}>ADMIN</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="admin-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {headerActionsRender}
            </div>
            <button 
              className="admin-hamburger-btn" 
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Öppna meny"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Hamburger Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="admin-mobile-menu-overlay" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="admin-mobile-menu-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <Link to="/admin" style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.01em', textDecoration: 'none' }} onClick={() => setIsMobileMenuOpen(false)}>
                <span style={{ color: 'var(--text-primary)' }}>HAMMARÖ</span>{' '}
                <span style={{ color: 'var(--accent-primary)' }}>ADMIN</span>
              </Link>
              <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.4 }}>
              Inställningar
            </p>

            <div className="admin-mobile-actions">
              {headerActionsRender}
            </div>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <main style={{ flex: 1, maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Tabs */}
        <nav 
          aria-label="Huvudnavigation"
          className="admin-nav"
        >
          {(canViewMachines || canViewInventory) && (
            <button
              className="admin-nav-btn"
              data-active={activeTab === 'machines' || activeTab === 'inventory'}
              aria-current={(activeTab === 'machines' || activeTab === 'inventory') ? 'page' : undefined}
              onClick={() => handleTabChange(canViewMachines ? 'machines' : 'inventory')}
            >
              Maskiner <span style={{ opacity: 0.7, fontWeight: 400 }}>({machines.length + inventory.length})</span>
            </button>
          )}

          {canViewQuotes && (
            <button
              className="admin-nav-btn"
              data-active={activeTab === 'quotes'}
              aria-current={activeTab === 'quotes' ? 'page' : undefined}
              onClick={() => handleTabChange('quotes')}
            >
              Förfrågningar 
              {(newQuotesCount > 0 || unreadRepliesCount > 0) && (
                <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', marginLeft: '0.5rem' }}>
                  {newQuotesCount > 0 && (
                    <span className="admin-nav-badge">
                      {newQuotesCount}
                      <span className="admin-nav-badge-text"> nya</span>
                    </span>
                  )}
                  {unreadRepliesCount > 0 && (
                    <span style={{ backgroundColor: '#ef4444', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {unreadRepliesCount} åtgärd
                    </span>
                  )}
                </div>
              )}
            </button>
          )}

          {canViewStats && (
            <button
              className="admin-nav-btn"
              data-active={activeTab === 'stats'}
              aria-current={activeTab === 'stats' ? 'page' : undefined}
              onClick={() => handleTabChange('stats')}
            >
              Statistik
            </button>
          )}

          {canViewUsers && (
            <button
              className="admin-nav-btn"
              data-active={activeTab === 'users'}
              aria-current={activeTab === 'users' ? 'page' : undefined}
              onClick={() => handleTabChange('users')}
            >
              Användare
            </button>
          )}
        </nav>

        {/* Page title + add button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontFamily: 'Outfit,sans-serif', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              {(activeTab === 'machines' || activeTab === 'inventory') ? 'Maskiner & Lösöre' : activeTab === 'quotes' ? 'Förfrågningar' : 'Statistik'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
              {(activeTab === 'machines' || activeTab === 'inventory') ? 'Hantera maskinlagret och lösöre' : activeTab === 'quotes' ? 'Hantera leads och kundförfrågningar' : 'Översikt och insikter'}
            </p>
          </div>
          {activeTab === 'machines' && canWriteMachines && (
            <Link
              to="/admin/maskiner/ny"
              id="add-machine-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', backgroundColor: 'var(--accent-primary)', color: 'var(--text-inverse)', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9375rem', whiteSpace: 'nowrap' }}
            >
              <Plus size={18} />
              Lägg till maskin
            </Link>
          )}
          {activeTab === 'inventory' && canWriteInventory && (
            <Link
              to="/admin/losore/ny"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', backgroundColor: 'var(--accent-primary)', color: 'var(--text-inverse)', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9375rem', whiteSpace: 'nowrap' }}
            >
              <Plus size={18} />
              Nytt lösöre
            </Link>
          )}
        </div>

        {/* Subtabs for Machines/Inventory */}
        {(activeTab === 'machines' || activeTab === 'inventory') && (
          <div style={{ display: 'flex', width: '100%', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
            {canViewMachines && (
              <button
                onClick={() => handleTabChange('machines')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '0.75rem 0.25rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'machines' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: activeTab === 'machines' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: 'pointer',
                  marginBottom: '-1px',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                Maskiner
              </button>
            )}
            {canViewInventory && (
              <button
                onClick={() => handleTabChange('inventory')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '0.75rem 0.25rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'inventory' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: activeTab === 'inventory' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: 'pointer',
                  marginBottom: '-1px',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                Lösöre
              </button>
            )}
          </div>
        )}

        {/* Stats */}
        {activeTab !== 'quotes' && activeTab !== 'stats' && activeTab !== 'users' && (
          <div className="stat-card-container">
            <StatCard label="Totalt"      value={activeTab === 'machines' ? stats.total : inventoryStats.total}         isActive={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <StatCard label="Publicerade" value={activeTab === 'machines' ? stats.published : inventoryStats.published} accent="#22c55e" isActive={statusFilter === 'published'} onClick={() => setStatusFilter('published')} />
            <StatCard label="Utkast"      value={activeTab === 'machines' ? stats.draft : inventoryStats.draft}         accent="#6b7277" isActive={statusFilter === 'draft'} onClick={() => setStatusFilter('draft')} />
            <StatCard label="Reserverade" value={activeTab === 'machines' ? stats.reserved : inventoryStats.reserved}   accent="#f59e0b" isActive={statusFilter === 'reserved'} onClick={() => setStatusFilter('reserved')} />
            <StatCard label="Sålda"       value={activeTab === 'machines' ? stats.sold : inventoryStats.sold}           accent="#ef4444" isActive={statusFilter === 'sold'} onClick={() => setStatusFilter('sold')} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '0.875rem 1rem', marginBottom: '1.5rem', color: '#f87171', fontSize: '0.9375rem' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}><X size={16} /></button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', gap: '0.75rem', color: 'var(--text-muted)' }}>
            <div style={{ width: '24px', height: '24px', border: '2px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Hämtar data…
          </div>
        ) : (activeTab === 'machines' && machines.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '4rem 1.5rem', color: 'var(--text-muted)' }}>
            <p style={{ margin: 0, fontSize: '1rem' }}>Inga maskiner finns ännu.</p>
            <Link to="/admin/maskiner/ny" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '1rem', color: 'var(--accent-primary)', fontSize: '0.9375rem', textDecoration: 'none' }}>
              <Plus size={16} /> Lägg till din första maskin
            </Link>
          </div>
        ) : (activeTab === 'inventory' && inventory.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '4rem 1.5rem', color: 'var(--text-muted)' }}>
            <p style={{ margin: 0, fontSize: '1rem' }}>Inget lösöre finns ännu.</p>
            <Link to="/admin/losore/ny" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '1rem', color: 'var(--accent-primary)', fontSize: '0.9375rem', textDecoration: 'none' }}>
              <Plus size={16} /> Lägg till nytt lösöre
            </Link>
          </div>
        ) : activeTab === 'quotes' ? (
          <QuoteRequestsPanel onQuotesUpdated={handleQuotesUpdated} />
        ) : activeTab === 'stats' ? (
          <>
            <div style={{ display: 'flex', width: '100%', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <button
                onClick={() => setStatsSubTab('statistics')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '0.75rem 0.25rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: statsSubTab === 'statistics' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: statsSubTab === 'statistics' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: 'pointer',
                  marginBottom: '-1px',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                Allmän Statistik
              </button>
              <button
                onClick={() => setStatsSubTab('sales')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '0.75rem 0.25rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: statsSubTab === 'sales' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: statsSubTab === 'sales' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: 'pointer',
                  marginBottom: '-1px',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                Försäljning
              </button>
            </div>
            
            {statsSubTab === 'statistics' ? (
              <StatisticsPanel onNavigate={(tab, status) => {
                setSearchParams(prev => { prev.set('tab', tab); return prev; });
                setStatusFilter(status || 'all');
              }} />
            ) : (
              <SalesPanel machines={machines} inventory={inventory} />
            )}
          </>
        ) : activeTab === 'users' ? (
          <UsersPanel />
        ) : (
          /* ── Machine table ── */
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Toolbar: Search and Refresh */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
              <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '320px' }}>
                <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', display: 'flex' }}>
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  placeholder="Sök..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 2.25rem 0.5rem 2.25rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
                    aria-label="Rensa sökning"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <RefreshCw size={14} /> Uppdatera
              </button>
            </div>

            {/* Desktop table */}
            <div className="admin-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9375rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {activeTab === 'machines' ? (
                      ['Bild', 'Namn', 'Typ', 'År', 'Pris', 'Status', 'Åtgärder'].map(h => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))
                    ) : (
                      ['Bild', 'Namn', 'Kategori', 'Pris', 'Status', 'Åtgärder'].map(h => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {activeTab === 'machines' && filteredMachines.map((m, i) => {
                    const defaultImage = 'https://placehold.co/800x600/1e2123/a0a6aa?text=Bild+saknas';
                    let thumbUrl = defaultImage;
                    if (m.machine_images && m.machine_images.length > 0) {
                      const primary = m.machine_images.find(img => img.is_primary);
                      thumbUrl = primary ? primary.image_url : m.machine_images[0].image_url;
                    }
                    return (
                    <tr key={m.id} style={{ borderBottom: i < filteredMachines.length - 1 ? '1px solid var(--border-color)' : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.875rem 1rem', width: '60px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                          <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)', fontWeight: 500, maxWidth: '220px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{m.slug}</div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {m.type ? (translations.sv.machinery.types[m.type] || m.type) : '–'}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{m.year || '–'}</td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {m.price != null ? `${m.price.toLocaleString('sv-SE')} kr` : '–'}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <StatusBadge status={m.status} />
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {canWriteMachines && (
                            <Link
                              to={`/admin/maskiner/${m.id}`}
                              title="Redigera"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '0.8125rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
                            >
                              <Pencil size={13} /> Redigera
                            </Link>
                          )}
                          {canDeleteMachines && (
                            <button
                              onClick={() => setToDelete({ ...m, itemType: 'machine' })}
                              title="Ta bort"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#f87171', fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              <Trash2 size={13} /> Ta bort
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}

                  {activeTab === 'inventory' && filteredInventory.map((m, i) => {
                    const defaultImage = 'https://placehold.co/800x600/1e2123/a0a6aa?text=Bild+saknas';
                    let thumbUrl = defaultImage;
                    if (m.inventory_images && m.inventory_images.length > 0) {
                      const primary = m.inventory_images.find(img => img.is_primary);
                      thumbUrl = primary ? primary.image_url : m.inventory_images[0].image_url;
                    }
                    return (
                    <tr key={m.id} style={{ borderBottom: i < filteredInventory.length - 1 ? '1px solid var(--border-color)' : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.875rem 1rem', width: '60px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                          <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)', fontWeight: 500, maxWidth: '220px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {m.category ? translations.sv.inventory.categories[m.category] : translations.sv.inventory.categories.other}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {m.price != null ? `${m.price.toLocaleString('sv-SE')} kr` : '–'}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <StatusBadge status={m.status} type="inventory" />
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {canWriteInventory && (
                            <Link
                              to={`/admin/losore/${m.id}`}
                              title="Redigera"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '0.8125rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
                            >
                              <Pencil size={13} /> Redigera
                            </Link>
                          )}
                          {canDeleteInventory && (
                            <button
                              onClick={() => setToDelete({ ...m, itemType: 'inventory' })}
                              title="Ta bort"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#f87171', fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              <Trash2 size={13} /> Ta bort
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list (shown instead of table on small screens) */}
            <div className="admin-card-list">
              {activeTab === 'machines' && filteredMachines.map(m => {
                const defaultImage = 'https://placehold.co/800x600/1e2123/a0a6aa?text=Bild+saknas';
                let thumbUrl = defaultImage;
                if (m.machine_images && m.machine_images.length > 0) {
                  const primary = m.machine_images.find(img => img.is_primary);
                  thumbUrl = primary ? primary.image_url : m.machine_images[0].image_url;
                }
                return (
                <div key={m.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                        <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>{m.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {m.type ? (translations.sv.machinery.types[m.type] || m.type) : ''}
                          {m.year ? ` • ${m.year}` : ''}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                  {m.price != null && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      {m.price.toLocaleString('sv-SE')} kr
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {canWriteMachines && (
                      <Link to={`/admin/maskiner/${m.id}`} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.5rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '0.8125rem', textDecoration: 'none' }}>
                        <Pencil size={13} /> Redigera
                      </Link>
                    )}
                    {canDeleteMachines && (
                      <button onClick={() => setToDelete({ ...m, itemType: 'machine' })} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.5rem', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#f87171', fontSize: '0.8125rem', cursor: 'pointer' }}>
                        <Trash2 size={13} /> Ta bort
                      </button>
                    )}
                  </div>
                </div>
                );
              })}

              {activeTab === 'inventory' && filteredInventory.map(m => {
                const defaultImage = 'https://placehold.co/800x600/1e2123/a0a6aa?text=Bild+saknas';
                let thumbUrl = defaultImage;
                if (m.inventory_images && m.inventory_images.length > 0) {
                  const primary = m.inventory_images.find(img => img.is_primary);
                  thumbUrl = primary ? primary.image_url : m.inventory_images[0].image_url;
                }
                return (
                <div key={m.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                        <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>{m.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {m.category ? translations.sv.inventory.categories[m.category] : translations.sv.inventory.categories.other}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={m.status} type="inventory" />
                  </div>
                  {m.price != null && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      {m.price.toLocaleString('sv-SE')} kr
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {canWriteInventory && (
                      <Link to={`/admin/losore/${m.id}`} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.5rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '0.8125rem', textDecoration: 'none' }}>
                        <Pencil size={13} /> Redigera
                      </Link>
                    )}
                    {canDeleteInventory && (
                      <button onClick={() => setToDelete({ ...m, itemType: 'inventory' })} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.5rem', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#f87171', fontSize: '0.8125rem', cursor: 'pointer' }}>
                        <Trash2 size={13} /> Ta bort
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── Delete modal ── */}
      {toDelete && (
        <DeleteModal
          machine={toDelete}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
          deleting={deleting}
        />
      )}

      {/* ── Change Password Modal ── */}
      {showPasswordModal && (
        <div style={modal.overlay} onClick={() => setShowPasswordModal(false)}>
          <div style={modal.box} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontFamily: 'Outfit,sans-serif', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Byt lösenord</h2>
              <button onClick={() => setShowPasswordModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>

            {passwordError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', color: '#f87171', fontSize: '0.875rem' }}>
                <AlertTriangle size={16} />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(34,197,94,0.25)' }}>
                Lösenordet har uppdaterats!
              </div>
            )}

            <form onSubmit={handleUpdatePassword}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Nytt lösenord
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Bekräfta nytt lösenord
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowPasswordModal(false)} style={modal.cancelBtn}>Avbryt</button>
                <button type="submit" disabled={isUpdatingPassword || !newPassword || !confirmNewPassword} style={modal.deleteBtn}>
                  {isUpdatingPassword ? 'Sparar...' : 'Spara'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 767px) { .admin-hide-mobile { display: none !important; } }
        
        /* Hamburger Menu Actions (Mobile < 768px) */
        .admin-hamburger-btn { display: none; background: none; border: none; color: var(--text-primary); cursor: pointer; padding: 0.25rem; }
        .admin-show-mobile-text { display: none; }
        
        @media (max-width: 767px) {
          .admin-hamburger-btn { display: flex; align-items: center; justify-content: center; }
          .admin-header-actions { display: none !important; }
          .admin-show-mobile-text { display: inline; }
          
          .admin-mobile-menu-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.5); z-index: 1000;
          }
          .admin-mobile-menu-content {
            position: absolute; right: 0; top: 0;
            width: 80%; max-width: 320px; height: 100%; background-color: var(--bg-surface);
            padding: 1.5rem; display: flex; flex-direction: column; overflow-y: auto;
            border-left: 1px solid var(--border-color);
            box-shadow: -2px 0 12px rgba(0,0,0,0.2);
            animation: slideInRight 0.3s ease-out;
          }
          .admin-mobile-actions { display: flex; flex-direction: column; gap: 0.5rem; }
          .admin-mobile-actions > * { 
            justify-content: flex-start !important; 
            border: 1px solid var(--border-color) !important; 
            padding: 0.75rem 1rem !important; 
            font-size: 1rem !important; 
            width: 100% !important;
          }
        }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }

        /* Mobile: hide table, show card list */
        @media (max-width: 767px) {
          .admin-table-wrap { display: none; }
          .admin-card-list  { display: block; }
        }
        /* Desktop: show table, hide card list */
        @media (min-width: 768px) {
          .admin-table-wrap { display: block; overflow-x: auto; }
          .admin-card-list  { display: none; }
        }
        /* Responsive Admin Navigation */
        .admin-nav {
          display: grid;
          grid-template-columns: 1fr 1fr;
          margin-left: -1.5rem;
          margin-right: -1.5rem;
          padding: 0 1rem;
          gap: 0.5rem;
          margin-bottom: 2rem;
        }
        .admin-nav-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          padding: 0 0.5rem;
          border-radius: 8px;
          font-weight: 500;
          font-size: 0.8125rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          min-height: 44px;
        }
        .admin-nav-btn[data-active="true"] {
          background: var(--text-primary);
          color: var(--bg-primary);
          border: 1px solid var(--text-primary);
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .admin-nav-btn[data-active="false"] {
          background: var(--bg-surface);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }
        .admin-nav-badge {
          background-color: #ef4444;
          color: #fff;
          border-radius: 12px;
          font-size: 0.65rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          box-sizing: border-box;
        }
        .admin-nav-badge-text {
          display: none;
        }
        @media (max-width: 359px) {
          .admin-nav {
            gap: 0.25rem;
            padding: 0 0.5rem;
          }
          .admin-nav-btn {
            padding: 0 0.25rem;
            gap: 0.15rem;
            font-size: 0.75rem;
          }
        }
        @media (min-width: 768px) {
          .admin-nav {
            display: flex;
            margin-left: 0;
            margin-right: 0;
            padding: 0;
            gap: 0.75rem;
            margin-bottom: 2.5rem;
          }
          .admin-nav-btn {
            flex: 0 0 auto;
            padding: 0 1.5rem;
            font-size: 0.9375rem;
            gap: 0.5rem;
          }
          .admin-nav-badge {
            min-width: auto;
            height: auto;
            padding: 0.15rem 0.5rem;
            font-size: 0.75rem;
          }
          .admin-nav-badge-text {
            display: inline;
            white-space: pre;
          }
        }
        
        /* Responsive Stat Cards */
        .stat-card-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .stat-card {
          padding: 1.25rem 1.5rem;
          border-radius: 12px;
          text-align: left;
        }
        .stat-card-value {
          font-size: 2rem;
        }
        .stat-card-label {
          font-size: 0.8125rem;
          margin-top: 0.4rem;
        }
        
        @media (max-width: 767px) {
          .stat-card-container {
            grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
            gap: 0.4rem;
            margin-bottom: 1.5rem;
          }
          .stat-card {
            padding: 0.6rem 0.3rem;
            border-radius: 8px;
            text-align: center;
            min-width: 0;
          }
          .stat-card-value {
            font-size: 1.2rem;
          }
          .stat-card-label {
            font-size: 0.65rem;
            margin-top: 0.25rem;
            word-break: break-word;
            white-space: normal;
            line-height: 1.1;
          }
        }
        @media (max-width: 340px) {
          .stat-card-container {
            grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
