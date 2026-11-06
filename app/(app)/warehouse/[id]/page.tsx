import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BoxIcon } from "@/components/ui/icons";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import {
  addStockMovementAction,
  deleteStockMovementAction,
  toggleProductStatusAction,
} from "@/lib/actions/warehouse";
import { requireAuth } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { currentProductQuantity, productStatus } from "@/lib/queries/balances";

export const metadata: Metadata = {
  title: "تفاصيل الصنف",
};

export const instant = false;

const statusMeta = {
  in: { label: "متوفر", tone: "success" as const },
  low: { label: "قليل", tone: "gold" as const },
  out: { label: "نافد", tone: "danger" as const },
};

const movementMeta = {
  IN: { label: "إدخال", tone: "info" as const, sign: "+" },
  OUT: { label: "إخراج", tone: "danger" as const, sign: "−" },
  ADJUST: { label: "تسوية", tone: "gold" as const, sign: "" },
};

function movementEffect(type: "IN" | "OUT" | "ADJUST", quantity: number) {
  if (type === "IN") return quantity;
  if (type === "OUT") return -quantity;
  return quantity;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();

  const { id } = await params;
  const product = await db.product.findUnique({
    where: { id },
    include: {
      movements: {
        include: {
          custodyItem: {
            select: {
              id: true,
              custodyId: true,
              custody: { select: { name: true } },
            },
          },
        },
        orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!product) notFound();

  const quantity = currentProductQuantity(product.movements);
  const state = productStatus(quantity, product.lowStockThreshold);
  const meta = statusMeta[state];

  const movements = product.movements.reduce<
    Array<(typeof product.movements)[number] & { running: number }>
  >((rows, movement) => {
    const previous = rows.length > 0 ? rows[rows.length - 1]!.running : 0;
    rows.push({
      ...movement,
      running: previous + movementEffect(movement.type, movement.quantity),
    });
    return rows;
  }, []);

  return (
    <>
      <BackLink href="/warehouse">المخزن</BackLink>

      <PageHeader
        eyebrow="تفاصيل الصنف"
        title={product.name}
        description={`${product.unit || "بدون وحدة"}${
          product.note ? ` — ${product.note}` : ""
        }`}
        actions={
          <>
            <Link
              href={`/warehouse/${product.id}/edit`}
              className={buttonStyles({ size: "sm" })}
            >
              تعديل
            </Link>
            <form action={toggleProductStatusAction}>
              <input type="hidden" name="id" value={product.id} />
              <ConfirmSubmitButton
                variant={product.isActive ? "ghost" : "secondary"}
                message={
                  product.isActive
                    ? "إيقاف الصنف؟ هيفضل في الحركات القديمة وتقدر ترجّعه."
                    : "إعادة تنشيط الصنف؟"
                }
              >
                {product.isActive ? "إيقاف" : "تنشيط"}
              </ConfirmSubmitButton>
            </form>
          </>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-brand p-4 text-white shadow-card">
          <p className="text-xs font-semibold text-white/70">الكمية الحالية</p>
          <p className="mt-1.5 text-3xl font-extrabold">{quantity}</p>
          <p className="mt-1 text-[11px] text-white/60">
            {product.unit || "بدون وحدة"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold text-muted">قيمة التكلفة</p>
          <p className="mt-1.5 text-xl font-extrabold text-ink">
            {formatMoney(quantity * product.costPriceCents)}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {formatMoney(product.costPriceCents)} للوحدة
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold text-muted">سعر البيع</p>
          <p className="mt-1.5 text-xl font-extrabold text-ink">
            {product.salePriceCents === null
              ? "—"
              : formatMoney(product.salePriceCents)}
          </p>
          <p className="mt-1 text-[11px] text-muted">اختياري</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold text-muted">الحالة</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {!product.isActive ? (
              <Badge tone="neutral">موقوف</Badge>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {product.lowStockThreshold > 0
              ? `تنبيه عند ${product.lowStockThreshold}`
              : "بدون تنبيه مخزون"}
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Card>
          <CardHeader>
            <CardTitle>حركة جديدة</CardTitle>
            <Badge tone="brand">المخزن</Badge>
          </CardHeader>
          <CardContent className="pt-4">
            <ActionForm
              action={addStockMovementAction}
              submitLabel="تسجيل الحركة"
              pendingLabel="جارٍ التسجيل..."
            >
              <input type="hidden" name="productId" value={product.id} />
              <div className="grid gap-4">
                <Field
                  label="نوع الحركة"
                  htmlFor="movement-type"
                  hint="إدخال يزيد، إخراج ينقص، والتسوية بتصحّح الفرق."
                >
                  <Select id="movement-type" name="type" defaultValue="IN">
                    <option value="IN">إدخال للمخزن</option>
                    <option value="OUT">إخراج من المخزن</option>
                    <option value="ADJUST">تسوية (فرق موجب أو سالب)</option>
                  </Select>
                </Field>

                <Field
                  label="الكمية"
                  htmlFor="movement-quantity"
                  hint="في التسوية استخدم سالب لو بتقلل، مثال: -3."
                >
                  <Input
                    id="movement-quantity"
                    name="quantity"
                    inputMode="numeric"
                    required
                    placeholder="1"
                  />
                </Field>

                <Field
                  label="سعر الوحدة (جنيه)"
                  htmlFor="movement-price"
                  hint="اختياري."
                >
                  <Input
                    id="movement-price"
                    name="unitPrice"
                    inputMode="decimal"
                    placeholder="0"
                  />
                </Field>

                <Field label="التاريخ" htmlFor="movement-date">
                  <Input
                    id="movement-date"
                    name="occurredOn"
                    type="date"
                    required
                    defaultValue={todayISO()}
                  />
                </Field>

                <Field label="ملاحظات" htmlFor="movement-note">
                  <Textarea
                    id="movement-note"
                    name="note"
                    rows={2}
                    placeholder="سبب الحركة أو تفاصيلها"
                  />
                </Field>
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>سجل الحركات</CardTitle>
            <Badge tone="neutral">{product.movements.length} حركة</Badge>
          </CardHeader>
          <CardContent className="pt-4">
            {product.movements.length === 0 ? (
              <EmptyState
                icon={BoxIcon}
                title="مفيش حركات على الصنف"
                description="سجّل أول إدخال أو إخراج من الفورم المجاور، وهيظهر هنا بالرصيد."
              />
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>التاريخ</TableHeaderCell>
                    <TableHeaderCell>النوع</TableHeaderCell>
                    <TableHeaderCell>الكمية</TableHeaderCell>
                    <TableHeaderCell>الرصيد</TableHeaderCell>
                    <TableHeaderCell> </TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...movements].reverse().map((movement) => {
                    const info = movementMeta[movement.type];
                    const effect = movementEffect(
                      movement.type,
                      movement.quantity,
                    );

                    return (
                      <TableRow key={movement.id}>
                        <TableCell className="whitespace-nowrap text-muted">
                          {formatDate(movement.occurredOn)}
                        </TableCell>
                        <TableCell>
                          <Badge tone={info.tone}>{info.label}</Badge>
                          {movement.custodyItem ? (
                            <Link
                              href={`/custodies/${movement.custodyItem.custodyId}?tab=stock`}
                              className="mt-1 block text-[10px] font-semibold text-brand hover:underline"
                            >
                              مرتجع عهدة {movement.custodyItem.custody.name}
                            </Link>
                          ) : movement.note ? (
                            <span className="mt-1 block text-[10px] text-muted">
                              {movement.note}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell
                          className={
                            effect >= 0
                              ? "whitespace-nowrap font-bold text-success"
                              : "whitespace-nowrap font-bold text-danger"
                          }
                        >
                          {effect > 0 ? "+" : ""}
                          {effect}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-bold text-ink">
                          {movement.running}
                        </TableCell>
                        <TableCell>
                          {movement.custodyItem ? null : (
                            <form action={deleteStockMovementAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={movement.id}
                              />
                              <input
                                type="hidden"
                                name="redirectTo"
                                value={`/warehouse/${product.id}`}
                              />
                              <ConfirmSubmitButton message="حذف الحركة؟ رصيد الصنف هيتعدّل.">
                                حذف
                              </ConfirmSubmitButton>
                            </form>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
