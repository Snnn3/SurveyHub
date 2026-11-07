export interface ConfirmationModalProps {
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel: string;
  confirmButtonClass: string;
  processing?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmationModal({
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel,
  confirmButtonClass,
  processing = false,
  onCancel,
  onConfirm,
}: ConfirmationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
        <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
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
            className={`px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 ${confirmButtonClass}`}
          >
            {processing ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
