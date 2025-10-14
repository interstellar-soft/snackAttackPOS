import { useCallback, useEffect, useRef, useState } from 'react';

type UseSerialBarcodeScannerOptions = {
  onScan: (barcode: string) => void;
  baudRate?: number;
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

type UseSerialBarcodeScannerResult = {
  isSupported: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  requestPort: () => Promise<void>;
  disconnect: () => Promise<void>;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string' && error.message.trim() !== '') {
    return error.message;
  }
  return 'Unknown serial error';
}

export function useSerialBarcodeScanner({
  onScan,
  baudRate = 9600,
  autoConnect = true,
  onConnect,
  onDisconnect
}: UseSerialBarcodeScannerOptions): UseSerialBarcodeScannerResult {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const bufferRef = useRef('');
  const isConnectedRef = useRef(false);
  const keepReadingRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
  }, [onDisconnect]);

  const isSupported = typeof navigator !== 'undefined' && 'serial' in navigator;

  const disconnectInternal = useCallback(async () => {
    keepReadingRef.current = false;

    const reader = readerRef.current;
    readerRef.current = null;
    if (reader) {
      try {
        await reader.cancel();
      } catch (readerError) {
        console.error('Failed to cancel serial reader', readerError);
      }
      try {
        reader.releaseLock();
      } catch (releaseError) {
        console.error('Failed to release serial reader', releaseError);
      }
    }

    const port = portRef.current;
    portRef.current = null;
    if (port) {
      try {
        await port.close();
      } catch (portError) {
        console.error('Failed to close serial port', portError);
      }
    }

    bufferRef.current = '';

    if (isConnectedRef.current) {
      isConnectedRef.current = false;
      setIsConnected(false);
      onDisconnectRef.current?.();
    }
  }, []);

  const processChunk = useCallback((chunk: string) => {
    if (!chunk) {
      return;
    }

    bufferRef.current += chunk.replace(/\r/g, '\n');

    let newlineIndex = bufferRef.current.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = bufferRef.current.slice(0, newlineIndex).trim();
      bufferRef.current = bufferRef.current.slice(newlineIndex + 1);

      if (line) {
        onScanRef.current(line);
      }

      newlineIndex = bufferRef.current.indexOf('\n');
    }
  }, []);

  const startReading = useCallback(() => {
    const reader = readerRef.current;
    if (!reader) {
      return;
    }

    const decoder = new TextDecoder();

    const readLoop = async () => {
      try {
        while (keepReadingRef.current) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          if (value) {
            const decoded = decoder.decode(value, { stream: true });
            processChunk(decoded);
          }
        }

        const remainder = bufferRef.current.trim();
        if (remainder) {
          bufferRef.current = '';
          onScanRef.current(remainder);
        }
      } catch (readError) {
        const message = getErrorMessage(readError);
        console.error('Serial read error', readError);
        setError(message);
      } finally {
        await disconnectInternal();
      }
    };

    void readLoop();
  }, [disconnectInternal, processChunk]);

  const connectToPort = useCallback(
    async (port: SerialPort) => {
      if (!port) {
        throw new Error('Serial port unavailable');
      }

      try {
        await port.open({ baudRate });
      } catch (openError) {
        throw new Error(getErrorMessage(openError));
      }

      const readable = port.readable;
      if (!readable) {
        await port.close().catch(() => {
          // ignore close errors
        });
        throw new Error('Serial port is not readable');
      }

      const reader = readable.getReader();
      readerRef.current = reader;
      portRef.current = port;
      bufferRef.current = '';
      keepReadingRef.current = true;
      setError(null);

      if (!isConnectedRef.current) {
        isConnectedRef.current = true;
        setIsConnected(true);
        onConnectRef.current?.();
      }

      startReading();
    },
    [baudRate, startReading]
  );

  const requestPort = useCallback(async () => {
    if (!isSupported || !navigator.serial) {
      setError('Web Serial API is not available in this browser.');
      return;
    }

    setIsConnecting(true);
    try {
      const port = await navigator.serial.requestPort();
      await connectToPort(port);
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      if (message !== 'The user aborted a request.') {
        setError(message);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [connectToPort, isSupported]);

  const disconnect = useCallback(async () => {
    await disconnectInternal();
  }, [disconnectInternal]);

  useEffect(() => {
    if (!isSupported || !autoConnect || isConnectedRef.current) {
      return;
    }

    let cancelled = false;
    setIsConnecting(true);
    navigator.serial
      ?.getPorts()
      .then(async (ports) => {
        if (cancelled || isConnectedRef.current) {
          return;
        }
        const [port] = ports;
        if (port) {
          try {
            await connectToPort(port);
          } catch (connectError) {
            const message = getErrorMessage(connectError);
            setError(message);
          }
        }
      })
      .catch((enumerationError) => {
        const message = getErrorMessage(enumerationError);
        setError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsConnecting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [autoConnect, connectToPort, isSupported]);

  useEffect(() => {
    if (!isSupported || !navigator.serial) {
      return;
    }

    const handleDisconnect = (event: SerialConnectionEvent) => {
      if (portRef.current && event.port === portRef.current) {
        void disconnectInternal();
      }
    };

    navigator.serial.addEventListener('disconnect', handleDisconnect);
    return () => {
      navigator.serial?.removeEventListener('disconnect', handleDisconnect);
    };
  }, [disconnectInternal, isSupported]);

  useEffect(() => {
    return () => {
      void disconnectInternal();
    };
  }, [disconnectInternal]);

  return {
    isSupported,
    isConnecting,
    isConnected,
    error,
    requestPort,
    disconnect
  };
}
