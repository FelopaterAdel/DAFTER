"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-5">
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        {description ? (
          <p className="mt-1.5 text-sm leading-6 text-muted">{description}</p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
      {footer ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line/80 px-5 py-4">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  pending = false,
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  tone?: "danger" | "primary";
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "جارٍ التنفيذ..." : confirmLabel}
          </Button>
        </>
      }
    />
  );
}
