import { NextRequest } from "next/server";
import { USERS, User } from "./users";

export function verifyToken(token: string): User | null {
  try {
    const decoded = Buffer.from(token, "base64").toString();
    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) return null;
    const id = decoded.slice(0, colonIdx);
    const password = decoded.slice(colonIdx + 1);
    return USERS.find((u) => u.id === id && u.password === password) ?? null;
  } catch {
    return null;
  }
}

export function requireAdmin(token: string): User | null {
  const user = verifyToken(token);
  return user?.role === "ADMIN" ? user : null;
}

export function getTokenFromRequest(req: NextRequest): string {
  return req.headers.get("x-admin-token") ?? "";
}

export function verifyRequest(req: NextRequest): User | null {
  return verifyToken(getTokenFromRequest(req));
}

export function requireAdminRequest(req: NextRequest): User | null {
  return requireAdmin(getTokenFromRequest(req));
}
