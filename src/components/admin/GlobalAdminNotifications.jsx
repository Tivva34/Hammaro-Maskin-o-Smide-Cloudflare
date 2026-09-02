import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Mail } from 'lucide-react';

const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); // A5

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.warn('AudioContext kunde inte spela ljud:', e);
  }
};

const GlobalAdminNotifications = () => {
  const { user } = useAuth();
  const [inAppToast, setInAppToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    // Endast aktiv om vi har en inloggad admin
    if (!user) return;

    const channel = supabase
      .channel('admin-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'quote_messages' },
        (payload) => {
          if (payload.new && payload.new.sender_type === 'customer') {
            setInAppToast('Nytt kundsvar inkommet!');
            playNotificationSound();
            
            // Dispatch a global event so QuoteRequestsPanel can reload data
            window.dispatchEvent(new CustomEvent('admin_quote_message_inserted'));

            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => {
              setInAppToast(null);
            }, 6000);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'quote_requests' },
        (payload) => {
          setInAppToast('Ny förfrågan inkommen!');
          playNotificationSound();
          
          // Dispatch a global event so QuoteRequestsPanel can reload data
          window.dispatchEvent(new CustomEvent('admin_quote_message_inserted'));

          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => {
            setInAppToast(null);
          }, 6000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [user]);

  if (!inAppToast) return null;

  return (
    <div
      onClick={() => {
        setInAppToast(null);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      }}
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        backgroundColor: 'var(--accent-primary)',
        color: 'white',
        padding: '1rem 1.5rem',
        borderRadius: '8px',
        zIndex: 9999,
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        animation: 'fadein 0.3s',
        cursor: 'pointer'
      }}
      title="Klicka för att stänga"
    >
      <Mail size={20} />
      {inAppToast}
    </div>
  );
};

export default GlobalAdminNotifications;
