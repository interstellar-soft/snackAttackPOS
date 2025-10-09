import { ChangeEventHandler, ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { API_BASE_URL } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

interface StatusMessage {
  type: 'success' | 'error';
  content: ReactNode;
}

export function BackupCard() {
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!status) return;
    const handle = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(handle);
  }, [status]);

  const handleExport = async () => {
    if (!token) {
      setStatus({ type: 'error', content: t('adminBackupAuthError') });
      return;
    }

    setStatus(null);
    setIsExporting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/backup/export`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition') ?? '';
      const fileNameMatch = /filename\*=UTF-8''([^;]+)/.exec(contentDisposition) ?? /filename="?([^";]+)"?/.exec(contentDisposition);
      const suggestedName = fileNameMatch && fileNameMatch[1] ? decodeURIComponent(fileNameMatch[1]) : `aurora-backup-${Date.now()}.json`;

      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = suggestedName;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);

      setStatus({ type: 'success', content: t('adminBackupExportSuccess') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('adminBackupExportError');
      setStatus({ type: 'error', content: message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile: ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !token) {
      return;
    }

    setStatus(null);
    setIsImporting(true);

    try {
      const text = await file.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch (error) {
        throw new Error(t('adminBackupInvalidFile'));
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/backup/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Import failed with status ${response.status}`);
      }

      const result = (await response.json()) as { recordsImported?: Record<string, number> };
      const counts = Object.values(result.recordsImported ?? {});
      const total = counts.reduce((sum, value) => sum + value, 0);

      setStatus({
        type: 'success',
        content: t('adminBackupImportSuccess', { count: total })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('adminBackupImportError');
      setStatus({ type: 'error', content: message });
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <CardHeader className="flex-col items-start gap-2 px-0">
        <CardTitle>{t('adminBackupTitle')}</CardTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('adminBackupIntro')}</p>
      </CardHeader>
      <CardContent className="space-y-4 px-0">
        {status && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              status.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600/40 dark:bg-emerald-900/20 dark:text-emerald-200'
                : 'border-red-300 bg-red-50 text-red-700 dark:border-red-600/40 dark:bg-red-900/20 dark:text-red-200'
            }`}
          >
            {status.content}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport} disabled={isExporting || isImporting}>
            {isExporting ? t('adminBackupExporting') : t('adminBackupExportButton')}
          </Button>
          <Button
            type="button"
            onClick={handleImportClick}
            disabled={isImporting || isExporting}
            className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100"
          >
            {isImporting ? t('adminBackupImporting') : t('adminBackupImportButton')}
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImportFile}
        />
      </CardContent>
    </Card>
  );
}
