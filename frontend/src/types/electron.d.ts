export type UpdaterMessage =
  | { status: 'checking' }
  | { status: 'available'; version?: string }
  | { status: 'not-available'; version?: string }
  | { status: 'downloading'; percent: number; transferred?: number; total?: number }
  | { status: 'downloaded'; version?: string }
  | { status: 'error'; message: string }
  | { status: 'dev-mode' }
  | { status: string; [key: string]: unknown };

type UpdateStatusCallback = (message: UpdaterMessage) => void;

declare global {
  interface Window {
    electronAPI?: {
      checkForUpdates?: () => Promise<unknown>;
      restartToUpdate?: () => Promise<void>;
      onUpdateStatus?: (callback: UpdateStatusCallback) => () => void;
    };
  }
}

export {};
