import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface CurrencyRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rate: number, notes?: string) => Promise<void>;
  currentRate: number;
}

export function CurrencyRateModal({ isOpen, onClose, onSave, currentRate }: CurrencyRateModalProps) {
  const [rate, setRate] = useState(currentRate);
  const [notes, setNotes] = useState('');
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    setRate(currentRate);
  }, [currentRate]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    await onSave(rate, notes);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Currency & Rate</h2>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm text-slate-600">1 USD equals</label>
            <Input type="number" value={rate} min={1} step="100" onChange={(event) => setRate(Number(event.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Notes</label>
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Reason for change" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" className="bg-slate-600 hover:bg-slate-500" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
