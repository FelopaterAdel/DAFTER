import type { NextRequest } from "next/server";

import { getAuthenticatedSetting } from "@/lib/auth/dal";
import { isValidISODate, todayISO } from "@/lib/dates";
import { csvAmount, toCsv } from "@/lib/reports/csv";
import {
  defaultPeriod,
  formatGroupLabel,
  normalizeRange,
} from "@/lib/reports/periods";
import {
  getCollectionsReport,
  getCustodyDebtReport,
  getCustomerDebtReport,
  getWarehouseReport,
} from "@/lib/queries/reports";
import type {
  CollectionsGrouping,
  CustomerDebtType,
} from "@/lib/queries/reports";

/**
 * CSV export for the four reports. It deliberately reuses the same query
 * functions and the same param parsing as the report pages, so a downloaded
 * file can never disagree with what was on screen.
 */

const REPORTS = [
  "collections",
  "custody-debts",
  "customer-debts",
  "warehouse",
] as const;

type ReportKey = (typeof REPORTS)[number];

const NOT_AUTHORIZED = { error: "مش مسموح. سجّل الدخول الأول." };

function badRequest(message: string) {
  return { error: message, status: 400 };
}

function firstParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? "";
}

/** Missing dates fall back to the default period; malformed ones are a 400. */
function readDate(
  searchParams: URLSearchParams,
  key: string,
  fallback: string,
): string | null {
  const value = firstParam(searchParams, key);
  if (!value) return fallback;
  if (!isValidISODate(value)) return null;
  return value;
}

function statusLabel(isActive: boolean) {
  return isActive ? "نشطة" : "موقوفة";
}

const typeLabels: Record<CustomerDebtType, string> = {
  all: "كل الزبائن",
  custody: "زبائن العهد",
  direct: "زبائن مباشرين",
};

