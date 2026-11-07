export type ConfirmationModalVariant = 'danger' | 'warning' | 'primary' | 'neutral';

const variantClasses: Record<ConfirmationModalVariant, string> = {
  danger: 'bg-red-600 hover:bg-red-700',
  warning: 'bg-amber-600 hover:bg-amber-700',
  primary: 'bg-indigo-600 hover:bg-indigo-700',
  neutral: 'bg-slate-800 hover:bg-slate-900',
};

export interface ConfirmationModalProps {
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel: string;
  variant?: ConfirmationModalVariant;
  processing?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmationModal({
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel,
  variant = 'primary',
  processing = false,
  onCancel,
  onConfirm,
}: ConfirmationModalProps) {
  const buttonColorClass = variantClasses[variant] || variantClasses.primary;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
    >
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
        <h3 id="confirmation-modal-title" className="text-base font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 ${buttonColorClass}`}
          >
            {processing ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
