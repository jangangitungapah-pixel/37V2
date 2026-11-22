import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/AuthContext';

import { FACTORY_RESET_STATUS } from '../config/factory-reset-config';
import { getFactoryResetRepositoryAdapter } from '../repositories/factory-reset-repository';
import {
  cancelFactoryResetBeforeDeletion,
  previewFactoryReset,
  resumeFactoryReset,
  startFactoryReset,
} from '../services/factory-reset-service';
import {
  computeFactoryResetProgress,
  formatResetErrorForDisplay,
} from '../utils/factory-reset-manifest';
import { isFactoryResetLockedStatus } from '../utils/factory-reset-validation';

/**
 * Lightweight subscription hook for `systemOperations/factoryReset` maintenance lock state.
 * Used in AdminLayout & AdminCalendarPage for Owner maintenance notices.
 */
export function useFactoryResetStatus({ enabled = true } = {}) {
  const [state, setState] = useState({
    loaded: false,
    operation: null,
    error: '',
  });

  useEffect(() => {
    if (!enabled) return undefined;

    let isCancelled = false;
    const adapter = getFactoryResetRepositoryAdapter();
    const unsub = adapter.subscribeResetOperation({
      onData: (op) => {
        if (isCancelled) return;
        setState({
          loaded: true,
          operation: op,
          error: '',
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setState((prev) => ({
          ...prev,
          loaded: true,
          error: err?.message || '',
        }));
      },
    });

    return () => {
      isCancelled = true;
      unsub?.();
    };
  }, [enabled]);

  const activeOperation = enabled ? state.operation : null;
  const isLocked = Boolean(enabled && isFactoryResetLockedStatus(activeOperation?.status));
  const isRunning = Boolean(enabled && activeOperation?.status === FACTORY_RESET_STATUS.RUNNING);

  return {
    operation: activeOperation,
    isLoaded: state.loaded,
    isLocked,
    isRunning,
    error: state.error,
  };
}

/**
 * Full stateful controller hook for `/admin/settings/danger-area`.
 */
export function useFactoryReset() {
  const { user, profile, role, lastReauthenticatedAt, reauthenticate } = useAuth();
  const actor = useMemo(
    () => ({
      uid: user?.uid || '',
      user,
      profile,
      role,
    }),
    [profile, role, user],
  );
  const isActiveOwner = Boolean(
    user?.uid && profile?.active === true && role === 'owner' && profile?.role === 'owner',
  );

  const [preflightState, setPreflightState] = useState({
    isLoading: false,
    summary: null,
    error: '',
  });
  const [operationState, setOperationState] = useState({
    loaded: false,
    operation: null,
  });
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState('');
  const [isPauseRequested, setIsPauseRequested] = useState(false);
  const [sessionCompletedOperation, setSessionCompletedOperation] = useState(null);

  const executionLockRef = useRef(false);
  const pauseRequestedRef = useRef(false);

  // Realtime subscription to systemOperations/factoryReset
  useEffect(() => {
    if (!isActiveOwner) return undefined;

    let isCancelled = false;
    const adapter = getFactoryResetRepositoryAdapter();
    const unsub = adapter.subscribeResetOperation({
      onData: (op) => {
        if (isCancelled) return;
        setOperationState({
          loaded: true,
          operation: op,
        });
      },
      onError: () => {
        if (isCancelled) return;
        setOperationState((prev) => ({
          ...prev,
          loaded: true,
        }));
      },
    });

    return () => {
      isCancelled = true;
      unsub?.();
    };
  }, [isActiveOwner]);

  const runPreview = useCallback(async () => {
    if (!isActiveOwner) return null;
    setPreflightState((prev) => ({ ...prev, isLoading: true, error: '' }));
    try {
      const summary = await previewFactoryReset({ actor });
      setPreflightState({
        isLoading: false,
        summary,
        error: summary.isComplete
          ? ''
          : 'Sebagian koleksi gagal dihitung. Muat ulang pratinjau sebelum melanjutkan.',
      });
      return summary;
    } catch (err) {
      const msg = formatResetErrorForDisplay(err);
      setPreflightState({
        isLoading: false,
        summary: null,
        error: msg,
      });
      return null;
    }
  }, [actor, isActiveOwner]);

  useEffect(() => {
    if (!isActiveOwner) return undefined;
    let isCancelled = false;
    Promise.resolve().then(() => {
      if (!isCancelled) {
        void runPreview();
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [isActiveOwner, runPreview]);

  // Warn before accidental tab close while active batches are running
  useEffect(() => {
    if (!isExecuting) return undefined;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isExecuting]);

  const startReset = useCallback(
    async ({ confirmationPhrase, acknowledged, reauthenticatedAtOverride = null }) => {
      if (executionLockRef.current) return null;
      executionLockRef.current = true;
      pauseRequestedRef.current = false;
      setIsPauseRequested(false);
      setIsExecuting(true);
      setExecutionError('');
      setSessionCompletedOperation(null);

      try {
        const result = await startFactoryReset({
          actor,
          preflight: preflightState.summary,
          confirmationPhrase,
          acknowledged,
          reauthenticatedAt: reauthenticatedAtOverride ?? lastReauthenticatedAt,
          shouldPause: () => pauseRequestedRef.current,
          onProgress: (op) => {
            setOperationState({ loaded: true, operation: op });
          },
        });
        if (result?.status === FACTORY_RESET_STATUS.COMPLETED) {
          setSessionCompletedOperation(result);
        }
        return result;
      } catch (err) {
        setExecutionError(formatResetErrorForDisplay(err));
        throw err;
      } finally {
        executionLockRef.current = false;
        pauseRequestedRef.current = false;
        setIsPauseRequested(false);
        setIsExecuting(false);
      }
    },
    [actor, lastReauthenticatedAt, preflightState.summary],
  );

  const resumeReset = useCallback(
    async ({ reauthenticatedAtOverride = null } = {}) => {
      if (executionLockRef.current) return null;
      executionLockRef.current = true;
      pauseRequestedRef.current = false;
      setIsPauseRequested(false);
      setIsExecuting(true);
      setExecutionError('');

      try {
        const result = await resumeFactoryReset({
          actor,
          reauthenticatedAt: reauthenticatedAtOverride ?? lastReauthenticatedAt,
          shouldPause: () => pauseRequestedRef.current,
          onProgress: (op) => {
            setOperationState({ loaded: true, operation: op });
          },
        });
        if (result?.status === FACTORY_RESET_STATUS.COMPLETED) {
          setSessionCompletedOperation(result);
        }
        return result;
      } catch (err) {
        setExecutionError(formatResetErrorForDisplay(err));
        throw err;
      } finally {
        executionLockRef.current = false;
        pauseRequestedRef.current = false;
        setIsPauseRequested(false);
        setIsExecuting(false);
      }
    },
    [actor, lastReauthenticatedAt],
  );

  const requestPause = useCallback(() => {
    pauseRequestedRef.current = true;
    setIsPauseRequested(true);
  }, []);

  const cancelBeforeDeletion = useCallback(async () => {
    if (executionLockRef.current) return null;
    setExecutionError('');
    try {
      const res = await cancelFactoryResetBeforeDeletion({ actor });
      setOperationState({ loaded: true, operation: res });
      await runPreview();
      return res;
    } catch (err) {
      setExecutionError(formatResetErrorForDisplay(err));
      throw err;
    }
  }, [actor, runPreview]);

  const clearCompletedView = useCallback(async () => {
    setSessionCompletedOperation(null);
    setExecutionError('');
    await runPreview();
  }, [runPreview]);

  const activeOperation = operationState.operation;
  const isLocked = isFactoryResetLockedStatus(activeOperation?.status);
  const progress = useMemo(
    () => computeFactoryResetProgress(activeOperation, preflightState.summary),
    [activeOperation, preflightState.summary],
  );

  return {
    actor,
    isActiveOwner,
    reauthenticate,
    lastReauthenticatedAt,
    preflight: preflightState.summary,
    isPreviewLoading: preflightState.isLoading,
    previewError: preflightState.error,
    runPreview,
    operationLoaded: operationState.loaded,
    operation: activeOperation,
    isLocked,
    isExecuting,
    isPauseRequested,
    executionError,
    progress,
    sessionCompletedOperation,
    startReset,
    resumeReset,
    requestPause,
    cancelBeforeDeletion,
    clearCompletedView,
  };
}
