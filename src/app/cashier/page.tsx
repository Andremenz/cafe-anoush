import Link from "next/link";
import { ActionForm } from "@/app/action-form";
import { applyDiscount, payOrder } from "@/app/cashier/actions";
import { Poller } from "@/app/poller";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { toman } from "@/lib/money";

const METHOD_LABEL = {
  POS_CARD: "دستگاه کارت / POS card",
  CARD_TO_CARD: "کارت‌به‌کارت / Card-to-card",
  CASH: "نقد / Cash",
} as const;

function startOfTehranDay(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day")) - 3.5 * 60 * 60 * 1000);
}

export default async function CashierPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const params = await searchParams;
  const session = await requireRole("CASHIER", "MANAGER");
  const branchFilter = session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" };
  const active = await prisma.order.findMany({
    where: {
      restaurantId: session.restaurantId,
      ...branchFilter,
      status: { in: ["OPEN", "BILL_REQUESTED"] },
    },
    include: {
      items: true,
      table: true,
      branch: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const bills = active.filter((order) => order.status === "BILL_REQUESTED");
  const openOrders = active.filter((order) => order.status === "OPEN");
  const sorted = [...bills, ...openOrders];
  const selected = sorted.find((order) => order.id === params.order) ?? sorted[0] ?? null;

  const paidToday = await prisma.order.findMany({
    where: {
      restaurantId: session.restaurantId,
      ...branchFilter,
      status: "PAID",
      paidAt: { gte: startOfTehranDay(new Date()) },
    },
    include: {
      table: true,
      branch: { select: { name: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 8,
  });

  const subtotal = selected
    ? selected.items
        .filter((item) => item.status !== "CANCELLED")
        .reduce((sum, item) => sum + item.qty * item.priceToman, 0)
    : 0;
  const total = selected ? Math.max(0, subtotal - selected.discountToman) : 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Poller />
      <section className="space-y-2">
        <h1 className="mb-2 text-lg font-bold">
          درخواست صورتحساب / Bills requested ({bills.length})
        </h1>
        {sorted.map((order) => (
          <Link
            key={order.id}
            href={`/cashier?order=${encodeURIComponent(order.id)}`}
            className={`block rounded border p-2 text-sm ${
              selected?.id === order.id
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white"
            }`}
          >
            {order.branch.name} · میز {order.table.label} · Table {order.table.label}{" "}
            <span
              className={`text-xs ${
                order.status === "BILL_REQUESTED" ? "text-blue-500" : "text-gray-400"
              }`}
            >
              {order.status}
            </span>
          </Link>
        ))}
        {sorted.length === 0 && (
          <p className="text-sm text-gray-500">سفارش بازی وجود ندارد / No active orders</p>
        )}

        <h2 className="mb-2 mt-6 text-sm font-bold">پرداخت‌شده امروز / Paid today</h2>
        {paidToday.map((order) => (
          <p
            key={order.id}
            className="rounded border border-gray-200 bg-white p-2 text-xs text-gray-500"
          >
            {order.branch.name} · میز {order.table.label} · {order.paymentMethod} ·{" "}
            {order.paidAt
              ? new Intl.DateTimeFormat("en-US", {
                  timeZone: "Asia/Tehran",
                  timeStyle: "short",
                }).format(order.paidAt)
              : ""}
          </p>
        ))}
      </section>

      {selected && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {selected.branch.name} · میز {selected.table.label} · Table {selected.table.label}
            </h2>
            <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">
              {selected.status}
            </span>
          </div>
          <ul className="divide-y divide-gray-100 text-sm">
            {selected.items.map((item) => (
              <li
                key={item.id}
                className={`flex justify-between py-2 ${
                  item.status === "CANCELLED" ? "text-gray-400 line-through" : ""
                }`}
              >
                <span>
                  {item.qty} × {item.nameFa}{" "}
                  <span className="text-xs text-gray-500">
                    {item.nameEn} · {item.status}
                  </span>
                </span>
                <span>{toman(item.qty * item.priceToman)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between text-sm">
            <span>جمع / Subtotal</span>
            <span>{toman(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>
              تخفیف / Discount {selected.discountReason ? `(${selected.discountReason})` : ""}
            </span>
            <span>− {toman(selected.discountToman)}</span>
          </div>
          <div className="mt-1 flex justify-between text-lg font-bold">
            <span>قابل پرداخت / Total</span>
            <span>{toman(total)}</span>
          </div>

          <ActionForm
            action={applyDiscount}
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="orderId" value={selected.id} />
            <input
              name="amount"
              type="number"
              min={0}
              max={subtotal}
              step={500}
              required
              placeholder="تخفیف / discount"
              className="w-32 rounded border px-2 py-1 text-sm"
            />
            <input
              name="reason"
              minLength={3}
              maxLength={80}
              required
              placeholder="دلیل / reason"
              className="min-w-32 flex-1 rounded border px-2 py-1 text-sm"
            />
            <button className="rounded border px-3 py-1 text-sm">
              اعمال تخفیف / Apply
            </button>
          </ActionForm>

          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(METHOD_LABEL).map(([method, label]) => (
              <ActionForm key={method} action={payOrder} className="inline-flex">
                <input type="hidden" name="orderId" value={selected.id} />
                <input type="hidden" name="method" value={method} />
                <button className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700">
                  پرداخت / Paid: {label}
                </button>
              </ActionForm>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
