import React, { useState, useEffect, useCallback } from 'react';
import {
  getQuoteRequests,
  updateQuoteStatus,
  QUOTE_STATUS_OPTIONS,
  getQuoteStatusLabel,
  getQuoteStatusColor,
  deleteQuoteRequest,
  sendQuoteReply,
  markCustomerMessagesAsRead
} from '../../lib/quoteService';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Search, Mail, Phone, ExternalLink, X, Calendar, User, Tag, FileText, Paperclip, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import translations from '../../i18n/translations';

// ─── Status Badge ─────────────────────────────────────────────────────────────
const LeadStatusBadge = ({ status }) => {
  const label = getQuoteStatusLabel(status);
  const color = getQuoteStatusColor(status);

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

// ─── Attachment Preview Component ─────────────────────────────────────────────
const AttachmentPreview = ({ att, isCustomer }) => {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (att.type?.startsWith('image/') || att.name.match(/\.(jpg|jpeg|png)$/i)) {
      supabase.storage.from('quote-attachments').createSignedUrl(att.path, 3600).then(({ data, error }) => {
        console.log('[ATTACHMENT DEBUG]', {
          path: att.path,
          data,
          error
        });
        if (data && !error) setUrl(data.signedUrl);
      });
    }
  }, [att.path, att.name, att.type]);

  if (url) {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem', padding: '0.4rem', backgroundColor: isCustomer ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={att.name} style={{ display: 'block', width: '120px', height: '120px', borderRadius: '4px', objectFit: 'cover' }} />
        </a>
        <div className="break-word" style={{ fontSize: '0.75rem', color: isCustomer ? 'var(--text-muted)' : 'rgba(255,255,255,0.8)', maxWidth: '120px' }}>
          {att.name} ({(att.size / 1024).toFixed(0)} KB)
        </div>
      </div>
    );
  }

  return (
    <a
      href="#"
      onClick={async (e) => {
        e.preventDefault();
        const { data } = await supabase.storage.from('quote-attachments').createSignedUrl(att.path, 3600);
        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
      }}
      className="break-word"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', padding: '0.3rem 0.6rem', backgroundColor: isCustomer ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)', borderRadius: '4px', textDecoration: 'none', color: 'inherit' }}
    >
      <Paperclip size={12} style={{ flexShrink: 0 }} /> {att.name} ({(att.size / 1024).toFixed(0)} KB)
    </a>
  );
};

