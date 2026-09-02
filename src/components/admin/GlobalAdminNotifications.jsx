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
        // 1. Wait for the global root SW to be ready
        const rootReg = await navigator.serviceWorker.ready;

        // 2. Check if we already have a subscription on the root SW
        let rootSub = await rootReg.pushManager.getSubscription();

        // 3. If not, create the root subscription
        if (!rootSub) {
          console.log('[pushService] Skapar prenumeration på root Service Worker...');
          const result = await subscribeToPush(rootReg);
          
          if (!result.success) {
            console.warn('[pushService] Misslyckades att skapa root-prenumeration:', result.error);
            isMigrating.current = false;
            return; // AVBRYT! Städa inte upp gammal förrän vi har en fungerande ny
          }
          
          rootSub = await rootReg.pushManager.getSubscription();
        }

        // 4. Nu har vi en fungerande prenumeration på root-scopet.
        // Dags att rensa upp eventuell gammal /admin SW.
        const adminReg = await navigator.serviceWorker.getRegistration('/admin');
        if (adminReg && adminReg.scope === window.location.origin + '/admin') {
          console.log('[pushService] Hittade gammal /admin Service Worker, påbörjar städning...');
          const adminSub = await adminReg.pushManager.getSubscription();
          
          if (adminSub) {
            // Säkerställ att vi INTE råkar radera root-subscriptionens endpoint från databasen
            if (!rootSub || adminSub.endpoint !== rootSub.endpoint) {
              try {
                await adminSub.unsubscribe();
                await supabase.from('push_subscriptions').delete().eq('endpoint', adminSub.endpoint);
                console.log('[pushService] Gammal /admin-prenumeration bortstädad.');
              } catch (cleanupError) {
                console.warn('[pushService] Cleanup av /admin-prenumeration misslyckades.', cleanupError);
              }
            }
          }
          
          // Avregistrera /admin SW helt
          await adminReg.unregister();
          console.log('[pushService] Gammal /admin Service Worker avregistrerad.');
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
