import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";

/**
 * Shared helpers for the server data layer.
 *
 * Functions take the database and the signed-in user's id (never a user id
 * sent by the browser) and check access themselves. They return the same
 * shapes the pages used to get from Supabase (snake_case, numeric amounts as
 * numbers, timestamps as ISO strings).
 */

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** An expected failure whose message is shown to the user */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

/** The user may not see or change this resource */
export class AccessError extends Error {
  constructor(message = "Not allowed") {
    super(message);
    this.name = "AccessError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** numeric columns come back as strings from Postgres */
export function num(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

export function iso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export async function getMembership(db: Db, userId: string, householdId: string) {
  if (!isUuid(householdId)) return null;
  const [member] = await db
    .select()
    .from(schema.householdMembers)
    .where(and(eq(schema.householdMembers.householdId, householdId), eq(schema.householdMembers.userId, userId)));
  return member ?? null;
}

/** Throws unless the user is a member of the household */
export async function requireMember(db: Db, userId: string, householdId: string) {
  const member = await getMembership(db, userId, householdId);
  if (!member) throw new AccessError();
  return member;
}

/** Throws unless the user created the household (the owner in the UI) */
export async function requireOwner(db: Db, userId: string, householdId: string) {
  if (!isUuid(householdId)) throw new AccessError();
  const [household] = await db.select().from(schema.households).where(eq(schema.households.id, householdId));
  if (!household || household.createdByUserId !== userId) throw new AccessError();
  return household;
}
