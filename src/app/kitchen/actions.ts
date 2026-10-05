"use server";

import type { ItemStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/app/action-form";
import { getSession } from "@/lib/auth";
import { serializableTransaction } from "@/lib/db";

const CONFLICT =
  "همزمان تغییر دیگری ثبت شد؛ صفحه به‌روز می‌شود / Concurrent change detected — view refreshing";
const NEXT: Partial<Record<ItemStatus, ItemStatus>> = {
  PENDING: "PREPARING",
  PREPARING: "READY",
};

export async function advanceItem(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || (session.role !== "KITCHEN" && session.role !== "MANAGER")) {
    redirect("/login");
  }
  const itemId = z.string().cuid().safeParse(formData.get("itemId"));
  if (!itemId.success) return { error: "Invalid item." };

  return serializableTransaction(
    async (tx) => {
      const item = await tx.orderItem.findFirst({
        where: {
          id: itemId.data,
          order: {
            restaurantId: session.restaurantId,
            status: { in: ["OPEN", "BILL_REQUESTED"] },
            ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
          },
        },
        include: { order: true },
      });
      if (!item) return { error: "Not found." };
      const nextStatus = NEXT[item.status];
      if (!nextStatus) return { error: "Item already at final stage." };

      const orderUpdated = await tx.order.updateMany({
        where: {
          id: item.orderId,
          restaurantId: session.restaurantId,
          status: { in: ["OPEN", "BILL_REQUESTED"] },
          ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
        },
        data: { version: { increment: 1 } },
      });
      if (orderUpdated.count === 0) throw new Error(CONFLICT);

      const changed = await tx.orderItem.updateMany({
        where: {
          id: item.id,
          orderId: item.orderId,
          version: item.version,
          status: item.status,
        },
        data: { status: nextStatus, version: { increment: 1 } },
      });
      if (changed.count === 0) throw new Error(CONFLICT);
      await tx.orderEvent.create({
        data: {
          orderId: item.orderId,
          actorId: session.userId,
          type: "ITEM_STATUS_CHANGED",
          detail: JSON.stringify({ itemId: item.id, from: item.status, to: nextStatus }),
        },
      });
      return null;
    },
  ).catch((error: unknown) => {
    if (error instanceof Error && error.message === CONFLICT) {
      return { error: CONFLICT };
    }
    throw error;
  });
}
