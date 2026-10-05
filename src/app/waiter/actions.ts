"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/app/action-form";
import { getSession, type SessionPayload } from "@/lib/auth";
import { prisma, serializableTransaction } from "@/lib/db";
import { suggestAddOns } from "@/lib/ai";

const CONFLICT =
  "همزمان تغییر دیگری ثبت شد؛ صفحه به‌روز می‌شود / Concurrent change detected — view refreshing";
const idSchema = z.string().cuid();

async function requireWaiter(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || (session.role !== "WAITER" && session.role !== "MANAGER")) {
    return null;
  }
  return session;
}

function formString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

async function loadOrder(
  orderId: string,
  session: SessionPayload,
): Promise<Prisma.OrderGetPayload<{ include: { items: true } }> | null> {
  if (!idSchema.safeParse(orderId).success) return null;
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      restaurantId: session.restaurantId,
      ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
    },
    include: { items: true },
  });
  return order;
}

async function log(
  orderId: string,
  actorId: string,
  type: string,
  detail?: string,
): Promise<void> {
  await prisma.orderEvent.create({ data: { orderId, actorId, type, detail } });
}

export async function openOrder(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireWaiter();
  if (!session) redirect("/login");
  const tableId = formString(formData, "tableId");
  if (!tableId || !idSchema.safeParse(tableId).success) {
    return { error: "Invalid table." };
  }

  const createdOrderId = await serializableTransaction(
    async (tx) => {
      const table = await tx.table.findFirst({
        where: {
          id: tableId,
          branch: {
            restaurantId: session.restaurantId,
            ...(session.role === "MANAGER" ? {} : { id: session.branchId ?? "" }),
          },
        },
      });
      if (!table) return { error: "Table not found." as const };

      const existing = await tx.order.findFirst({
        where: {
          restaurantId: session.restaurantId,
          tableId,
          status: { in: ["OPEN", "BILL_REQUESTED"] },
        },
        select: { id: true },
      });
      if (existing) return { orderId: existing.id };

      const order = await tx.order.create({
        data: {
          restaurantId: session.restaurantId,
          branchId: table.branchId,
          tableId,
          openedById: session.userId,
          status: "OPEN",
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          actorId: session.userId,
          type: "ORDER_OPENED",
          detail: `table ${table.label}`,
        },
      });
      return { orderId: order.id };
    },
  );
  if ("error" in createdOrderId) return { error: createdOrderId.error };
  redirect(`/waiter/orders/${createdOrderId.orderId}`);
}

export async function addItem(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireWaiter();
  if (!session) redirect("/login");
  const orderId = formString(formData, "orderId");
  const menuItemId = formString(formData, "menuItemId");
  if (
    !orderId ||
    !menuItemId ||
    !idSchema.safeParse(orderId).success ||
    !idSchema.safeParse(menuItemId).success
  ) {
    return { error: "Invalid order or menu item." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        id: orderId,
        restaurantId: session.restaurantId,
        status: "OPEN",
        ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
      },
      select: { id: true },
    });
    if (!order) return { error: "Order is not editable." as const };
    const item = await tx.menuItem.findFirst({
      where: { id: menuItemId, restaurantId: session.restaurantId, available: true },
    });
    if (!item) return { error: "Item unavailable." as const };

    const orderLocked = await tx.order.updateMany({
      where: {
        id: order.id,
        restaurantId: session.restaurantId,
        status: "OPEN",
        ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
      },
      data: { version: { increment: 1 } },
    });
    if (orderLocked.count === 0) return { error: CONFLICT };

    const line = await tx.orderItem.create({
      data: {
        orderId,
        menuItemId: item.id,
        nameFa: item.nameFa,
        nameEn: item.nameEn,
        priceToman: item.priceToman,
        qty: 1,
        status: "PENDING",
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId,
        actorId: session.userId,
        type: "ITEM_ADDED",
        detail: JSON.stringify({ orderItemId: line.id, menuItemId: item.id }),
      },
    });
    return null;
  });
  return result ? { error: result.error } : null;
}

async function loadEditableItem(
  itemId: string,
  session: SessionPayload,
) {
  if (!idSchema.safeParse(itemId).success) return null;
  return prisma.orderItem.findFirst({
    where: {
      id: itemId,
      order: {
        restaurantId: session.restaurantId,
        ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
      },
    },
    include: { order: true },
  });
}

export async function changeQty(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireWaiter();
  if (!session) redirect("/login");
  const itemId = formString(formData, "itemId");
  const delta = z.coerce.number().int().min(-1).max(1).safeParse(formString(formData, "delta"));
  if (!itemId || !delta.success || delta.data === 0) {
    return { error: "Invalid quantity change." };
  }
  const item = await loadEditableItem(itemId, session);
  if (!item) return { error: "Not found." };
  if (item.order.status !== "OPEN") {
    return { error: "Bill already requested — item cannot be edited." };
  }
  if (item.status !== "PENDING") {
    return { error: "Kitchen started this item — ask kitchen to cancel." };
  }

  const qty = item.qty + delta.data;
  let result: boolean;
  try {
    result = await prisma.$transaction(async (tx) => {
    const changed = await tx.orderItem.updateMany({
      where: { id: item.id, version: item.version, status: "PENDING" },
      data: {
        ...(qty <= 0 ? { status: "CANCELLED" as const } : { qty }),
        version: { increment: 1 },
      },
    });
    if (changed.count === 0) return false;
    const orderUpdated = await tx.order.updateMany({
      where: {
        id: item.orderId,
        restaurantId: session.restaurantId,
        status: "OPEN",
        ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
      },
      data: { version: { increment: 1 } },
    });
    if (orderUpdated.count === 0) throw new Error(CONFLICT);
    await tx.orderEvent.create({
      data: {
        orderId: item.orderId,
        actorId: session.userId,
        type: qty <= 0 ? "ITEM_CANCELLED" : "ITEM_QTY_CHANGED",
        detail: `${item.nameEn} -> ${qty <= 0 ? "CANCELLED" : qty}`,
      },
    });
    return true;
    });
  } catch (error) {
    if (error instanceof Error && error.message === CONFLICT) {
      return { error: CONFLICT };
    }
    throw error;
  }
  return result ? null : { error: CONFLICT };
}