async function buildCsv(
  report: ReportKey,
  searchParams: URLSearchParams,
): Promise<{ body: string } | { error: string; status: number }> {
  if (report === "collections") {
    const today = todayISO();
    const from = readDate(searchParams, "from", defaultPeriod(today).from);
    const to = readDate(searchParams, "to", defaultPeriod(today).to);
    if (from === null || to === null) {
      return badRequest("التاريخ لازم يكون بصيغة YYYY-MM-DD.");
    }

    const period = normalizeRange(from, to, defaultPeriod(today));
    const requestedGroup = firstParam(searchParams, "groupBy");
    const groupBy: CollectionsGrouping =
      requestedGroup === "week" || requestedGroup === "month"
        ? requestedGroup
        : "day";
    const custodyId = firstParam(searchParams, "custodyId");

    const data = await getCollectionsReport({
      from: period.from,
      to: period.to,
      groupBy,
      custodyId: custodyId || undefined,
    });

    return {
      body: toCsv(
        [
          "الفترة",
          "عدد الحركات",
          "تحصيل العهد (جنيه)",
          "دفعات مباشرة (جنيه)",
          "الإجمالي (جنيه)",
        ],
        [
          ...data.rows.map((row) => [
            formatGroupLabel(groupBy, row.key),
            row.count,
            csvAmount(row.custodyCents),
            csvAmount(row.directCents),
            csvAmount(row.totalCents),
          ]),
          [
            "الإجمالي",
            data.totals.count,
            csvAmount(data.totals.custodyCents),
            csvAmount(data.totals.directCents),
            csvAmount(data.totals.totalCents),
          ],
        ],
      ),
    };
  }

  if (report === "custody-debts") {
    const data = await getCustodyDebtReport();

    const rows = [
      ...data.debtors.map((custody) => [
        custody.name,
        custody.phone ?? "",
        statusLabel(custody.isActive),
        "مدينة",
        csvAmount(custody.balanceCents),
      ]),
      ...data.credits.map((custody) => [
        custody.name,
        custody.phone ?? "",
        statusLabel(custody.isActive),
        "دائنة",
        csvAmount(-custody.balanceCents),
      ]),
      [
        "الإجمالي",
        "",
        "",
        "إجمالي المستحق",
        csvAmount(data.totals.debtCents),
      ],
      [
        "الإجمالي",
        "",
        "",
        "إجمالي الدائن",
        csvAmount(data.totals.creditCents),
      ],
      ["الصافي", "", "", "", csvAmount(data.totals.netCents)],
    ];

    return {
      body: toCsv(
        ["العهدة", "الهاتف", "الحالة", "نوع الرصيد", "المبلغ (جنيه)"],
        rows,
      ),
    };
  }

  if (report === "customer-debts") {
    const today = todayISO();
    const asOf = readDate(searchParams, "asOf", today);
    if (asOf === null) {
      return badRequest("التاريخ لازم يكون بصيغة YYYY-MM-DD.");
    }

    const requestedType = firstParam(searchParams, "type");
    const type: CustomerDebtType =
      requestedType === "custody" || requestedType === "direct"
        ? requestedType
        : "all";

    const data = await getCustomerDebtReport({ type, asOf });

    const rows = [
      ...data.debtors.map((customer) => [
        customer.name,
        typeLabels[customer.type],
        customer.custodyName ?? customer.country ?? "",
        csvAmount(customer.balanceCents),
        csvAmount(customer.bucket0to30),
        csvAmount(customer.bucket31to60),
        csvAmount(customer.bucket61plus),
        csvAmount(0),
      ]),
      ...data.credits.map((customer) => [
        customer.name,
        typeLabels[customer.type],
        customer.custodyName ?? customer.country ?? "",
        csvAmount(customer.balanceCents),
        csvAmount(0),
        csvAmount(0),
        csvAmount(0),
        csvAmount(customer.creditCents),
      ]),
      [
        "الإجمالي",
        typeLabels[type],
        "",
        csvAmount(data.totals.debtCents),
        csvAmount(data.totals.bucket0to30),
        csvAmount(data.totals.bucket31to60),
        csvAmount(data.totals.bucket61plus),
        csvAmount(0),
      ],
      [
        "إجمالي الأرصدة الدائنة",
        typeLabels[type],
        "",
        csvAmount(0),
        csvAmount(0),
        csvAmount(0),
        csvAmount(0),
        csvAmount(data.totals.creditCents),
      ],
    ];

    return {
      body: toCsv(
        [
          "الزبون",
          "النوع",
          "الجهة",
          "الرصيد (جنيه)",
          "0–30 (جنيه)",
          "31–60 (جنيه)",
          "أكثر من 60 (جنيه)",
          "الرصيد الدائن (جنيه)",
        ],
        rows,
      ),
    };
  }

  const today = todayISO();
  const from = readDate(searchParams, "from", defaultPeriod(today).from);
  const to = readDate(searchParams, "to", defaultPeriod(today).to);
  if (from === null || to === null) {
    return badRequest("التاريخ لازم يكون بصيغة YYYY-MM-DD.");
  }

  const period = normalizeRange(from, to, defaultPeriod(today));
  const productId = firstParam(searchParams, "productId");

  const data = await getWarehouseReport({
    from: period.from,
    to: period.to,
    productId: productId || undefined,
  });

  const statusLabels = { in: "متوفر", low: "قليل", out: "نافد" } as const;

  return {
    body: toCsv(
      [
        "الصنف",
        "الوحدة",
        "الحالة",
        "الكمية",
        "سعر التكلفة (جنيه)",
        "قيمة التكلفة (جنيه)",
        "سعر البيع (جنيه)",
        "قيمة البيع (جنيه)",
        "داخل",
        "خارج",
        "تسوية",
      ],
      [
        ...data.rows.map((row) => [
          row.name,
          row.unit ?? "",
          statusLabels[row.status],
          row.quantity,
          csvAmount(row.costPriceCents),
          csvAmount(row.costValueCents),
          row.salePriceCents === null ? "" : csvAmount(row.salePriceCents),
          row.saleValueCents === null ? "" : csvAmount(row.saleValueCents),
          row.inQty,
          row.outQty,
          row.adjustQty,
        ]),
        [
          "الإجمالي",
          "",
          "",
          data.totals.quantity,
          "",
          csvAmount(data.totals.costValueCents),
          "",
          csvAmount(data.totals.saleValueCents),
          data.totals.inQty,
          data.totals.outQty,
          data.totals.adjustQty,
        ],
      ],
    ),
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ report: string }> },
) {
  const setting = await getAuthenticatedSetting();
  if (!setting) {
    return Response.json(NOT_AUTHORIZED, { status: 401 });
  }

  const { report } = await context.params;

  if (!REPORTS.includes(report as ReportKey)) {
    return Response.json({ error: "التقرير ده مش موجود." }, { status: 404 });
  }

  try {
    const result = await buildCsv(report as ReportKey, request.nextUrl.searchParams);

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    const filename = `daftar-${report}-${todayISO()}.csv`;

    return new Response(result.body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("CSV export failed:", error);
    return Response.json(
      { error: "تعذر تصدير التقرير. جرّب تاني." },
      { status: 500 },
    );
  }
}
