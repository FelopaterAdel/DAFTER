import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { PrintButton } from "@/components/reports/print-button";
import { PrintHeader } from "@/components/reports/print-header";
import { ReportNav } from "@/components/reports/report-nav";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BriefcaseIcon,
  DownloadIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/dal";
import { formatMoney } from "@/lib/money";
import { getCustodyDebtReport } from "@/lib/queries/reports";

export const metadata: Metadata = {
  title: "مديونيات العهد",
};

export const instant = false;

export default async function CustodyDebtsReportPage() {
  const setting = await requireAuth();

  const report = await getCustodyDebtReport();

  return (
    <>
      <PrintHeader
        shopName={setting.shopName}
        title="مديونيات العهد"
      />

      <PageHeader
        eyebrow="التقارير"
        title="مديونيات العهد"
        description="الأرصدة المستحقة على كل عهدة، والأرصدة الدائنة اللي دفعتها زيادة."
        actions={
          <>
            <Link
              href="/api/export/custody-debts"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              <DownloadIcon className="size-4" />
              تصدير CSV
            </Link>
            <PrintButton />
            <Link
              href="/reports"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              كل التقارير
            </Link>
          </>
        }
      />

      <ReportNav active="custody-debts" />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="إجمالي المستحق"
          value={formatMoney(report.totals.debtCents)}
          hint={`${report.debtors.length} عهدة عليها رصيد`}
          icon={BriefcaseIcon}
          tone="brand"
        />
        <StatCard
          label="أرصدة دائنة"
          value={formatMoney(report.totals.creditCents)}
          hint={`${report.credits.length} عهدة دافعة زيادة`}
          icon={WalletIcon}
          tone="gold"
        />
        <StatCard
          label="الصافي"
          value={formatMoney(report.totals.netCents)}
          hint="المستحق ناقص الدائن"
          icon={WalletIcon}
          tone="info"
        />
        <StatCard
          label="عهد برصيد صفر"
          value={String(report.zeroCount)}
          hint="مش ظاهرة في الجداول"
          icon={BriefcaseIcon}
          tone="danger"
        />
      </section>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>عهد عليها مستحق</CardTitle>
          <Badge tone="danger">{report.debtors.length}</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          {report.debtors.length === 0 ? (
            <EmptyState
              icon={BriefcaseIcon}
              title="مفيش عهد عليها مستحق"
              description="كل العهد مسددة أو لسه ما اتسجلتش عليها أرصدة مدينة."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>العهدة</TableHeaderCell>
                  <TableHeaderCell>الهاتف</TableHeaderCell>
                  <TableHeaderCell>الحالة</TableHeaderCell>
                  <TableHeaderCell>الرصيد</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.debtors.map((custody) => (
                  <TableRow key={custody.id}>
                    <TableCell>
                      <Link
                        href={`/custodies/${custody.id}`}
                        className="font-bold text-ink hover:text-brand"
                      >
                        {custody.name}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted" dir="ltr">
                      {custody.phone || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge tone={custody.isActive ? "success" : "neutral"}>
                        {custody.isActive ? "نشطة" : "موقوفة"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-extrabold text-brand-dark">
                      {formatMoney(custody.balanceCents)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-surface-muted/50 hover:bg-surface-muted/50">
                  <TableCell className="font-extrabold text-ink" colSpan={3}>
                    الإجمالي
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-extrabold text-brand-dark">
                    {formatMoney(report.totals.debtCents)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>عهد دافعة زيادة</CardTitle>
          <Badge tone="gold">{report.credits.length}</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          {report.credits.length === 0 ? (
            <EmptyState
              icon={WalletIcon}
              title="مفيش أرصدة دائنة"
              description="مفيش عهدة دفعتها أكتر من المستحق عليها."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>العهدة</TableHeaderCell>
                  <TableHeaderCell>الهاتف</TableHeaderCell>
                  <TableHeaderCell>الحالة</TableHeaderCell>
                  <TableHeaderCell>المبلغ الدائن</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.credits.map((custody) => (
                  <TableRow key={custody.id}>
                    <TableCell>
                      <Link
                        href={`/custodies/${custody.id}`}
                        className="font-bold text-ink hover:text-brand"
                      >
                        {custody.name}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted" dir="ltr">
                      {custody.phone || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge tone={custody.isActive ? "success" : "neutral"}>
                        {custody.isActive ? "نشطة" : "موقوفة"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-extrabold text-gold">
                      {formatMoney(-custody.balanceCents)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-surface-muted/50 hover:bg-surface-muted/50">
                  <TableCell className="font-extrabold text-ink" colSpan={3}>
                    الإجمالي
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-extrabold text-gold">
                    {formatMoney(report.totals.creditCents)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 rounded-xl bg-surface-muted/60 px-3.5 py-3 text-xs leading-6 text-muted">
        رصيد العهدة = الرصيد الافتتاحي + البضاعة المسلّمة − المرتجعات + الشحن
        اليدوي − التحصيل العام. دفعات زبائن العهدة مش بتقلّل رصيد العهدة لأنها
        بتتسدد للسيلر.
      </p>
    </>
  );
}
