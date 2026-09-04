"use client";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
};

export default function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  isPending,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const confirmClass =
    variant === "danger"
      ? "bg-agro-forest text-white hover:bg-agro-forest/90"
      : variant === "warning"
        ? "bg-agro-wheat text-agro-ink hover:bg-agro-wheat/90"
        : "bg-agro-canopy text-white hover:bg-agro-forest";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-agro-night/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-agro-forest">{title}</h2>
        <p className="mt-2 text-sm text-agro-slate">{description}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex justify-center rounded-xl border border-agro-sprout bg-white px-4 py-2.5 text-sm font-semibold text-agro-ink transition-colors hover:bg-agro-paper disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`inline-flex justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${confirmClass}`}
          >
            {isPending ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
