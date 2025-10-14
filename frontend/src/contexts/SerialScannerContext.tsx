import { createContext, useCallback, useContext, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import { useSerialBarcodeScanner } from '../hooks/useSerialBarcodeScanner';
import { SERIAL_PORT_HINT } from '../lib/serialConfig';

type SerialListener = (barcode: string) => void;
type SerialEventListener = () => void;

type SerialScannerContextValue = {
  isSupported: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  requestPort: () => Promise<void>;
  disconnect: () => Promise<void>;
  subscribeToScan: (listener: SerialListener) => () => void;
  subscribeToConnect: (listener: SerialEventListener) => () => void;
  subscribeToDisconnect: (listener: SerialEventListener) => () => void;
};

const SerialScannerContext = createContext<SerialScannerContextValue | null>(null);

function createSubscription<T extends (...args: never[]) => void>(listenersRef: MutableRefObject<Set<T>>) {
  return (listener: T) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  };
}

export function SerialScannerProvider({ children }: { children: ReactNode }) {
  const scanListenersRef = useRef(new Set<SerialListener>());
  const connectListenersRef = useRef(new Set<SerialEventListener>());
  const disconnectListenersRef = useRef(new Set<SerialEventListener>());

  const notifyListeners = useCallback(
    <T extends (...args: never[]) => void>(listeners: Set<T>, ...args: Parameters<T>) => {
      for (const listener of listeners) {
        try {
          listener(...args);
        } catch (error) {
          console.error('Serial listener error', error);
        }
      }
    },
    []
  );

  const handleScan = useCallback(
    (barcode: string) => {
      notifyListeners(scanListenersRef.current, barcode);
    },
    [notifyListeners]
  );

  const handleConnect = useCallback(() => {
    notifyListeners(connectListenersRef.current);
  }, [notifyListeners]);

  const handleDisconnect = useCallback(() => {
    notifyListeners(disconnectListenersRef.current);
  }, [notifyListeners]);

  const { isSupported, isConnecting, isConnected, error, requestPort, disconnect } = useSerialBarcodeScanner({
    onScan: handleScan,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    preferredPortHint: SERIAL_PORT_HINT
  });

  const subscribeToScan = useMemo(() => createSubscription(scanListenersRef), []);
  const subscribeToConnect = useMemo(() => createSubscription(connectListenersRef), []);
  const subscribeToDisconnect = useMemo(() => createSubscription(disconnectListenersRef), []);

  const value = useMemo<SerialScannerContextValue>(
    () => ({
      isSupported,
      isConnecting,
      isConnected,
      error,
      requestPort,
      disconnect,
      subscribeToScan,
      subscribeToConnect,
      subscribeToDisconnect
    }),
    [
      isSupported,
      isConnecting,
      isConnected,
      error,
      requestPort,
      disconnect,
      subscribeToScan,
      subscribeToConnect,
      subscribeToDisconnect
    ]
  );

  return <SerialScannerContext.Provider value={value}>{children}</SerialScannerContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSerialScanner() {
  const context = useContext(SerialScannerContext);
  if (!context) {
    throw new Error('useSerialScanner must be used within a SerialScannerProvider');
  }
  return context;
}
