import type { ComponentType, SVGProps } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckIcon, SparkIcon } from "@/components/ui/icons";

export function ComingSoon({
  eyebrow,
  title,
  description,
  icon: Icon,
  features,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  features: string[];
}) {
  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={<Badge tone="gold">قيد التجهيز</Badge>}
      />

      <Card className="overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="relative flex min-h-48 items-center justify-center overflow-hidden bg-brand p-8 text-white">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent 0 31px, rgba(255,255,255,.25) 31px 32px)",
              }}
            />
            <span className="relative grid size-20 place-items-center rounded-3xl bg-white/12 ring-1 ring-white/20">
              <Icon className="size-9" />
            </span>
          </div>

          <CardContent className="p-6 sm:p-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-[11px] font-bold text-gold">
              <SparkIcon className="size-3.5" />
              المرحلة الجاية
            </span>
            <h2 className="mt-4 text-xl font-extrabold text-ink">
              الشاشة دي هتتبني قريبًا
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              الأساس جاهز خلاص: قاعدة البيانات، تسجيل الدخول، الهيكل، والتنسيق.
              دي الحاجات اللي هتتضاف هنا:
            </p>

            <ul className="mt-4 space-y-2.5">
              {features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-sm leading-6 text-ink"
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-dark">
                    <CheckIcon className="size-3" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
        </div>
      </Card>
    </>
  );
}
