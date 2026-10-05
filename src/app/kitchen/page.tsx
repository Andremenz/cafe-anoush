import type { ItemStatus } from "@prisma/client";
import { ActionForm } from "@/app/action-form";
import { advanceItem } from "@/app/kitchen/actions";
import { Poller } from "@/app/poller";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";

const COLUMNS = ["PENDING", "PREPARING", "READY"] as const satisfies readonly ItemStatus[];
const COL_TITLE: Record<(typeof COLUMNS)[number], string> = {
  PENDING: "جدید / New",
  PREPARING: "در حال تهیه / Preparing",
  READY: "آماده تحویل / Ready",
};
const BTN: Partial<Record<ItemStatus, string>> = {
  PENDING: "شروع / Start",
  PREPARING: "آماده / Ready",
};

export default async function KitchenBoard() {
  const session = await requireRole("KITCHEN", "MANAGER");
  const orders = await prisma.order.findMany({
    where: {
      restaurantId: session.restaurantId,
      ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
      status: { in: ["OPEN", "BILL_REQUESTED"] },
    },
    include: {
      branch: { select: { name: true } },
      table: true,
      items: {
        where: { status: { in: [...COLUMNS] } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const cards = orders.flatMap((order) =>
    order.items.map((item) => ({
      item,
      branch: order.branch.name,
      table: order.table.label,
      billRequested: order.status === "BILL_REQUESTED",
    })),
  );

  return (
    <div>
      <Poller />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((column) => {
          const columnCards = cards.filter(({ item }) => item.status === column);
          return (
            <section key={column}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-300">
                {COL_TITLE[column]} ({columnCards.length})
              </h2>
              <div className="space-y-3">
                {columnCards.map(({ item, branch, table, billRequested }) => {
                  const age = Math.max(
                    0,
                    Math.floor((Date.now() - item.createdAt.getTime()) / 60_000),
                  );
                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-3 ${
                        column === "PENDING"
                          ? "border-gray-700 bg-gray-800"
                          : column === "PREPARING"
                            ? "border-amber-700 bg-amber-900/40"
                            : "border-emerald-700 bg-emerald-900/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">
                          {branch} · میز {table} · Table {table}
                        </span>
                        <span className="text-xs text-gray-400">{age} min</span>
                      </div>
                      <div className="mt-1 text-lg font-semibold">
                        {item.qty} × {item.nameFa}
                      </div>
                      <div className="text-xs text-gray-400">{item.nameEn}</div>
                      {item.note && (
                        <p className="mt-1 text-xs text-amber-300">
                          یادداشت / note: {item.note}
                        </p>
                      )}
                      {billRequested && (
                        <p className="mt-1 text-xs text-blue-300">
                          صورتحساب درخواست شده / bill requested
                        </p>
                      )}
                      {BTN[column] && (
                        <ActionForm action={advanceItem} className="mt-2">
                          <input type="hidden" name="itemId" value={item.id} />
                          <button className="w-full rounded bg-white px-3 py-1 text-sm font-medium text-gray-900">
                            {BTN[column]}
                          </button>
                        </ActionForm>
                      )}
                    </div>
                  );
                })}
                {columnCards.length === 0 && <p className="text-xs text-gray-500">—</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
