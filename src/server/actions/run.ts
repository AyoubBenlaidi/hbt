import "server-only";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import type { ActionResult } from "@/lib/actionResult";
import { AccessError, UserError, type Db } from "@/server/data/common";

/**
 * Runs a server action body for the signed-in user. Expected failures keep
 * their message; anything else is logged and reported generically.
 */
export async function run<T>(body: (ctx: { db: Db; userId: string }) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  try {
    return { ok: true, data: await body({ db: getDb(), userId: session.user.id }) };
  } catch (err) {
    if (err instanceof UserError || err instanceof AccessError) {
      return { ok: false, error: err.message };
    }
    console.error("Server action failed", err);
    return { ok: false, error: "Something went wrong, please try again" };
  }
}
