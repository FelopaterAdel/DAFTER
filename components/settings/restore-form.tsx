"use client";

import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function RestoreForm() {
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!confirmed) {
      setError("لازم تأكد إنك عايز تسترجع النسخة الأول.");
      return;
    }

    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("اختار ملف النسخة الاحتياطية.");
      return;
    }

    const body = new FormData();
    body.set("file", file);

    setPending(true);

    try {
      const response = await fetch("/api/restore", {
        method: "POST",
        body,
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; redirect?: string }
        | null;

      if (!response.ok) {
        setError(data?.error ?? "تعذر استرجاع النسخة. جرّب تاني.");
        return;
      }

      setMessage("تم الاسترجاع. هنوديك لصفحة الدخول...");
      window.location.assign(data?.redirect ?? "/login");
    } catch {
      setError("تعذر الاتصال بالسيرفر. جرّب تاني.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-sm font-bold text-ink">استرجاع نسخة احتياطية</p>
        <p className="mt-1 max-w-2xl text-xs leading-6 text-muted">
          الاسترجاع هيستبدل كل البيانات الحالية. بنحفظ نسخة أمان من الوضع الحالي
          قبل الاستبدال، وكل الأجهزة هتخرج وتحتاج تسجيل الدخول من جديد.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field
          label="ملف النسخة الاحتياطية"
          htmlFor="restoreFile"
          hint="ملف SQLite بصيغة .db — بحد أقصى 50 ميجابايت."
        >
          <Input
            id="restoreFile"
            name="file"
            type="file"
            accept=".db,application/vnd.sqlite3,application/octet-stream"
            disabled={pending}
            className="h-auto py-2.5 file:me-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink"
          />
        </Field>

        <Button type="submit" variant="danger" disabled={pending || !confirmed}>
          {pending ? "جارٍ الاسترجاع..." : "استرجاع النسخة"}
        </Button>
      </div>

      <label className="flex items-start gap-2.5 text-xs leading-6 text-ink">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={pending}
          className="mt-1 size-4 shrink-0 accent-danger"
        />
        أنا متأكد إن الاسترجاع هيستبدل البيانات الحالية.
      </label>

      {error ? <Alert>{error}</Alert> : null}
      {message ? (
        <Alert tone="success" role="status">
          {message}
        </Alert>
      ) : null}
    </form>
  );
}
