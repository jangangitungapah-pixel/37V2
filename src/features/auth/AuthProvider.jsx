import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AuthContext } from './AuthContext';
import {
  createAuthError,
  mapAuthErrorToMessage,
  mapPasswordResetErrorToMessage,
} from './auth-helpers';
import {
  requestStaffPasswordReset,
  signInStaffWithEmailPassword,
  signOutStaff,
  subscribeToStaffAuthChanges,
} from './auth-service';
import { fetchAndValidateStaffProfile } from './staff-profile-service';

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({
    status: 'loading',
    user: null,
    profile: null,
    role: null,
    authError: null,
  });

  const verifiedCacheRef = useRef({ uid: null, profile: null });
  const loginInFlightRef = useRef(false);
  const verificationCounterRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToStaffAuthChanges(async (firebaseUser) => {
      if (!isMounted) return;

      if (loginInFlightRef.current) {
        return;
      }

      if (!firebaseUser) {
        verifiedCacheRef.current = { uid: null, profile: null };
        setAuthState((prev) => ({
          status: 'unauthenticated',
          user: null,
          profile: null,
          role: null,
          authError: prev.authError,
        }));
        return;
      }

      if (verifiedCacheRef.current.uid === firebaseUser.uid && verifiedCacheRef.current.profile) {
        const cachedProfile = verifiedCacheRef.current.profile;
        setAuthState({
          status: 'authenticated',
          user: firebaseUser,
          profile: cachedProfile,
          role: cachedProfile.role,
          authError: null,
        });
        return;
      }

      const currentOperation = ++verificationCounterRef.current;
      setAuthState((prev) => ({
        ...prev,
        status: 'loading',
        authError: null,
      }));

      try {
        const validatedProfile = await fetchAndValidateStaffProfile(firebaseUser);
        if (!isMounted || verificationCounterRef.current !== currentOperation) {
          return;
        }

        verifiedCacheRef.current = {
          uid: firebaseUser.uid,
          profile: validatedProfile,
        };

        setAuthState({
          status: 'authenticated',
          user: firebaseUser,
          profile: validatedProfile,
          role: validatedProfile.role,
          authError: null,
        });
      } catch (error) {
        verifiedCacheRef.current = { uid: null, profile: null };
        await signOutStaff().catch(() => {});

        if (!isMounted || verificationCounterRef.current !== currentOperation) {
          return;
        }

        setAuthState({
          status: 'unauthenticated',
          user: null,
          profile: null,
          role: null,
          authError: mapAuthErrorToMessage(error),
        });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const currentOperation = ++verificationCounterRef.current;
    loginInFlightRef.current = true;
    setAuthState((prev) => ({
      ...prev,
      authError: null,
    }));

    try {
      const { user, profile } = await signInStaffWithEmailPassword(email, password);
      verifiedCacheRef.current = {
        uid: user.uid,
        profile,
      };
      loginInFlightRef.current = false;

      if (verificationCounterRef.current === currentOperation) {
        setAuthState({
          status: 'authenticated',
          user,
          profile,
          role: profile.role,
          authError: null,
        });
      }

      return { user, profile };
    } catch (error) {
      verifiedCacheRef.current = { uid: null, profile: null };
      loginInFlightRef.current = false;
      const message = mapAuthErrorToMessage(error);

      if (verificationCounterRef.current === currentOperation) {
        setAuthState({
          status: 'unauthenticated',
          user: null,
          profile: null,
          role: null,
          authError: message,
        });
      }

      throw createAuthError(error?.code || 'auth/failed', message);
    }
  }, []);

  const logout = useCallback(async () => {
    ++verificationCounterRef.current;
    verifiedCacheRef.current = { uid: null, profile: null };
    loginInFlightRef.current = false;

    await signOutStaff();

    setAuthState({
      status: 'unauthenticated',
      user: null,
      profile: null,
      role: null,
      authError: null,
    });
  }, []);

  const resetPassword = useCallback(async (email) => {
    try {
      return await requestStaffPasswordReset(email);
    } catch (error) {
      const message = mapPasswordResetErrorToMessage(error);
      throw createAuthError(error?.code || 'auth/reset-failed', message);
    }
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthState((prev) => (prev.authError ? { ...prev, authError: null } : prev));
  }, []);

  const value = useMemo(
    () => ({
      user: authState.user,
      profile: authState.profile,
      status: authState.status,
      role: authState.role,
      authError: authState.authError,
      login,
      logout,
      resetPassword,
      clearAuthError,
    }),
    [authState, clearAuthError, login, logout, resetPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
