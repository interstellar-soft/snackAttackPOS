import { FormEvent, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface SyncStatus { connected: boolean; url?: string; lastSuccess?: string; error?: string; revision: number; acknowledged: number }
export function MobileSyncCard() {
  const token = useAuthStore(s => s.token) ?? undefined;
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const status = useQuery({ queryKey: ['mobile-sync'], queryFn: () => apiFetch<SyncStatus>('/api/admin/mobile-sync', {}, token), refetchInterval: 5000 });
  const pair = useMutation({ mutationFn: () => apiFetch('/api/admin/mobile-sync/pair', { method: 'POST', body: JSON.stringify({ url, code }) }, token),
    onSuccess: () => { setCode(''); void status.refetch(); } });
  const disconnect = useMutation({ mutationFn: () => apiFetch('/api/admin/mobile-sync', { method: 'DELETE' }, token), onSuccess: () => { void status.refetch(); } });
  function submit(e: FormEvent) { e.preventDefault(); pair.mutate(); }
  return <Card className="p-6"><CardHeader><CardTitle>Mobile admin dashboard</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm">Mirror your store data to your private mobile dashboard. Open the dashboard, generate a pairing code, then enter it here.</p>
    {status.data?.connected ? <>
      <p>Connected to {status.data.url}</p>
      <p className="text-sm">{status.data.lastSuccess ? `Last synchronized: ${new Date(status.data.lastSuccess).toLocaleString()}` : 'Preparing the first synchronization…'}</p>
      {status.data.error && <p role="status" className="text-amber-700">{status.data.error}</p>}
      <Button variant="secondary" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>Pause synchronization</Button>
      <p className="text-xs">Pausing keeps the existing mobile copy. Revoke the PC from the dashboard to disable its credential.</p>
    </> : <form onSubmit={submit} className="space-y-3">
      <label className="block">Dashboard URL<Input required type="url" placeholder="https://your-dashboard.example" value={url} onChange={e => setUrl(e.target.value)} /></label>
      <label className="block">Pairing code<Input required value={code} onChange={e => setCode(e.target.value)} autoComplete="off" /></label>
      <Button disabled={pair.isPending || status.isLoading}>{pair.isPending ? 'Connecting…' : 'Connect dashboard'}</Button>
    </form>}
    {[status.error, pair.error, disconnect.error].filter(Boolean).map((e, i) => <p role="alert" key={i} className="text-red-600">{e instanceof Error ? e.message : 'Unable to connect.'}</p>)}
    <p className="text-xs">Uploads run while Aurora POS is open. Checkout keeps working if the internet disconnects.</p>
  </CardContent></Card>;
}
