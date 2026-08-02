"use client";

import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    }
  }, [open]);

  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      onCancel();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      onClick={handleBackdropClick}
      aria-labelledby="confirm-dialog-heading"
      aria-describedby="confirm-dialog-message"
      className="m-auto w-[90vw] max-w-md rounded-lg border border-ink-border/10 bg-surface p-6 text-ink backdrop:bg-black/50"
    >
      <h2 id="confirm-dialog-heading" className="text-lg font-semibold">
        {title}
      </h2>
      <p id="confirm-dialog-message" className="mt-2 text-sm text-ink-muted">
        {message}
      </p>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-ink-border/15 px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
