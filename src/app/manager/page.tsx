import { ActionForm } from "@/app/action-form";
import { toggleAvailability } from "@/app/manager/actions";
import { Poller } from "@/app/poller";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guards";

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

export default async function ManagerPage() {
  const session = await requireRole("MANAGER");
  const today = startOfTehranDay(new Date());
  const paid = await prisma.order.findMany({
    where: {
      restaurantId: session.restaurantId,
      status: "PAID",
      paidAt: { gte: today },
    },
    include: { items: true, branch: true },
  });

  const totals = paid.map((order) => ({
    branch: order.branch.name,
    total: Math.max(
      0,
      order.items
        .filter((item) => item.status !== "CANCELLED")
        .reduce((sum, item) => sum + item.qty * item.priceToman, 0) -
        order.discountToman,
    ),
  }));
  const revenue = totals.reduce((sum, entry) => sum + entry.total, 0);
  const averageCheck = paid.length ? Math.round(revenue / paid.length) : 0;
  const itemCounts = new Map<string, number>();
  for (const order of paid) {
    for (const item of order.items) {
      if (item.status !== "CANCELLED") {
        itemCounts.set(item.nameEn, (itemCounts.get(item.nameEn) ?? 0) + item.qty);
      }
    }
  }
  const topItems = [...itemCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5);
  const branchTotals = new Map<string, number>();
  for (const entry of totals) {
    branchTotals.set(entry.branch, (branchTotals.get(entry.branch) ?? 0) + entry.total);
  }
  const menu = await prisma.menuCategory.findMany({
    where: { restaurantId: session.restaurantId },
    include: {
      items: { where: { restaurantId: session.restaurantId }, orderBy: { nameFa: "asc" } },
    },
    orderBy: { sort: "asc" },
  });

  return (
    <div>
      <Poller />
      <h1 className="mb-4 text-lg font-bold">امروز / Today</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold">{revenue.toLocaleString("en-US")}</div>
          <div className="text-xs text-gray-500">درآمد امروز / Revenue (Toman)</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold">{paid.length}</div>
          <div className="text-xs text-gray-500">صورتحساب بسته / Checks closed</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold">{averageCheck.toLocaleString("en-US")}</div>
          <div className="text-xs text-gray-500">میانگین هر میز / Avg check</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm font-semibold">
            {[...branchTotals.entries()]
              .map(([branch, amount]) => `${branch}: ${amount.toLocaleString("en-US")}`)
              .join(" · ") || "—"}
          </div>
          <div className="text-xs text-gray-500">به تفکیک شعبه / By branch</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-bold">پرفروش‌های امروز / Top items today</h2>
          {topItems.map(([name, quantity]) => (
            <p
              key={name}
              className="flex justify-between border-b border-gray-50 py-1 text-sm"
            >
              <span>{name}</span>
              <span className="text-gray-500">{quantity}</span>
            </p>
          ))}
          {topItems.length === 0 && (
            <p className="text-xs text-gray-500">
              هنوز فروشی ثبت نشده / No sales yet today
            </p>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-bold">موجودی منو / Menu availability</h2>
          {menu.map((category) => (
            <div key={category.id} className="mb-2">
              <p className="text-xs font-semibold text-gray-500">
                {category.nameFa} · {category.nameEn}
              </p>
              {category.items.map((item) => (
                <ActionForm
                  key={item.id}
                  action={toggleAvailability}
                  className="flex items-center justify-between py-1"
                >
                  <input type="hidden" name="menuItemId" value={item.id} />
                  <span
                    className={`text-sm ${
                      item.available ? "" : "text-gray-400 line-through"
                    }`}
                  >
                    {item.nameFa}
                  </span>
                  <button
                    className={`rounded px-2 py-0.5 text-xs ${
                      item.available
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {item.available ? "موجود / available" : "تمام شده / 86'd"}
                  </button>
                </ActionForm>
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
