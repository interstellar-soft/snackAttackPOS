import { Button } from '../ui/button';

interface OverrideModalProps {
  reason: string;
  onApprove: () => void;
  onCancel: () => void;
}

export function OverrideModal({ reason, onApprove, onCancel }: OverrideModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-red-500">Attention Required</h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-200">
          {reason.includes('vision')
            ? 'Vision mismatch detected. Supervisor override required before tender.'
            : 'Potential scanning anomaly detected. Confirm to override and continue.'}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" className="bg-slate-600 hover:bg-slate-500" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onApprove}>
            Override
          </Button>
        </div>
      </div>
    </div>
  );
}
