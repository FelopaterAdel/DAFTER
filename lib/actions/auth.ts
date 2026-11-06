"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/dal";
import { verifyPin, hashPin } from "@/lib/auth/pin";
import {
  clearFailedAttempts,
  lockoutRemainingSeconds,
  recordFailedAttempt,
  remainingAttempts,
} from "@/lib/auth/rate-limit";
import { createSession, destroySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { type FormState } from "@/lib/forms";
import { getSetting } from "@/lib/settings";
import { normalizeDigits } from "@/lib/text";

export type AuthFormState = {
  error: string | null;
};

const pinSchema = z
  .string()
  .regex(/^\d{4}$/, "الرمز السري لازم يكون 4 أرقام بالظبط.");

const setupSchema = z
  .object({
    shopName: z
      .string()
      .trim()
      .min(2, "اكتب اسم المحل أو النشاط (حرفين على الأقل).")
      .max(80, "اسم المحل طويل جدًا."),
    pin: pinSchema,
    confirmPin: z.string(),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: "الرمز وتأكيده مش متطابقين.",
    path: ["confirmPin"],
  });

export async function setupAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const existing = await getSetting();

  if (existing) {
    return { error: "النظام متظبط بالفعل. تقدر تدخل بالرمز السري." };
  }

  const parsed = setupSchema.safeParse({
    shopName: formData.get("shopName"),
    pin: normalizeDigits(String(formData.get("pin") ?? "")),
    confirmPin: normalizeDigits(String(formData.get("confirmPin") ?? "")),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "راجع البيانات وحاول تاني." };
  }

  const setting = await db.setting.create({
    data: {
      id: 1,
      shopName: parsed.data.shopName,
      pinHash: hashPin(parsed.data.pin),
    },
  });

  await createSession(setting.sessionVersion);
  redirect("/");
}

export async function loginAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const lockedFor = lockoutRemainingSeconds();

  if (lockedFor > 0) {
    const minutes = Math.ceil(lockedFor / 60);
    return {
      error: `الدخول مقفول مؤقتًا. جرّب تاني بعد ${minutes} دقيقة.`,
    };
  }

  const setting = await getSetting();

  if (!setting) {
    return { error: "النظام لسه مش متظبط. ابدأ بإعداد دفتر الأول." };
  }

  const pin = normalizeDigits(String(formData.get("pin") ?? ""));

  if (!pinSchema.safeParse(pin).success) {
    return { error: "اكتب الرمز السري (4 أرقام)." };
  }

  if (!verifyPin(pin, setting.pinHash)) {
    const attempt = recordFailedAttempt();

    if (attempt.lockedUntil > Date.now()) {
      return {
        error: "تم قفل الدخول لمدة 5 دقائق بعد 5 محاولات خاطئة.",
      };
    }

    return {
      error: `الرمز غلط. باقي لك ${remainingAttempts()} محاولات قبل القفل المؤقت.`,
    };
  }

  clearFailedAttempts();
  await createSession(setting.sessionVersion);
  redirect("/");
}

export async function changePinAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const setting = await requireAuth();

  const lockedFor = lockoutRemainingSeconds("pin-change");
  if (lockedFor > 0) {
    const minutes = Math.ceil(lockedFor / 60);
    return {
      error: `تغيير الرمز مقفول مؤقتًا. جرّب تاني بعد ${minutes} دقيقة.`,
      success: null,
    };
  }

  const currentPin = normalizeDigits(String(formData.get("currentPin") ?? ""));
  const newPin = normalizeDigits(String(formData.get("newPin") ?? ""));
  const confirmPin = normalizeDigits(String(formData.get("confirmPin") ?? ""));

  if (!pinSchema.safeParse(currentPin).success) {
    return { error: "اكتب الرمز الحالي (4 أرقام).", success: null };
  }

  if (!pinSchema.safeParse(newPin).success) {
    return {
      error: "الرمز الجديد لازم يكون 4 أرقام بالظبط.",
      success: null,
    };
  }

  if (newPin !== confirmPin) {
    return {
      error: "الرمز الجديد وتأكيده مش متطابقين.",
      success: null,
    };
  }

  if (newPin === currentPin) {
    return {
      error: "الرمز الجديد لازم يختلف عن القديم.",
      success: null,
    };
  }

  if (!verifyPin(currentPin, setting.pinHash)) {
    const attempt = recordFailedAttempt("pin-change");

    if (attempt.lockedUntil > Date.now()) {
      return {
        error: "تغيير الرمز مقفول لمدة 5 دقائق بعد 5 محاولات خاطئة.",
        success: null,
      };
    }

    return {
      error: `الرمز الحالي غلط. باقي لك ${remainingAttempts("pin-change")} محاولات قبل القفل المؤقت.`,
      success: null,
    };
  }

  const updated = await db.setting.update({
    where: { id: 1 },
    data: {
      pinHash: hashPin(newPin),
      pinChangedAt: new Date(),
      sessionVersion: { increment: 1 },
    },
  });

  clearFailedAttempts("pin-change");
  await createSession(updated.sessionVersion);
  revalidatePath("/settings");

  return {
    error: null,
    success: "تم تغيير الرمز السري. الأجهزة التانية هتخرج من الحساب.",
  };
}

export async function logoutAction() {
  await requireAuth();
  await destroySession();
  redirect("/login");
}
