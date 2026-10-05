import { Role } from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";

const COOKIE = "cafe-session";
const sessionSchema = z.object({
  userId: z.string().min(1),
  restaurantId: z.string().min(1),
  branchId: z.string().min(1).nullable(),
  role: z.nativeEnum(Role),
  name: z.string().min(1),
  staffCode: z.string().min(1),
});

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    if (new TextEncoder().encode(secret).byteLength < 32) {
      throw new Error("JWT_SECRET must contain at least 32 bytes.");
    }
    return new TextEncoder().encode(secret);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production.");
  }

  return new TextEncoder().encode("dev-only-fallback-secret-0123456789abcdef");
}

export type SessionPayload = z.infer<typeof sessionSchema>;

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    const result = sessionSchema.safeParse(payload);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
