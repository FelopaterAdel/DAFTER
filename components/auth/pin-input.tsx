"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";
import { normalizeDigits } from "@/lib/text";

const LENGTH = 4;

export function PinInput({
  name,
  label,
  hint,
  autoFocus = false,
}: {
  name: string;
  label: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  const labelId = useId();
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: LENGTH }, () => ""),
  );
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  function focusAt(index: number) {
    const bounded = Math.max(0, Math.min(LENGTH - 1, index));
    inputs.current[bounded]?.focus();
    inputs.current[bounded]?.select();
  }

  function writeFrom(raw: string, start: number) {
    const clean = normalizeDigits(raw)
      .replace(/\D/g, "")
      .slice(0, LENGTH - start);

    if (!clean) return;

    const next = [...digits];
    for (let index = 0; index < clean.length; index += 1) {
      next[start + index] = clean[index];
    }

    setDigits(next);
    focusAt(start + clean.length);
  }

  function handleChange(index: number, raw: string) {
    const clean = normalizeDigits(raw).replace(/\D/g, "");

    if (!clean) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }

    if (clean.length > 1) {
      writeFrom(clean, index);
      return;
    }

    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    focusAt(index + 1);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...digits];

      if (next[index]) {
        next[index] = "";
        setDigits(next);
        return;
      }

      if (index > 0) {
        next[index - 1] = "";
        setDigits(next);
        focusAt(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAt(index - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAt(index + 1);
    }

    if (event.key === "Delete") {
      event.preventDefault();
      const next = [...digits];
      next[index] = "";
      setDigits(next);
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    writeFrom(event.clipboardData.getData("text"), index);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span id={labelId} className="text-sm font-semibold text-ink">
          {label}
        </span>
        <span className="text-[11px] font-medium text-muted">4 أرقام</span>
      </div>

      <input type="hidden" name={name} value={digits.join("")} />

      <div
        role="group"
        aria-labelledby={labelId}
        dir="ltr"
        className="grid grid-cols-4 gap-2"
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            value={digit}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onFocus={(event) => event.target.select()}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            aria-label={`الرقم ${index + 1} من ${LENGTH}`}
            className={cn(
              "h-14 w-full rounded-xl border border-line bg-surface text-center text-2xl font-extrabold tracking-widest text-ink shadow-[0_1px_0_rgb(27_36_32/0.03)] transition-colors",
              "focus:border-brand focus:outline-none",
              digit ? "border-brand/45 bg-brand-soft/35" : "",
            )}
          />
        ))}
      </div>

      {hint ? <p className="mt-1.5 text-xs leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}
