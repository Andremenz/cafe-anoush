import Link from "next/link";
import { ActionForm } from "@/app/action-form";
import { openOrder } from "@/app/waiter/actions";
import { Poller } from "@/app/poller";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { toman } from "@/lib/money";

export default async function WaiterHome() {
  const session = await requireRole("WAITER", "MANAGER");
  const tables = await prisma.table.findMany({
    where: {
      branch: {
        restaurantId: session.restaurantId,
        ...(session.role === "MANAGER" ? {} : { id: session.branchId ?? "" }),
      },
    },
    orderBy: [{ branch: { name: "asc" } }, { label: "asc" }],
    include: {
      branch: { select: { name: true } },
      orders: {
        where: {
          restaurantId: session.restaurantId,
          status: { in: ["OPEN", "BILL_REQUESTED"] },
        },
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return (
    <div>
      <Poller />
      <h1 className="mb-4 text-lg font-bold">میزها / Tables</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {tables.map((table) => {
          const order = table.orders[0];
          const total = order
            ? order.items
                .filter((item) => item.status !== "CANCELLED")
                .reduce((sum, item) => sum + item.qty * item.priceToman, 0)
            : 0;
          return (
            <div
              key={table.id}
              className={`rounded-lg border bg-white p-3 ${
                order
                  ? order.status === "BILL_REQUESTED"
                    ? "border-blue-400 ring-1 ring-blue-200"
                    : "border-amber-400 ring-1 ring-amber-200"
                  : "border-gray-200"
              }`}
            >
              <div className="font-bold">
                {table.branch.name} · میز {table.label}
              </div>
              <div className="text-xs text-gray-500">{table.seats} نفره / seats</div>
              {order ? (
                <Link
                  href={`/waiter/orders/${order.id}`}
                  className="mt-2 block rounded bg-gray-900 px-2 py-1 text-center text-xs text-white"
                >
                  {order.status === "BILL_REQUESTED"
                    ? "صورتحساب / Bill"
                    : `${order.items.length} قلم`}{" "}
                  · {toman(total)}
                </Link>
              ) : (
                <ActionForm action={openOrder} className="mt-2">
                  <input type="hidden" name="tableId" value={table.id} />
                  <button className="w-full rounded bg-emerald-600 px-2 py-1 text-xs text-white">
                    سفارش جدید / New order
                  </button>
                </ActionForm>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
