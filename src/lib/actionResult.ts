/**
 * Result of a server action: data, or a message to show to the user.
 * Thrown errors are redacted by Next.js in production, so actions return
 * failures instead of throwing them.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Client side: the data, or throws an Error carrying the action's message */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
