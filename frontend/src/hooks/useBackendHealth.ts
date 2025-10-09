import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../lib/api';

type HealthStatus = 'checking' | 'online' | 'offline';

interface BackendHealthResult {
  status: HealthStatus;
  error: string | null;
  checkHealth: () => Promise<void>;
}

export function useBackendHealth(pollIntervalMs = 5000): BackendHealthResult {
  const [status, setStatus] = useState<HealthStatus>('checking');
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runCheck = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setStatus('checking');

    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        const message = await response.text();
        setStatus('offline');
        setError(message || `Health check failed with status ${response.status}`);
        return;
      }

      setStatus('online');
      setError(null);
    } catch (caughtError) {
      setStatus('offline');
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to reach the Aurora POS backend.'
      );
    } finally {
      if (pollIntervalMs > 0) {
        timeoutRef.current = setTimeout(() => {
          void runCheck();
        }, pollIntervalMs);
      }
    }
  }, [pollIntervalMs]);

  useEffect(() => {
    void runCheck();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [runCheck]);

  return {
    status,
    error,
    checkHealth: runCheck
  };
}
