import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "@/lib/auth";

export function homeFor(role: Role): string {
  switch (role) {
    case "WAITER":
      return "/waiter";
    case "KITCHEN":
      return "/kitchen";
    case "CASHIER":
      return "/cashier";
    case "MANAGER":
      return "/manager";
  }
}

export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.role)) redirect(homeFor(session.role));
  return session;
}