export async function updateNote(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireWaiter();
  if (!session) redirect("/login");
  const itemId = formString(formData, "itemId");
  const noteValue = formString(formData, "note");
  if (!itemId || noteValue === null || noteValue.length > 140) {
    return { error: "Note must be 140 characters or fewer." };
  }
  const item = await loadEditableItem(itemId, session);
  if (!item) return { error: "Not found." };
  if (item.order.status !== "OPEN" || item.status !== "PENDING") {
    return { error: "Item is no longer editable." };
  }

  const note = noteValue.trim() || null;
  let result: boolean;
  try {
    result = await prisma.$transaction(async (tx) => {
    const changed = await tx.orderItem.updateMany({
      where: { id: item.id, version: item.version, status: "PENDING" },
      data: { note, version: { increment: 1 } },
    });
    if (changed.count === 0) return false;
    const orderUpdated = await tx.order.updateMany({
      where: {
        id: item.orderId,
        restaurantId: session.restaurantId,
        status: "OPEN",
        ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
      },
      data: { version: { increment: 1 } },
    });
    if (orderUpdated.count === 0) throw new Error(CONFLICT);
    await tx.orderEvent.create({
      data: {
        orderId: item.orderId,
        actorId: session.userId,
        type: "ITEM_NOTE_UPDATED",
        detail: JSON.stringify({ itemId: item.id, note }),
      },
    });
    return true;
    });
  } catch (error) {
    if (error instanceof Error && error.message === CONFLICT) {
      return { error: CONFLICT };
    }
    throw error;
  }
  return result ? null : { error: CONFLICT };
}

export async function requestBill(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireWaiter();
  if (!session) redirect("/login");
  const orderId = formString(formData, "orderId");
  if (!orderId) return { error: "Invalid order." };
  const order = await loadOrder(orderId, session);
  if (!order || order.status !== "OPEN") return { error: "Order is not open." };

  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: {
        id: order.id,
        restaurantId: session.restaurantId,
        status: "OPEN",
        version: order.version,
      },
      data: { status: "BILL_REQUESTED", version: { increment: 1 } },
    });
    if (changed.count === 0) return false;
    await tx.orderEvent.create({
      data: { orderId: order.id, actorId: session.userId, type: "BILL_REQUESTED" },
    });
    return true;
  });
  return result ? null : { error: CONFLICT };
}

export async function markServed(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireWaiter();
  if (!session) redirect("/login");
  const itemIdValue = formString(formData, "itemId");
  if (!itemIdValue || !idSchema.safeParse(itemIdValue).success) {
    return { error: "Invalid item." };
  }

  try {
    return await serializableTransaction(
      async (tx) => {
        const item = await tx.orderItem.findFirst({
          where: {
            id: itemIdValue,
            order: {
              restaurantId: session.restaurantId,
              status: "OPEN",
              ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
            },
          },
          include: { order: true },
        });
        if (!item) return { error: "Not found." };
        if (item.status !== "READY") return { error: "Item is not ready yet." };

        const changed = await tx.orderItem.updateMany({
          where: {
            id: item.id,
            orderId: item.orderId,
            status: "READY",
            version: item.version,
          },
          data: { status: "SERVED", version: { increment: 1 } },
        });
        if (changed.count === 0) return { error: CONFLICT };

        const orderUpdated = await tx.order.updateMany({
          where: {
            id: item.orderId,
            restaurantId: session.restaurantId,
            status: "OPEN",
            ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
          },
          data: { version: { increment: 1 } },
        });
        if (orderUpdated.count === 0) throw new Error(CONFLICT);

        await tx.orderEvent.create({
          data: {
            orderId: item.orderId,
            actorId: session.userId,
            type: "ITEM_SERVED",
            detail: item.nameEn,
          },
        });
        return null;
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === CONFLICT) {
      return { error: CONFLICT };
    }
    throw error;
  }
}

export async function getSuggestions(orderId: string): Promise<{
  items: { id: string; nameFa: string; priceToman: number }[];
  notice: string | null;
}> {
  const session = await requireWaiter();
  if (!session) return { items: [], notice: "unauthorized" };
  const order = await loadOrder(orderId, session);
  if (!order || order.status !== "OPEN") {
    return { items: [], notice: "notfound" };
  }
  const orderedNames = order.items
    .filter((item) => item.status !== "CANCELLED")
    .map((item) => item.nameEn);
  const { ids, source } = await suggestAddOns(order.restaurantId, orderedNames);
  const items = await prisma.menuItem.findMany({
    where: { id: { in: ids }, restaurantId: session.restaurantId, available: true },
    select: { id: true, nameFa: true, priceToman: true },
  });
  await log(order.id, session.userId, "AI_SUGGESTED", source);
  return {
    items,
    notice:
      source === "fallback"
        ? "هوش مصنوعی در دسترس نیست — پیشنهادهای خانه / AI unavailable — house suggestions"
        : null,
  };
}
