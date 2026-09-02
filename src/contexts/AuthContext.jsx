import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async (currentUser) => {
      if (!currentUser) {
        if (mounted) setProfile(null);
        return;
      }
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
        
      if (mounted) {
        if (!error && data) {
          setProfile(data);
        } else {
          // Fallback: If migration hasn't been run or user_profiles fails, 
          // check if the user is in the old `admins` table.
          const { data: adminData, error: adminError } = await supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', currentUser.id)
            .single();

          if (!adminError && adminData) {
            setProfile({
              id: currentUser.id,
              role: 'superadmin',
              permissions: [],
              is_active: true
            });
          } else {
            setProfile(null);
          }
        }
      }
    };

    // Get existing session on mount (handles page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      fetchProfile(session?.user ?? null).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    // Subscribe to future auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      fetchProfile(session?.user ?? null);
      
      // If Supabase successfully processes a recovery link, route the user manually
      // This avoids router conflicts with Supabase's implicit flow tokens in the URL hash.
      if (event === 'PASSWORD_RECOVERY') {
        window.location.href = '/admin/update-password';
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Sign in with email and password.
   * Returns { data, error } – caller handles error display.
   */
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  /**
   * Sign out current user.
   * Returns { error } – caller handles error display.
   */
  const signOut = async () => {
    try {
      if (user) {
        try {
          const { unsubscribeCurrentDevice } = await import('../lib/pushNotificationService');
          await unsubscribeCurrentDevice().catch(e => console.warn('Push cleanup failed', e));
        } catch (e) {
          console.warn('Could not load push service for cleanup', e);
        }
      }
    } finally {
      const { error } = await supabase.auth.signOut();
      return { error };
    }
  };

  /**
   * Reset password for email.
   */
  const resetPassword = async (email) => {
    // Use VITE_APP_URL (baked in at build time) so the reset link always points to the
    // deployed Cloudflare URL, never to localhost when the admin happens to be on a dev machine.
    const appUrl = (import.meta.env.VITE_APP_URL ?? window.location.origin).replace(/\/$/, '');
    const redirectUrl = `${appUrl}/admin/update-password`;

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { data, error };
  };

  /**
   * Update user password.
   */
  const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { data, error };
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth – consume the AuthContext.
 * Throws if used outside of <AuthProvider>.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth måste användas inuti en <AuthProvider>');
  }
  return context;
};
