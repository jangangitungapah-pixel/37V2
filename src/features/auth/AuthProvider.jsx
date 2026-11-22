import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CLIENT_ACCOUNT_STATUS,
  CLIENT_ROLE,
  CLIENT_SUSPENDED_MESSAGE,
} from '@/features/client-portal/config/client-portal-config';
import { getClientPortalRepositoryAdapter } from '@/features/client-portal/repositories/client-portal-repository';
import {
  completeGoogleRedirectIfPresent,
  resolveOrProvisionClientAccount,
  signInClientWithGoogle,
} from '@/features/client-portal/services/client-auth-service';
import { mapClientAuthErrorToMessage } from '@/features/client-portal/utils/client-auth-helpers';
import { queryClient } from '@/lib/query-client';

import { AuthContext } from './AuthContext';
import {
  createAuthError,
  mapAuthErrorToMessage,
  mapPasswordResetErrorToMessage,
  mapReauthErrorToMessage,
} from './auth-helpers';
import {
  reauthenticateCurrentStaff,
  requestStaffPasswordReset,
  signInStaffWithEmailPassword,
  signOutStaff,
  subscribeToStaffAuthChanges,
} from './auth-service';
import { fetchAndValidateStaffProfile } from './staff-profile-service';

const EMPTY_CACHE = {
  uid: null,
  accountType: null,
  profile: null,
  clientAccount: null,
  clientProfile: null,
  role: null,
};

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({
    status: 'loading',
    accountType: null,
    user: null,
    profile: null,
    clientAccount: null,
    clientProfile: null,
    role: null,
    authError: null,
    clientAuthError: null,
  });
  const [lastReauthenticatedAt, setLastReauthenticatedAt] = useState(null);

  const verifiedCacheRef = useRef({ ...EMPTY_CACHE });
  const activeUidRef = useRef(null);
  const clientAccountUnsubRef = useRef(null);
  const loginInFlightRef = useRef(false);
  const verificationCounterRef = useRef(0);
  const mountedRef = useRef(true);

  const cleanupClientSubscription = useCallback(() => {
    if (clientAccountUnsubRef.current) {
      clientAccountUnsubRef.current();
      clientAccountUnsubRef.current = null;
    }
  }, []);

  const resetSessionIsolation = useCallback(() => {
    cleanupClientSubscription();
    verifiedCacheRef.current = { ...EMPTY_CACHE };
    setLastReauthenticatedAt(null);
    queryClient.clear();
  }, [cleanupClientSubscription]);

  const attachClientAccountWatcher = useCallback(
    (uid, expectedCustomerId) => {
      cleanupClientSubscription();
      const adapter = getClientPortalRepositoryAdapter();
      if (!uid || typeof adapter.subscribeClientAccount !== 'function') {
        return;
      }

      clientAccountUnsubRef.current = adapter.subscribeClientAccount(uid, {
        onData: (latestAccount) => {
          if (!mountedRef.current || activeUidRef.current !== uid) {
            return;
          }

          const isStillValid =
            Boolean(latestAccount) &&
            latestAccount.uid === uid &&
            latestAccount.role === CLIENT_ROLE &&
            latestAccount.status === CLIENT_ACCOUNT_STATUS.ACTIVE &&
            Boolean(latestAccount.customerId) &&
            latestAccount.customerId === expectedCustomerId;

          if (!isStillValid) {
            const wasSuspended = latestAccount?.status === CLIENT_ACCOUNT_STATUS.SUSPENDED;
            ++verificationCounterRef.current;
            activeUidRef.current = null;
            resetSessionIsolation();
            signOutStaff().catch(() => {});
            setAuthState({
              status: 'unauthenticated',
              accountType: null,
              user: null,
              profile: null,
              clientAccount: null,
              clientProfile: null,
              role: null,
              authError: null,
              clientAuthError: wasSuspended
                ? CLIENT_SUSPENDED_MESSAGE
                : mapClientAuthErrorToMessage({ code: 'client/invalid-binding' }),
            });
          } else {
            verifiedCacheRef.current = {
              ...verifiedCacheRef.current,
              clientAccount: latestAccount,
            };
          }
        },
        onError: () => {
          if (!mountedRef.current || activeUidRef.current !== uid) {
            return;
          }
          ++verificationCounterRef.current;
          activeUidRef.current = null;
          resetSessionIsolation();
          signOutStaff().catch(() => {});
          setAuthState({
            status: 'unauthenticated',
            accountType: null,
            user: null,
            profile: null,
            clientAccount: null,
            clientProfile: null,
            role: null,
            authError: null,
            clientAuthError: mapClientAuthErrorToMessage({ code: 'permission-denied' }),
          });
        },
      });
    },
    [cleanupClientSubscription, resetSessionIsolation],
  );

  useEffect(() => {
    mountedRef.current = true;
    let isMounted = true;

    const redirectResolutionPromise = completeGoogleRedirectIfPresent()
      .then((redirectResult) => {
        if (!isMounted || !redirectResult?.clientAccount) {
          return redirectResult;
        }
        const { user, clientAccount, clientProfile } = redirectResult;
        if (activeUidRef.current && activeUidRef.current !== user.uid) {
          resetSessionIsolation();
        }
        activeUidRef.current = user.uid;
        verifiedCacheRef.current = {
          uid: user.uid,
          accountType: 'client',
          profile: null,
          clientAccount,
          clientProfile,
          role: CLIENT_ROLE,
        };
        attachClientAccountWatcher(user.uid, clientAccount.customerId);
        setAuthState({
          status: 'authenticated',
          accountType: 'client',
          user,
          profile: null,
          clientAccount,
          clientProfile,
          role: CLIENT_ROLE,
          authError: null,
          clientAuthError: null,
        });
        return redirectResult;
      })
      .catch((redirectError) => {
        if (!isMounted) return null;
        resetSessionIsolation();
        activeUidRef.current = null;
        setAuthState({
          status: 'unauthenticated',
          accountType: null,
          user: null,
          profile: null,
          clientAccount: null,
          clientProfile: null,
          role: null,
          authError: null,
          clientAuthError: mapClientAuthErrorToMessage(redirectError),
        });
        return null;
      });

    const unsubscribe = subscribeToStaffAuthChanges(async (firebaseUser) => {
      if (!isMounted) return;

      await redirectResolutionPromise;
      if (!isMounted || loginInFlightRef.current) {
        return;
      }

      if (!firebaseUser) {
        const hadPrevUid = activeUidRef.current !== null;
        activeUidRef.current = null;
        cleanupClientSubscription();
        verifiedCacheRef.current = { ...EMPTY_CACHE };
        setLastReauthenticatedAt(null);
        if (hadPrevUid) {
          queryClient.clear();
        }
        setAuthState((prev) => ({
          status: 'unauthenticated',
          accountType: null,
          user: null,
          profile: null,
          clientAccount: null,
          clientProfile: null,
          role: null,
          authError: prev.authError,
          clientAuthError: prev.clientAuthError,
        }));
        return;
      }

      if (activeUidRef.current && activeUidRef.current !== firebaseUser.uid) {
        resetSessionIsolation();
      }
      activeUidRef.current = firebaseUser.uid;

      if (
        verifiedCacheRef.current.uid === firebaseUser.uid &&
        verifiedCacheRef.current.accountType === 'staff' &&
        verifiedCacheRef.current.profile
      ) {
        const cachedProfile = verifiedCacheRef.current.profile;
        setAuthState({
          status: 'authenticated',
          accountType: 'staff',
          user: firebaseUser,
          profile: cachedProfile,
          clientAccount: null,
          clientProfile: null,
          role: cachedProfile.role,
          authError: null,
          clientAuthError: null,
        });
        return;
      }

      if (
        verifiedCacheRef.current.uid === firebaseUser.uid &&
        verifiedCacheRef.current.accountType === 'client' &&
        verifiedCacheRef.current.clientAccount &&
        verifiedCacheRef.current.clientProfile
      ) {
        setAuthState({
          status: 'authenticated',
          accountType: 'client',
          user: firebaseUser,
          profile: null,
          clientAccount: verifiedCacheRef.current.clientAccount,
          clientProfile: verifiedCacheRef.current.clientProfile,
          role: CLIENT_ROLE,
          authError: null,
          clientAuthError: null,
        });
        return;
      }

      const currentOperation = ++verificationCounterRef.current;
      setAuthState((prev) => ({
        ...prev,
        status: 'loading',
        authError: null,
        clientAuthError: null,
      }));

      try {
        // 1. Canonical Staff/Owner resolution first
        const validatedProfile = await fetchAndValidateStaffProfile(firebaseUser);
        if (!isMounted || verificationCounterRef.current !== currentOperation) {
          return;
        }

        cleanupClientSubscription();
        verifiedCacheRef.current = {
          uid: firebaseUser.uid,
          accountType: 'staff',
          profile: validatedProfile,
          clientAccount: null,
          clientProfile: null,
          role: validatedProfile.role,
        };

        setAuthState({
          status: 'authenticated',
          accountType: 'staff',
          user: firebaseUser,
          profile: validatedProfile,
          clientAccount: null,
          clientProfile: null,
          role: validatedProfile.role,
          authError: null,
          clientAuthError: null,
        });
        return;
      } catch (staffError) {
        if (staffError?.code !== 'staff/profile-missing') {
          activeUidRef.current = null;
          resetSessionIsolation();
          await signOutStaff().catch(() => {});

          if (!isMounted || verificationCounterRef.current !== currentOperation) {
            return;
          }

          setAuthState({
            status: 'unauthenticated',
            accountType: null,
            user: null,
            profile: null,
            clientAccount: null,
            clientProfile: null,
            role: null,
            authError: mapAuthErrorToMessage(staffError),
            clientAuthError: null,
          });
          return;
        }
      }

      // 2. Canonical Client resolution (strictly allowProvision: false for passive restore)
      try {
        const clientResult = await resolveOrProvisionClientAccount(firebaseUser, {
          allowProvision: false,
        });
        if (!isMounted || verificationCounterRef.current !== currentOperation) {
          return;
        }

        verifiedCacheRef.current = {
          uid: firebaseUser.uid,
          accountType: 'client',
          profile: null,
          clientAccount: clientResult.clientAccount,
          clientProfile: clientResult.clientProfile,
          role: CLIENT_ROLE,
        };
        attachClientAccountWatcher(firebaseUser.uid, clientResult.clientAccount.customerId);

        setAuthState({
          status: 'authenticated',
          accountType: 'client',
          user: firebaseUser,
          profile: null,
          clientAccount: clientResult.clientAccount,
          clientProfile: clientResult.clientProfile,
          role: CLIENT_ROLE,
          authError: null,
          clientAuthError: null,
        });
      } catch (clientError) {
        activeUidRef.current = null;
        resetSessionIsolation();
        await signOutStaff().catch(() => {});

        if (!isMounted || verificationCounterRef.current !== currentOperation) {
          return;
        }

        const shouldSurfaceClientError =
          clientError?.code === 'client/account-suspended' ||
          clientError?.code === 'client/email-unverified';

        setAuthState({
          status: 'unauthenticated',
          accountType: null,
          user: null,
          profile: null,
          clientAccount: null,
          clientProfile: null,
          role: null,
          authError: mapAuthErrorToMessage({ code: 'staff/profile-missing' }),
          clientAuthError: shouldSurfaceClientError
            ? mapClientAuthErrorToMessage(clientError)
            : null,
        });
      }
    });

    return () => {
      isMounted = false;
      mountedRef.current = false;
      cleanupClientSubscription();
      unsubscribe?.();
    };
  }, [attachClientAccountWatcher, cleanupClientSubscription, resetSessionIsolation]);

  const login = useCallback(
    async (email, password) => {
      const currentOperation = ++verificationCounterRef.current;
      loginInFlightRef.current = true;
      setAuthState((prev) => ({
        ...prev,
        authError: null,
        clientAuthError: null,
      }));

      try {
        const { user, profile } = await signInStaffWithEmailPassword(email, password);
        if (activeUidRef.current && activeUidRef.current !== user.uid) {
          queryClient.clear();
        }
        cleanupClientSubscription();
        activeUidRef.current = user.uid;
        verifiedCacheRef.current = {
          uid: user.uid,
          accountType: 'staff',
          profile,
          clientAccount: null,
          clientProfile: null,
          role: profile.role,
        };
        loginInFlightRef.current = false;

        if (verificationCounterRef.current === currentOperation) {
          setAuthState({
            status: 'authenticated',
            accountType: 'staff',
            user,
            profile,
            clientAccount: null,
            clientProfile: null,
            role: profile.role,
            authError: null,
            clientAuthError: null,
          });
        }

        return { user, profile };
      } catch (error) {
        activeUidRef.current = null;
        resetSessionIsolation();
        loginInFlightRef.current = false;
        const message = mapAuthErrorToMessage(error);

        if (verificationCounterRef.current === currentOperation) {
          setAuthState({
            status: 'unauthenticated',
            accountType: null,
            user: null,
            profile: null,
            clientAccount: null,
            clientProfile: null,
            role: null,
            authError: message,
            clientAuthError: null,
          });
        }

        throw createAuthError(error?.code || 'auth/failed', message);
      }
    },
    [cleanupClientSubscription, resetSessionIsolation],
  );

  const loginWithGoogle = useCallback(async () => {
    const currentOperation = ++verificationCounterRef.current;
    loginInFlightRef.current = true;
    setAuthState((prev) => ({
      ...prev,
      clientAuthError: null,
    }));

    try {
      const result = await signInClientWithGoogle();
      if (result?.redirected) {
        loginInFlightRef.current = false;
        return result;
      }

      const { user, clientAccount, clientProfile } = result;
      if (activeUidRef.current && activeUidRef.current !== user.uid) {
        queryClient.clear();
      }
      activeUidRef.current = user.uid;
      verifiedCacheRef.current = {
        uid: user.uid,
        accountType: 'client',
        profile: null,
        clientAccount,
        clientProfile,
        role: CLIENT_ROLE,
      };
      attachClientAccountWatcher(user.uid, clientAccount.customerId);
      loginInFlightRef.current = false;

      if (verificationCounterRef.current === currentOperation) {
        setAuthState({
          status: 'authenticated',
          accountType: 'client',
          user,
          profile: null,
          clientAccount,
          clientProfile,
          role: CLIENT_ROLE,
          authError: null,
          clientAuthError: null,
        });
      }

      return result;
    } catch (error) {
      loginInFlightRef.current = false;
      const message = mapClientAuthErrorToMessage(error);

      if (
        error?.code === 'client/staff-account-blocked' &&
        verifiedCacheRef.current.accountType === 'staff' &&
        verifiedCacheRef.current.profile
      ) {
        if (verificationCounterRef.current === currentOperation) {
          setAuthState((prev) => ({
            ...prev,
            clientAuthError: message,
          }));
        }
        throw createAuthError(error.code, message);
      }

      activeUidRef.current = null;
      resetSessionIsolation();

      if (verificationCounterRef.current === currentOperation) {
        setAuthState({
          status: 'unauthenticated',
          accountType: null,
          user: null,
          profile: null,
          clientAccount: null,
          clientProfile: null,
          role: null,
          authError: null,
          clientAuthError: message,
        });
      }

      throw createAuthError(error?.code || 'client/auth-failed', message);
    }
  }, [attachClientAccountWatcher, resetSessionIsolation]);

  const logout = useCallback(async () => {
    ++verificationCounterRef.current;
    activeUidRef.current = null;
    loginInFlightRef.current = false;
    resetSessionIsolation();

    await signOutStaff();

    setAuthState({
      status: 'unauthenticated',
      accountType: null,
      user: null,
      profile: null,
      clientAccount: null,
      clientProfile: null,
      role: null,
      authError: null,
      clientAuthError: null,
    });
  }, [resetSessionIsolation]);

  const reauthenticate = useCallback(
    async (password) => {
      try {
        const result = await reauthenticateCurrentStaff(password);
        verifiedCacheRef.current = {
          uid: result.user.uid,
          accountType: 'staff',
          profile: result.profile,
          clientAccount: null,
          clientProfile: null,
          role: result.profile.role,
        };
        setLastReauthenticatedAt(result.reauthenticatedAt);
        setAuthState({
          status: 'authenticated',
          accountType: 'staff',
          user: result.user,
          profile: result.profile,
          clientAccount: null,
          clientProfile: null,
          role: result.profile.role,
          authError: null,
          clientAuthError: null,
        });
        return result;
      } catch (error) {
        if (
          error?.code === 'staff/account-inactive' ||
          error?.code === 'staff/profile-missing' ||
          error?.code === 'staff/invalid-role'
        ) {
          activeUidRef.current = null;
          resetSessionIsolation();
          setAuthState({
            status: 'unauthenticated',
            accountType: null,
            user: null,
            profile: null,
            clientAccount: null,
            clientProfile: null,
            role: null,
            authError: mapAuthErrorToMessage(error),
            clientAuthError: null,
          });
        }
        const message = mapReauthErrorToMessage(error);
        throw createAuthError(error?.code || 'auth/reauth-failed', message);
      }
    },
    [resetSessionIsolation],
  );

  const resetPassword = useCallback(async (email) => {
    try {
      return await requestStaffPasswordReset(email);
    } catch (error) {
      const message = mapPasswordResetErrorToMessage(error);
      throw createAuthError(error?.code || 'auth/reset-failed', message);
    }
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthState((prev) =>
      prev.authError || prev.clientAuthError
        ? { ...prev, authError: null, clientAuthError: null }
        : prev,
    );
  }, []);

  const clearClientAuthError = useCallback(() => {
    setAuthState((prev) => (prev.clientAuthError ? { ...prev, clientAuthError: null } : prev));
  }, []);

  const value = useMemo(
    () => ({
      user: authState.user,
      profile: authState.profile,
      accountType: authState.accountType,
      clientAccount: authState.clientAccount,
      clientProfile: authState.clientProfile,
      status: authState.status,
      role: authState.role,
      authError: authState.authError,
      clientAuthError: authState.clientAuthError,
      lastReauthenticatedAt,
      login,
      loginWithGoogle,
      logout,
      reauthenticate,
      resetPassword,
      clearAuthError,
      clearClientAuthError,
    }),
    [
      authState,
      clearAuthError,
      clearClientAuthError,
      lastReauthenticatedAt,
      login,
      loginWithGoogle,
      logout,
      reauthenticate,
      resetPassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
