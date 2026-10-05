import { notFound } from "next/navigation";
import { ActionForm } from "@/app/action-form";
import {
  addItem,
  changeQty,
  markServed,
  requestBill,
  updateNote,
} from "@/app/waiter/actions";
import { SuggestButton } from "@/app/waiter/suggest-button";
import { Poller } from "@/app/poller";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { toman } from "@/lib/money";

const badge: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  PREPARING: "bg-amber-100 text-amber-700",
  READY: "bg-emerald-100 text-emerald-700",
  SERVED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-600 line-through",
};

export default async function WaiterOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole("WAITER", "MANAGER");
  const order = await prisma.order.findFirst({
    where: {
      id,
      restaurantId: session.restaurantId,
      ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
    },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      table: { include: { branch: { select: { name: true } } } },
    },
  });
  if (!order) notFound();

  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: session.restaurantId },
    include: {
      items: {
        where: { restaurantId: session.restaurantId, available: true },
        orderBy: { nameFa: "asc" },
      },
    },
    orderBy: { sort: "asc" },
  });
  const subtotal = order.items
    .filter((item) => item.status !== "CANCELLED")
    .reduce((sum, item) => sum + item.qty * item.priceToman, 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Poller />
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">
            {order.table.branch.name} · میز {order.table.label} · Table {order.table.label}
          </h1>
          <span
            className={`rounded px-2 py-1 text-xs ${
              order.status === "OPEN"
                ? "bg-amber-100 text-amber-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {order.status}
          </span>
        </div>
        <ul className="space-y-2">
          {order.items.map((item) => (
            <li key={item.id} className="rounded border border-gray-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{item.nameFa}</span>{" "}
                  <span className="text-xs text-gray-500">{item.nameEn}</span>
                  <span
                    className={`ms-2 rounded px-2 py-0.5 text-xs ${badge[item.status] ?? ""}`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {item.qty} × {toman(item.priceToman)}
                </div>
              </div>
              {item.note && (
                <p className="mt-1 text-xs text-amber-700">یادداشت / note: {item.note}</p>
              )}
              {item.status === "READY" && order.status === "OPEN" && (
                <ActionForm action={markServed} className="mt-2 inline-flex">
                  <input type="hidden" name="itemId" value={item.id} />
                  <button className="rounded bg-blue-600 px-2 py-1 text-xs text-white">
                    تحویل شد / Served
                  </button>
                </ActionForm>
              )}
              {order.status === "OPEN" && item.status === "PENDING" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionForm action={changeQty} className="inline-flex gap-1">
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="delta" value="1" />
                    <button className="rounded border px-2 py-1 text-xs">+1</button>
                  </ActionForm>
                  <ActionForm action={changeQty} className="inline-flex gap-1">
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="delta" value="-1" />
                    <button className="rounded border px-2 py-1 text-xs">−1 / حذف</button>
                  </ActionForm>
                  <ActionForm action={updateNote} className="flex min-w-40 flex-1 gap-1">
                    <input type="hidden" name="itemId" value={item.id} />
                    <input
                      name="note"
                      maxLength={140}
                      defaultValue={item.note ?? ""}
                      placeholder="یادداشت / note"
                      className="flex-1 rounded border px-2 py-1 text-xs"
                    />
                    <button className="rounded border px-2 py-1 text-xs">ثبت / Save</button>
                  </ActionForm>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between rounded border border-gray-200 bg-white p-3 text-sm">
          <span>جمع / Subtotal</span>
          <span className="font-bold">{toman(subtotal)}</span>
        </div>
        {order.status === "OPEN" && (
          <div className="mt-3 flex items-center gap-3">
            <ActionForm action={requestBill}>
              <input type="hidden" name="orderId" value={order.id} />
              <button className="rounded bg-blue-600 px-4 py-2 text-sm text-white">
                درخواست صورتحساب / Request bill
              </button>
            </ActionForm>
            <SuggestButton orderId={order.id} />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">منو / Menu</h2>
        {categories.map((category) => (
          <div key={category.id} className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-600">
              {category.nameFa} · {category.nameEn}
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {category.items.map((menuItem) => (
                <ActionForm
                  key={menuItem.id}
                  action={addItem}
                  className="flex items-center justify-between rounded border border-gray-200 bg-white p-2"
                >
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="menuItemId" value={menuItem.id} />
                  <span className="text-sm">
                    {menuItem.nameFa}{" "}
                    <span className="text-xs text-gray-500">{menuItem.nameEn}</span>
                  </span>
                  <button
                    disabled={order.status !== "OPEN"}
                    className="rounded bg-emerald-600 px-3 py-1 text-xs text-white disabled:opacity-40"
                  >
                    + {toman(menuItem.priceToman)}
                  </button>
                </ActionForm>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
