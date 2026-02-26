export type ToastItem = {
  id: number;
  type: "success" | "info" | "error";
  message: string;
};

const TYPE_CLASS: Record<ToastItem["type"], string> = {
  success: "border-[#c8decd] bg-[#edf7f0] text-[#1f4d45]",
  info: "border-[#d5c6b3] bg-[#f8f1e7] text-[#4e463f]",
  error: "border-[#dfb5b5] bg-[#f8e3e3] text-[#7c2727]",
};

export default function Toast({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-50 flex w-[min(92vw,300px)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-lg border px-3 py-2 text-xs ${TYPE_CLASS[toast.type]}`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="leading-relaxed">{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded border border-current/30 px-1.5 py-0.5 text-[10px] opacity-80"
            >
              X
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
