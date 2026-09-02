import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { isPushSupported, getPushSubscriptionStatus, subscribeToPush } from '../../lib/pushNotificationService';
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

  const isMigrating = useRef(false);

  // Push Subscription Migration (from scope '/' to '/admin')
  useEffect(() => {
    // Grundkrav: Inloggad, push stöds, och användaren har redan gett tillåtelse
    if (!user || !isPushSupported() || Notification.permission !== 'granted') return;

    const migratePushSubscription = async () => {
      // Förhindra samtidiga körningar från StrictMode
      if (isMigrating.current) return;
      isMigrating.current = true;

      try {
        // 1. Hämta exakt admin-registreringen
        let adminReg = await navigator.serviceWorker.getRegistration('/admin');

        if (!adminReg) {
          isMigrating.current = false;
          return; // Inte registrerad ännu.
        }

        // Hjälpfunktion för att vänta på att workern blir 'active' via statechange
        const waitForActiveWorker = (reg) => new Promise((resolve) => {
          if (reg.active) return resolve(reg);

          const worker = reg.installing || reg.waiting;
          if (!worker) return resolve(reg); // Oväntat tillstånd

          const stateChangeListener = (e) => {
            if (e.target.state === 'activated') {
              worker.removeEventListener('statechange', stateChangeListener);
              resolve(reg);
            } else if (e.target.state === 'redundant') {
              worker.removeEventListener('statechange', stateChangeListener);
              resolve(null);
            }
          };
          worker.addEventListener('statechange', stateChangeListener);
        });

        adminReg = await waitForActiveWorker(adminReg);

        if (!adminReg || !adminReg.active) {
          isMigrating.current = false;
          console.warn('[pushService] Admin SW blev aldrig aktiv eller sattes till redundant.');
          return;
        }

        // 2. Har vi redan en prenumeration för Admin-registreringen?
        const currentSub = await adminReg.pushManager.getSubscription();
        if (currentSub) {
          // Allt är redan korrekt. Migration behövs ej. Lås permanent för denna session.
          return;
        }

        // 3. Om vi saknar admin-prenumeration, skapa den.
        console.log('[pushService] Migrerar till /admin Service Worker...');
        const result = await subscribeToPush(adminReg);

        if (!result.success) {
          console.warn('[pushService] Misslyckades att skapa admin-prenumeration:', result.error);
          isMigrating.current = false; // Lås upp för eventuell retry senare
          return; // AVBRYT! Gamla prenumerationen är 100% orörd.
        }

        // 4. Ny prenumeration är skapad och sparad i Supabase.
        // Nu gör vi cleanup av gamla public-registreringen.
        const publicReg = await navigator.serviceWorker.getRegistration('/');
        if (publicReg && publicReg.scope === window.location.origin + '/') {
          const oldSub = await publicReg.pushManager.getSubscription();
          if (oldSub) {
            try {
              // Avregistrera hos webbläsaren/push-servern
              await oldSub.unsubscribe();
              // Rensa upp i databasen
              await supabase.from('push_subscriptions').delete().eq('endpoint', oldSub.endpoint);
              console.log('[pushService] Gammal public-prenumeration bortstädad.');
            } catch (cleanupError) {
              console.warn('[pushService] DB-cleanup av gammal prenumeration misslyckades. Migrationen är dock genomförd.', cleanupError);
            }
          }
        }
      } catch (e) {
        console.error('[pushService] Oväntat fel i push-migrering:', e);
        isMigrating.current = false; // Lås upp
      }
    };

    migratePushSubscription();
  }, [user]);

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