// ─── Main Panel Component ─────────────────────────────────────────────────────
const QuoteRequestsPanel = ({ onQuotesUpdated }) => {
  const { profile } = useAuth();
  const isAdminOrSuper = profile?.role === 'superadmin' || profile?.role === 'admin';
  const isEmployee = profile?.role === 'employee';

  // Mirrors the has_permission() PostgreSQL function exactly.
  // employee implicitly has: machines:read/write, inventory:read/write, quotes:read/write
  // employee does NOT have: quotes:delete, machines:delete, inventory:delete, any users:*, statistics:read
  // admin has: everything except users:delete, roles:superadmin
  // superadmin: everything
  // intern: read-only via explicit permissions array only
  const hasPerm = (perm) => {
    if (isAdminOrSuper) return true;
    if (isEmployee) {
      // Employee is explicitly denied delete and admin-level permissions
      if (perm.endsWith(':delete') || perm.startsWith('users:') || perm.startsWith('roles:') || perm === 'statistics:read') return false;
      // Employee has implicit read+write access to operational tables
      if (perm.startsWith('machines:') || perm.startsWith('inventory:') || perm.startsWith('quotes:')) return true;
      return false;
    }
    // intern and others: check explicit permissions array only
    return (profile?.permissions || []).includes(perm);
  };
  const canWriteQuotes = hasPerm('quotes:write');
  const canDeleteQuotes = hasPerm('quotes:delete');

  const [searchParams, setSearchParams] = useSearchParams();
  const quoteIdParam = searchParams.get('quote');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, new, contacted, completed, archived
  const [typeFilter, setTypeFilter] = useState('all'); // all, machine, inventory, workshop, contact, other
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    // Lyssnar på det globala notis-eventet
    const handleNewMessage = () => loadRequests(true);
    window.addEventListener('admin_quote_message_inserted', handleNewMessage);

    return () => {
      window.removeEventListener('admin_quote_message_inserted', handleNewMessage);
    };
  }, []);

  const [replyText, setReplyText] = useState(() => sessionStorage.getItem('quote_reply_text') || '');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [replySuccess, setReplySuccess] = useState(false);
  const [replyEmailStatus, setReplyEmailStatus] = useState(''); // message from backend about email

  const [openDropdown, setOpenDropdown] = useState(null);
  const filterMenuRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Keep selectedRequest synced with URL parameter ?quote=ID
  useEffect(() => {
    if (quoteIdParam && requests.length > 0) {
      const req = requests.find(r => r.id === quoteIdParam);
      if (req && (!selectedRequest || selectedRequest.id !== req.id)) {
        setSelectedRequest(req);
      }
    } else if (!quoteIdParam && selectedRequest) {
      setSelectedRequest(null);
    }
  }, [quoteIdParam, requests, selectedRequest]);

  const handleOpenQuote = (req) => {
    setSearchParams(prev => { prev.set('quote', req.id); return prev; }, { replace: true });
  };

  const handleCloseQuote = () => {
    setSearchParams(prev => { prev.delete('quote'); return prev; }, { replace: true });
  };

  // Clear reply state when changing selected request
  useEffect(() => {
    // Only clear if we actually switch requests, not on mount.
    // We already read from sessionStorage on initial load.
    if (selectedRequest?.id) {
      const savedText = sessionStorage.getItem(`quote_reply_text_${selectedRequest.id}`);
      setReplyText(savedText || '');
    }
    setReplyError('');
    setReplySuccess(false);
    setReplyEmailStatus('');
    setSelectedFiles([]);
  }, [selectedRequest?.id]);

  useEffect(() => {
    if (selectedRequest?.id) {
      sessionStorage.setItem(`quote_reply_text_${selectedRequest.id}`, replyText);
    }
  }, [replyText, selectedRequest?.id]);

  useEffect(() => {
    if (!requests) return;
    const newCount = requests.filter(q => q.status === 'new').length;
    const actionCount = requests.filter(q => {
      if (q.status === 'new') return false;
      if (q.status === 'completed' || q.status === 'archived') return false;
      const sorted = [...(q.messages || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const last = sorted[sorted.length - 1];
      return last?.sender_type === 'customer';
    }).length;

    if (onQuotesUpdated) onQuotesUpdated(newCount, actionCount);
  }, [requests, onQuotesUpdated]);

  const loadRequests = useCallback(async (silent = false) => {
    const isSilent = silent === true;
    if (!isSilent) setLoading(true);
    setError('');
    const { data, error: err } = await getQuoteRequests();
    if (err) {
      setError('Kunde inte hämta förfrågningar: ' + err.message);
    } else {
      setRequests(data ?? []);

      // Auto-update selectedRequest if it's currently open
      setSelectedRequest(prev => {
        if (!prev) return null;
        const updatedReq = data?.find(r => r.id === prev.id);
        return updatedReq || prev;
      });
    }
    if (!isSilent) setLoading(false);
  }, []);

  useEffect(() => {
    loadRequests();


    const channelRequests = supabase
      .channel('public:quote_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'quote_requests' },
        (payload) => {
          loadRequests(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelRequests);
    };
  }, [loadRequests]);

  const handleStatusChange = async (id, newStatus) => {
    const { data, error: err } = await updateQuoteStatus(id, newStatus);
    if (err) {
      setError('Kunde inte uppdatera status: ' + err.message);
    } else if (data) {
      setRequests(prev => prev.map(req => req.id === id ? { ...req, status: data.status } : req));
      if (selectedRequest && selectedRequest.id === id) {
        setSelectedRequest({ ...selectedRequest, status: data.status });
      }
    }
  };

  const handleDelete = async (id) => {
    const { error: err } = await deleteQuoteRequest(id);
    if (err) {
      setError('Kunde inte radera förfrågan: ' + err.message);
      setConfirmDelete(null);
    } else {
      setRequests(prev => prev.filter(req => req.id !== id));
      setSelectedRequest(null);
      setConfirmDelete(null);
      if (onQuotesUpdated) onQuotesUpdated();
    }
  };

  const handleSendReply = async () => {
    if ((!replyText.trim() && selectedFiles.length === 0) || !selectedRequest) return;

    setIsSendingReply(true);
    setReplyError('');
    setReplySuccess(false);
    setReplyEmailStatus('');

    let uploadedPaths = [];

    try {
      // 1. Ladda upp filer till Storage
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${selectedRequest.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('quote-attachments')
            .upload(filePath, file);

          if (uploadError) {
            throw new Error(`Kunde inte ladda upp filen ${file.name}: ${uploadError.message}`);
          }

          uploadedPaths.push({
            path: filePath,
            name: file.name,
            size: file.size,
            type: file.type
          });
        }
      }

      // 2. Skicka svaret via Edge Function
      const { data, error: err } = await sendQuoteReply(selectedRequest.id, replyText, uploadedPaths);

      if (err) {
        throw new Error(err.message || 'Okänt fel vid skickande.');
      }

      // 3. Vid framgång, uppdatera UI
      setReplySuccess(true);
      setReplyEmailStatus(data.email_message || '');
      setReplyText('');
      setSelectedFiles([]);

      const newMessage = data.message;

      if (newMessage) {
        setSelectedRequest(prev => {
          const existingMessages = prev.messages || [];
          const exists = existingMessages.some(m => m.id === newMessage.id);
          return {
            ...prev,
            messages: exists ? existingMessages : [...existingMessages, newMessage],
            status: prev.status === 'new' ? 'contacted' : prev.status
          };
        });

        setRequests(prev => prev.map(req => {
          if (req.id === selectedRequest.id) {
            const existingMessages = req.messages || [];
            const exists = existingMessages.some(m => m.id === newMessage.id);
            return {
              ...req,
              messages: exists ? existingMessages : [...existingMessages, newMessage],
              status: req.status === 'new' ? 'contacted' : req.status
            };
          }
          return req;
        }));
      }
    } catch (err) {
      setReplyError(err.message);

      // Cleanup orphaned files om Edge Function misslyckades
      if (uploadedPaths.length > 0) {
        const pathsToRemove = uploadedPaths.map(p => p.path);
        await supabase.storage.from('quote-attachments').remove(pathsToRemove);
      }
    } finally {
      setIsSendingReply(false);
    }
  };

  const getSortScore = (req) => {
    const isClosed = req.status === 'completed' || req.status === 'archived';
    if (!isClosed) {
      const sorted = [...(req.messages || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const lastMsg = sorted[sorted.length - 1];
      if (lastMsg?.sender_type === 'customer') return 1;
    }
    if (req.status === 'new') return 2;
    if (req.status === 'contacted') return 3;
    if (req.status === 'completed') return 4;
    if (req.status === 'archived') return 5;
    return 99;
  };

  const filteredRequests = requests.filter(req => {
    // Status filter
    let statusMatch = false;
    if (filter === 'all') {
      statusMatch = true;
    } else if (filter === 'needs_reply') {
      const isClosed = req.status === 'completed' || req.status === 'archived';
      if (isClosed) {
        statusMatch = false;
      } else {
        const sorted = [...(req.messages || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const lastMsg = sorted[sorted.length - 1];
        statusMatch = lastMsg?.sender_type === 'customer';
      }
    } else {
      statusMatch = req.status === filter;
    }

    // Type filter
    let typeMatch = true;
    if (typeFilter !== 'all') {
      const workshopTypes = ['workshop', 'metalwork', 'custom', 'repair', 'boat_trailer', 'special_trailer'];
      if (typeFilter === 'workshop') {
        typeMatch = workshopTypes.includes(req.request_type);
      } else if (typeFilter === 'other') {
        typeMatch = !['machine', 'inventory', 'contact', 'transport', 'sell_machine', 'requested', ...workshopTypes].includes(req.request_type);
      } else {
        typeMatch = req.request_type === typeFilter;
      }
    }

    return statusMatch && typeMatch;
  }).sort((a, b) => {
    const scoreA = getSortScore(a);
    const scoreB = getSortScore(b);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const getTypeLabel = (type) => {
    if (type === 'workshop') return 'Verkstad & Smide';
    return translations.sv.quote.types[type] || type;
  };

  const TYPE_OPTIONS = [
    { value: 'machine', label: 'Maskin' },
    { value: 'inventory', label: 'Lösöre' },
    { value: 'workshop', label: 'Verkstad & Smide' },
    { value: 'transport', label: 'Transport' },
    { value: 'sell_machine', label: 'Sälj maskin' },
    { value: 'requested', label: 'Efterfrågas' },
    { value: 'contact', label: 'Kontakt' },
    { value: 'other', label: 'Annat' }
  ];

  return (
    <div>
      {/* ─── Filters & Refresh ─── */}
      <style>{`
        .quotes-filters-desktop { display: none; }
        .quotes-filters-mobile {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          position: relative;
        }
        @media (min-width: 768px) {
          .quotes-filters-desktop { display: flex; }
          .quotes-filters-mobile { display: none; }
        }
        .filter-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 0.5rem;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          z-index: 100;
          width: 220px;
          max-height: 300px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          padding: 0.5rem;
          gap: 0.25rem;
        }
        .filter-dropdown-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.6rem 0.8rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
          cursor: pointer;
          white-space: nowrap;
          flex: 1;
        }
        .filter-dropdown-btn.active {
          border-color: var(--text-primary);
          background: var(--text-primary);
          color: var(--bg-primary);
        }

        /* Mobile layout for Quotes (<480px) */
        @media (max-width: 479px) {
          .quote-list-item-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.5rem !important;
          }
          .quote-list-item-top {
            order: 1;
            width: 100%;
            justify-content: flex-end !important;
            margin-bottom: 0.25rem;
          }
          .quote-list-item-mid {
            order: 2;
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 0 !important;
            align-items: flex-start !important;
          }
          .quote-list-item-mid-date {
            order: 2;
          }
          .quote-list-item-mid-name {
            order: 1;
            font-size: 1.1rem !important;
          }
          .quote-list-item-bot {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.2rem !important;
          }
          .quote-modal-customer-grid {
            grid-template-columns: 1fr !important;
            gap: 0.75rem !important;
          }
          .quote-modal-product-flex {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .quote-msg-bubble {
            max-width: 95% !important;
          }
          .quote-msg-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.25rem !important;
          }
          .break-word {
            word-wrap: break-word;
            overflow-wrap: anywhere;
            min-width: 0;
          }
        }
      `}</style>

      {/* Mobile Filters */}
      <div className="quotes-filters-mobile" ref={filterMenuRef}>
        <button
          className={`filter-dropdown-btn ${openDropdown === 'status' ? 'active' : ''}`}
          onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
        >
          {filter === 'all' ? 'Status' : `Status: ${QUOTE_STATUS_OPTIONS.find(o => o.value === filter)?.label || 'Alla'}`}
          <span style={{ fontSize: '0.7rem', marginLeft: '0.4rem' }}>{openDropdown === 'status' ? '▴' : '▾'}</span>
        </button>

        <button
          className={`filter-dropdown-btn ${openDropdown === 'type' ? 'active' : ''}`}
          onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
        >
          {typeFilter === 'all' ? 'Typ' : `Typ: ${TYPE_OPTIONS.find(o => o.value === typeFilter)?.label || 'Alla'}`}
          <span style={{ fontSize: '0.7rem', marginLeft: '0.4rem' }}>{openDropdown === 'type' ? '▴' : '▾'}</span>
        </button>

        <button onClick={loadRequests} style={{ padding: '0.6rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Uppdatera">
          <RefreshCw size={16} />
        </button>

        {openDropdown === 'status' && (
          <div className="filter-dropdown-menu">
            <button
              onClick={() => { setFilter('all'); setOpenDropdown(null); }}
              style={{ ...filterBtnStyle(filter === 'all'), justifyContent: 'flex-start', border: 'none', borderRadius: '4px' }}
            >
              Alla
            </button>
            {QUOTE_STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setFilter(opt.value); setOpenDropdown(null); }}
                style={{ ...filterBtnStyle(filter === opt.value), justifyContent: 'flex-start', border: 'none', borderRadius: '4px' }}
              >
                {opt.label}
                {opt.value === 'new' && (
                  <span style={{ marginLeft: 'auto', backgroundColor: '#ef4444', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '999px', fontSize: '0.7rem' }}>
                    {requests.filter(r => r.status === 'new').length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {openDropdown === 'type' && (
          <div className="filter-dropdown-menu" style={{ left: 'auto', right: '3rem' }}>
            <button
              onClick={() => { setTypeFilter('all'); setOpenDropdown(null); }}
              style={{ ...filterBtnStyle(typeFilter === 'all'), justifyContent: 'flex-start', border: 'none', borderRadius: '4px' }}
            >
              Alla
            </button>
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setTypeFilter(opt.value); setOpenDropdown(null); }}
                style={{ ...filterBtnStyle(typeFilter === opt.value), justifyContent: 'flex-start', border: 'none', borderRadius: '4px' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Filters */}
      <div className="quotes-filters-desktop" style={{ flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingBottom: '0.2rem' }}>
              <button
                onClick={() => setFilter('all')}
                style={filterBtnStyle(filter === 'all')}
              >
                Alla
              </button>
              {QUOTE_STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  style={filterBtnStyle(filter === opt.value)}
                >
                  {opt.label}
                  {opt.value === 'new' && (
                    <span style={{ marginLeft: '0.4rem', backgroundColor: '#ef4444', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '999px', fontSize: '0.7rem' }}>
                      {requests.filter(r => r.status === 'new').length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => loadRequests(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer', marginTop: '1.5rem' }}>
            <RefreshCw size={14} /> Uppdatera
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Typ</span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingBottom: '0.2rem' }}>
            <button
              onClick={() => setTypeFilter('all')}
              style={filterBtnStyle(typeFilter === 'all')}
            >
              Alla
            </button>
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                style={filterBtnStyle(typeFilter === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </div>
      )}

      {/* ─── List / Table ─── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '1rem 1.25rem',
              backgroundColor: 'var(--bg-surface)',
              opacity: 1 - i * 0.15,
              animation: 'skeletonPulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.08}s`,
            }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ width: 60, height: 12, borderRadius: 6, background: 'var(--border-color)' }} />
                <div style={{ flex: 1, height: 12, borderRadius: 6, background: 'var(--border-color)' }} />
                <div style={{ width: 48, height: 20, borderRadius: 999, background: 'var(--border-color)' }} />
              </div>
              <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem' }}>
                <div style={{ width: 120, height: 10, borderRadius: 6, background: 'var(--border-color)' }} />
                <div style={{ width: 80, height: 10, borderRadius: 6, background: 'var(--border-color)' }} />
              </div>
            </div>
          ))}
          <style>{`@keyframes skeletonPulse { 0%,100%{opacity:1} 50%{opacity:0.45} }`}</style>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1.5rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          Inga förfrågningar hittades för detta filter.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredRequests.map(req => {
            const isNew = req.status === 'new';
            const date = new Date(req.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });

            return (
              <div
                key={req.id}
                onClick={() => {
                  handleOpenQuote(req);
                  const hasUnread = req.messages?.some(m => m.sender_type === 'customer' && m.is_read === false);
                  if (hasUnread) {
                    markCustomerMessagesAsRead(req.id).then(({ error }) => {
                      if (error) {
                        console.error("Kunde inte markera meddelanden som lästa i databasen.", error);
                        return; // Avbryt och behåll state som 'oläst' (Nytt svar) i UI.
                      }

                      setRequests(prev => prev.map(r => r.id === req.id ? {
                        ...r,
                        messages: r.messages.map(m => m.sender_type === 'customer' ? { ...m, is_read: true } : m)
                      } : r));

                      // This will automatically sync via the useEffect monitoring `requests`
                    });
                  }
                }}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: isNew ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  borderLeft: isNew ? '4px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '1rem 1.25rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                {/* ─── Quote List Item Top / Middle / Bottom ─── */}
                <div className="quote-list-item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

                  {/* Rad 2 (Mobil) / Vänster (Desktop): Datum & Namn */}
                  <div className="quote-list-item-mid" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="quote-list-item-mid-date" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', minWidth: '50px' }}>{date}</span>
                    <strong className="quote-list-item-mid-name" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{req.name}</strong>
                    {req.company && <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>({req.company})</span>}
                  </div>

                  {/* Rad 1 (Mobil) / Höger (Desktop): Status & Taggar */}
                  <div className="quote-list-item-top" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {(() => {
                      const isClosed = req.status === 'completed' || req.status === 'archived';
                      const hasUnread = req.messages?.some(m => m.sender_type === 'customer' && m.is_read === false);
                      const sortedMessages = [...(req.messages || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                      const lastMessage = sortedMessages[sortedMessages.length - 1];
                      const needsReply = !isClosed && lastMessage?.sender_type === 'customer';

                      return (
                        <>
                          {(!isClosed && hasUnread) && (
                            <span style={{ backgroundColor: '#ef4444', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                              Nytt svar
                            </span>
                          )}
                          {needsReply && (
                            <span style={{ backgroundColor: '#f59e0b', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                              Ej besvarad
                            </span>
                          )}
                        </>
                      );
                    })()}
                    <LeadStatusBadge status={req.status} />
                  </div>
                </div>

                {/* Rad 3 (Mobil & Desktop): Typ och Objekt */}
                <div className="quote-list-item-bot" style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}><Tag size={14} /> {getTypeLabel(req.request_type)}</div>
                  {req.machine_id && req.machine && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <div className="break-word" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-primary)' }}>
                        Produkt: {req.machine.name}
                      </div>
                      {req.machine.category && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          Kategori: {translations.sv.machinery.categories[req.machine.category] || req.machine.category}
                        </div>
                      )}
                    </div>
                  )}
                  {req.inventory_item_id && req.inventory_item && (
                    <div className="break-word" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-primary)' }}>
                      Lösöre: {req.inventory_item.name}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Detail Modal ─── */}
      {selectedRequest && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}
          onClick={handleCloseQuote}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary)', width: '100%', maxWidth: '600px', borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
              maxHeight: '90vh'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-surface)' }}>
              <div>
                <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>Förfrågan: {getTypeLabel(selectedRequest.request_type)}</h2>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Inkom: {new Date(selectedRequest.created_at).toLocaleString('sv-SE')}
                </div>
              </div>
              <button onClick={handleCloseQuote} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>

              {/* Product link if exists */}
              {(selectedRequest.machine || selectedRequest.inventory_item) && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gäller specifikt objekt</div>
                  {selectedRequest.machine && (
                    <div className="quote-modal-product-flex" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                      <div className="break-word" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Produkt: {selectedRequest.machine.name}</span>
                        {selectedRequest.machine.category && (
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Kategori: {translations.sv.machinery.categories[selectedRequest.machine.category] || selectedRequest.machine.category}
                          </span>
                        )}
                      </div>
                      <Link to={`/admin/maskiner/${selectedRequest.machine_id}`} target="_blank" style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.875rem', textDecoration: 'none' }}>
                        Visa i admin <ExternalLink size={14} />
                      </Link>
                    </div>
                  )}
                  {selectedRequest.inventory_item && (
                    <div className="quote-modal-product-flex" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <span className="break-word" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Lösöre: {selectedRequest.inventory_item.name}</span>
                      <Link to={`/admin/losore/${selectedRequest.inventory_item_id}`} target="_blank" style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.875rem', textDecoration: 'none' }}>
                        Visa i admin <ExternalLink size={14} />
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Customer Info */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kunduppgifter</div>
                <div className="quote-modal-customer-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}><User size={14} /> Namn</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedRequest.name}</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}><User size={14} /> Företag</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedRequest.company || '–'}</div>
                  </div>
                  <div className="break-word">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}><Mail size={14} /> E-post</div>
                    <a href={`mailto:${selectedRequest.email}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>{selectedRequest.email}</a>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}><Phone size={14} /> Telefon</div>
                    {selectedRequest.phone ? (
                      <a href={`tel:${selectedRequest.phone}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>{selectedRequest.phone}</a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Ej angivet</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Konversation */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}><FileText size={14} /> Konversation</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Ursprungligt meddelande (som första meddelande i tråden) */}
                  <div className="quote-msg-bubble" style={{ alignSelf: 'flex-start', maxWidth: '85%', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', borderTopLeftRadius: '4px', padding: '1rem' }}>
                    <div className="quote-msg-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem', gap: '1rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{selectedRequest.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(selectedRequest.created_at).toLocaleString('sv-SE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="break-word" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.9375rem' }}>
                      {selectedRequest.message || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Inget meddelande angivet vid förfrågan.</span>}
                    </div>
                  </div>

                  {/* Databas-meddelanden (sorterade på created_at) */}
                  {(selectedRequest.messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((msg) => {
                    const isCustomer = msg.sender_type === 'customer';
                    return (
                      <div key={msg.id} className="quote-msg-bubble" style={{
                        alignSelf: isCustomer ? 'flex-start' : 'flex-end',
                        maxWidth: '85%',
                        backgroundColor: isCustomer ? 'var(--bg-surface)' : 'var(--accent-primary)',
                        border: isCustomer ? '1px solid var(--border-color)' : '1px solid transparent',
                        borderRadius: '12px',
                        borderTopLeftRadius: isCustomer ? '4px' : '12px',
                        borderTopRightRadius: isCustomer ? '12px' : '4px',
                        padding: '1rem',
                        color: isCustomer ? 'var(--text-primary)' : '#ffffff'
                      }}>
                        <div className="quote-msg-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem', gap: '1rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: isCustomer ? 'var(--text-primary)' : '#ffffff' }}>
                            {isCustomer ? selectedRequest.name : 'Hammarö Maskin'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: isCustomer ? 'var(--text-muted)' : 'rgba(255,255,255,0.8)' }}>
                            {new Date(msg.created_at).toLocaleString('sv-SE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="break-word" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.9375rem' }}>
                          {(() => {
                            if (!msg.body_text) return null;
                            const replyRegex = /(Den\s+.*?skrev:|\nOn\s+.*?(wrote|skrev):|\n>)/i;
                            const match = msg.body_text.match(replyRegex);
                            if (match && match.index > 0) {
                              const mainText = msg.body_text.substring(0, match.index).trim();
                              return (
                                <div>{mainText}</div>
                              );
                            }
                            return (
                              <div>{msg.body_text}</div>
                            );
                          })()}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.8, textTransform: 'uppercase' }}>Bilagor</span>
                              {msg.attachments.map((att, i) => (
                                <AttachmentPreview key={i} att={att} isCustomer={isCustomer} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Svara-fält */}
                {canWriteQuotes && (
                  <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {replyError && (
                      <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '6px', fontSize: '0.875rem' }}>
                        {replyError}
                      </div>
                    )}
                    {replySuccess && (
                      <div style={{ padding: '0.75rem', backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: '6px', fontSize: '0.875rem' }}>
                        {replyEmailStatus || 'Svaret har sparats och skickats.'}
                      </div>
                    )}
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      disabled={isSendingReply}
                      placeholder="Skriv ditt svar till kunden här..."
                      rows={4}
                      style={{
                        width: '100%', padding: '0.75rem', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical'
                      }}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <button
                          type="button"
                          onClick={() => document.getElementById('quote-image-upload').click()}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', color: 'var(--accent-primary)', fontSize: '0.875rem', fontWeight: 600, background: 'none', border: 'none', padding: 0 }}
                          disabled={isSendingReply}
                        >
                          <Paperclip size={16} /> Bifoga bild
                        </button>
                        <button
                          type="button"
                          onClick={() => document.getElementById('quote-doc-upload').click()}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', color: 'var(--accent-primary)', fontSize: '0.875rem', fontWeight: 600, background: 'none', border: 'none', padding: 0 }}
                          disabled={isSendingReply}
                        >
                          <FileText size={16} /> Bifoga dokument
                        </button>
                      </div>

                      <input id="quote-image-upload" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => {
                        const newFiles = Array.from(e.target.files);
                        if (!newFiles.length) return;
                        const maxFileSize = 25 * 1024 * 1024;
                        const maxTotalSize = 50 * 1024 * 1024;
                        let errorMsg = '';
                        let currentTotalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
                        const validFiles = newFiles.filter(f => {
                          if (f.size > maxFileSize) { errorMsg = `Filen ${f.name} är för stor (max 25 MB).`; return false; }
                          if (currentTotalSize + f.size > maxTotalSize) { errorMsg = 'Total filstorlek överstiger 50 MB.'; return false; }
                          currentTotalSize += f.size;
                          return true;
                        });
                        if (errorMsg) setReplyError(errorMsg); else setReplyError('');
                        if (validFiles.length > 0) setSelectedFiles(prev => [...prev, ...validFiles]);
                        e.target.value = null;
                      }} style={{ display: 'none' }} disabled={isSendingReply} />

                      <input id="quote-doc-upload" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => {
                        const newFiles = Array.from(e.target.files);
                        if (!newFiles.length) return;
                        const maxFileSize = 25 * 1024 * 1024;
                        const maxTotalSize = 50 * 1024 * 1024;
                        let errorMsg = '';
                        let currentTotalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
                        const validFiles = newFiles.filter(f => {
                          if (f.size > maxFileSize) { errorMsg = `Filen ${f.name} är för stor (max 25 MB).`; return false; }
                          if (currentTotalSize + f.size > maxTotalSize) { errorMsg = 'Total filstorlek överstiger 50 MB.'; return false; }
                          currentTotalSize += f.size;
                          return true;
                        });
                        if (errorMsg) setReplyError(errorMsg); else setReplyError('');
                        if (validFiles.length > 0) setSelectedFiles(prev => [...prev, ...validFiles]);
                        e.target.value = null;
                      }} style={{ display: 'none' }} disabled={isSendingReply} />
                      {selectedFiles.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                          {selectedFiles.map((file, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.8125rem' }}>
                              <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
                              <button onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} disabled={isSendingReply} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem', display: 'flex' }} aria-label="Ta bort fil">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={handleSendReply}
                        disabled={isSendingReply || (!replyText.trim() && selectedFiles.length === 0)}
                        style={{
                          padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none',
                          backgroundColor: isSendingReply || (!replyText.trim() && selectedFiles.length === 0) ? 'var(--bg-surface)' : 'var(--accent-primary)',
                          color: isSendingReply || (!replyText.trim() && selectedFiles.length === 0) ? 'var(--text-muted)' : '#ffffff',
                          fontWeight: 600, cursor: isSendingReply || (!replyText.trim() && selectedFiles.length === 0) ? 'not-allowed' : 'pointer', fontSize: '0.875rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        {isSendingReply ? 'Skickar...' : 'Skicka svar till kunden'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Update & Delete */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                {canWriteQuotes && !['completed', 'archived'].includes(selectedRequest.status) && (
                  <>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ändra status</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {QUOTE_STATUS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => handleStatusChange(selectedRequest.id, opt.value)}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backgroundColor: selectedRequest.status === opt.value ? `${opt.color}22` : 'var(--bg-surface)',
                            color: selectedRequest.status === opt.value ? opt.color : 'var(--text-secondary)',
                            border: selectedRequest.status === opt.value ? `1px solid ${opt.color}` : '1px solid var(--border-color)',
                            transition: 'all 0.2s'
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Delete Confirmation Block */}
                {canDeleteQuotes && (
                  <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', marginTop: '2rem' }}>
                    {!confirmDelete ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#ef4444', fontSize: '0.9375rem' }}>Radera förfrågan</div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Raderar förfrågan permanent från systemet.</div>
                        </div>
                        <button
                          onClick={() => setConfirmDelete(selectedRequest.id)}
                          style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                        >
                          Radera
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#ef4444', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>Är du säker på att du vill radera denna förfrågan?</div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Denna åtgärd kan inte ångras.</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => setConfirmDelete(null)} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>Avbryt</button>
                          <button onClick={() => handleDelete(selectedRequest.id)} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>Radera</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const filterBtnStyle = (active) => ({
  padding: '0.5rem 1rem',
  background: active ? 'var(--text-primary)' : 'var(--bg-surface)',
  color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
  border: active ? '1px solid var(--text-primary)' : '1px solid var(--border-color)',
  borderRadius: '8px',
  fontSize: '0.875rem',
  fontWeight: active ? 600 : 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.15s',
  display: 'flex',
  alignItems: 'center',
});

export default QuoteRequestsPanel;
