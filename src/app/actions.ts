"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { homeFor } from "@/lib/guards";
import type { ActionState } from "@/app/action-form";

const loginSchema = z.object({
  staffCode: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()),
  pin: z.string().trim().regex(/^\d{4}$/, "PIN must be four digits."),
});

export async function login(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    staffCode: formData.get("staffCode"),
    pin: formData.get("pin"),
  });
  if (!parsed.success) {
    return { error: "Enter a staff code and a four-digit PIN / کد پرسنلی و پین را وارد کنید" };
  }

  const candidates = await prisma.user.findMany({
    where: { staffCode: parsed.data.staffCode },
  });
  const matchedUsers = [];
  for (const user of candidates) {
    if (await bcrypt.compare(parsed.data.pin, user.pinHash)) matchedUsers.push(user);
  }
  if (matchedUsers.length !== 1) {
    return {
      error:
        matchedUsers.length > 1
          ? "This staff code matches multiple restaurants; contact your manager."
          : "Invalid staff code or PIN / کد پرسنلی یا پین اشتباه است",
    };
  }

  const user = matchedUsers[0];
  await createSession({
    userId: user.id,
    restaurantId: user.restaurantId,
    branchId: user.branchId,
    role: user.role,
    name: user.name,
    staffCode: user.staffCode,
  });
  redirect(homeFor(user.role));
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
