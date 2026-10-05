"use server";

import { PaymentMethod } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/app/action-form";
import { getSession, type SessionPayload } from "@/lib/auth";
import { serializableTransaction } from "@/lib/db";

const CONFLICT =
  "همزمان تغییر دیگری ثبت شد؛ صفحه به‌روز می‌شود / Concurrent change detected — view refreshing";
const paymentSchema = z.nativeEnum(PaymentMethod);
const cuidSchema = z.string().cuid();
const discountSchema = z.object({
  amount: z.coerce.number().int().min(0).max(2_000_000_000),
  reason: z.string().trim().min(3).max(80),
});

async function requireCashier(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || (session.role !== "CASHIER" && session.role !== "MANAGER")) {
    redirect("/login");
  }
  return session;
}

function subtotalOf(items: { status: string; qty: number; priceToman: number }[]): number {
  return items
    .filter((item) => item.status !== "CANCELLED")
    .reduce((sum, item) => sum + item.qty * item.priceToman, 0);
}

export async function applyDiscount(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireCashier();
  const orderIdValue = formData.get("orderId");
  if (typeof orderIdValue !== "string") return { error: "Invalid order." };
  const parsed = discountSchema.safeParse({
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: "مبلغ و دلیل معتبر وارد کنید / Enter a valid amount and reason" };
  }

  return serializableTransaction(
    async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderIdValue,
          restaurantId: session.restaurantId,
          status: { in: ["OPEN", "BILL_REQUESTED"] },
          ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
        },
        include: { items: true },
      });
      if (!order) return { error: "Not found or order is closed." };
      if (parsed.data.amount > subtotalOf(order.items)) {
        return { error: "تخفیف بیشتر از جمع ممکن نیست / Discount cannot exceed subtotal" };
      }

      const changed = await tx.order.updateMany({
        where: {
          id: order.id,
          restaurantId: session.restaurantId,
          version: order.version,
          status: order.status,
          ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
        },
        data: {
          discountToman: parsed.data.amount,
          discountReason: parsed.data.reason,
          version: { increment: 1 },
        },
      });
      if (changed.count === 0) return { error: CONFLICT };
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          actorId: session.userId,
          type: "DISCOUNT_APPLIED",
          detail: JSON.stringify(parsed.data),
        },
      });
      return null;
    },
  );
}

export async function payOrder(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireCashier();
  const orderIdValue = formData.get("orderId");
  const methodValue = paymentSchema.safeParse(formData.get("method"));
  if (typeof orderIdValue !== "string" || !cuidSchema.safeParse(orderIdValue).success) {
    return { error: "Invalid order." };
  }
  if (!methodValue.success) {
    return { error: "روش پرداخت نامعتبر / Invalid payment method" };
  }

  return serializableTransaction(
    async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderIdValue,
          restaurantId: session.restaurantId,
          status: { in: ["OPEN", "BILL_REQUESTED"] },
          ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
        },
        include: { items: true },
      });
      if (!order) return { error: "Not found or order is already closed." };
      const total = Math.max(0, subtotalOf(order.items) - order.discountToman);
      const paidAt = new Date();
      const changed = await tx.order.updateMany({
        where: {
          id: order.id,
          restaurantId: session.restaurantId,
          version: order.version,
          status: order.status,
          ...(session.role === "MANAGER" ? {} : { branchId: session.branchId ?? "" }),
        },
        data: {
          status: "PAID",
          paymentMethod: methodValue.data,
          paidAt,
          closedAt: paidAt,
          version: { increment: 1 },
        },
      });
      if (changed.count === 0) return { error: CONFLICT };
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          actorId: session.userId,
          type: "PAYMENT_RECORDED",
          detail: JSON.stringify({ method: methodValue.data, total }),
        },
      });
      return null;
    },
  );
}
