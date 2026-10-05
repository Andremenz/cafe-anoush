"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/app/action-form";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function toggleAvailability(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || session.role !== "MANAGER") redirect("/login");
  const menuItemId = z.string().cuid().safeParse(formData.get("menuItemId"));
  if (!menuItemId.success) return { error: "Invalid menu item." };

  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId.data, restaurantId: session.restaurantId },
    select: { id: true, available: true },
  });
  if (!item) return { error: "Not found." };

  const changed = await prisma.menuItem.updateMany({
    where: {
      id: item.id,
      restaurantId: session.restaurantId,
      available: item.available,
    },
    data: { available: !item.available },
  });
  if (changed.count === 0) {
    return { error: "Availability changed elsewhere; refresh and try again." };
  }
  console.info(
    JSON.stringify({
      level: "info",
      event: "menu_availability_toggled",
      itemId: item.id,
      by: session.userId,
      available: !item.available,
    }),
  );
  return null;
}
