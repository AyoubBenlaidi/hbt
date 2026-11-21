import "server-only";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

/**
 * Current session in server components, route handlers and server actions
 */
export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

/** Current user, or throws: for server actions that require a signed-in user */
export async function requireUser() {
  const session = await getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }
  return session.user;
}
