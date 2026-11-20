import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { generateJoinCode, normalizeCode } from "@/lib/joinCode";
import { AccessError, UserError, getMembership, isUuid, iso, num, requireOwner, type Db } from "./common";

/**
 * Households, members, join codes and join requests
 */

const { households, householdMembers, householdJoinRequests, users, userProfiles, expensePayers, expenseSplits, expenses } =
  schema;

function mapHousehold(h: schema.Household) {
  return {
    id: h.id,
    name: h.name,
    created_by_user_id: h.createdByUserId,
    created_at: iso(h.createdAt)!,
    updated_at: iso(h.updatedAt)!,
    join_code: h.joinCode,
    join_code_enabled: h.joinCodeEnabled,
  };
}

/** Members with their user, as the household page displays them */
export async function listMembers(db: Db, householdId: string) {
  const rows = await db
    .select({ member: householdMembers, email: users.email, displayName: users.displayName })
    .from(householdMembers)
    .innerJoin(users, eq(users.id, householdMembers.userId))
    .where(eq(householdMembers.householdId, householdId))
    .orderBy(asc(householdMembers.joinedAt));

  return rows.map(({ member, email, displayName }) => ({
    id: member.id,
    user_id: member.userId,
    role: member.role,
    status: member.status,
    joined_at: iso(member.joinedAt)!,
    users: { email, display_name: displayName },
  }));
}

async function uniqueJoinCode(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateJoinCode();
    const [taken] = await db.select({ id: households.id }).from(households).where(eq(households.joinCode, code));
    if (!taken) return code;
  }
  throw new Error("Could not generate a unique join code");
}

/** Households of the user with their own paid / owed totals (deleted expenses excluded) */
export async function listMyHouseholds(db: Db, userId: string) {
  const sumFor = (table: typeof expensePayers | typeof expenseSplits) => sql<string>`coalesce((
    select sum(t.amount) from ${table} t
    join ${expenses} e on e.id = t.expense_id
    where t.member_id = ${householdMembers.id} and e.deleted_at is null
  ), 0)`;

  const rows = await db
    .select({
      id: households.id,
      name: households.name,
      createdByUserId: households.createdByUserId,
      paid: sumFor(expensePayers),
      owed: sumFor(expenseSplits),
    })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, userId))
    .orderBy(asc(households.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    created_by_user_id: r.createdByUserId,
    totalPaid: num(r.paid),
    totalOwed: num(r.owed),
    balance: num(r.paid) - num(r.owed),
  }));
}

/** Households of the user, for selectors */
export async function listMyHouseholdNames(db: Db, userId: string) {
  return db
    .select({ id: households.id, name: households.name })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, userId))
    .orderBy(asc(households.createdAt));
}

export async function createHousehold(db: Db, userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new UserError("Please enter a household name");

  const joinCode = await uniqueJoinCode(db);
  return db.transaction(async (tx) => {
    const [household] = await tx
      .insert(households)
      .values({ name: trimmed, createdByUserId: userId, joinCode, joinCodeEnabled: true })
      .returning();
    await tx.insert(householdMembers).values({ householdId: household.id, userId, role: "owner", status: "active" });
    return mapHousehold(household);
  });
}

/** Household page: details, members, and join requests for the owner. null when not a member */
export async function getHouseholdDetail(db: Db, userId: string, householdId: string) {
  if (!(await getMembership(db, userId, householdId))) return null;

  const [household] = await db.select().from(households).where(eq(households.id, householdId));
  const members = await listMembers(db, householdId);
  const joinRequests = household.createdByUserId === userId ? await listJoinRequests(db, householdId) : null;

  return { household: mapHousehold(household), members, joinRequests };
}

async function listJoinRequests(db: Db, householdId: string) {
  const select = () =>
    db
      .select({ request: householdJoinRequests, pseudo: userProfiles.pseudo, avatarColor: userProfiles.avatarColor })
      .from(householdJoinRequests)
      .leftJoin(userProfiles, eq(userProfiles.id, householdJoinRequests.requesterUserId));

  const [pending, reviewed] = await Promise.all([
    select()
      .where(and(eq(householdJoinRequests.householdId, householdId), eq(householdJoinRequests.status, "pending")))
      .orderBy(desc(householdJoinRequests.createdAt)),
    select()
      .where(
        and(
          eq(householdJoinRequests.householdId, householdId),
          inArray(householdJoinRequests.status, ["approved", "rejected"])
        )
      )
      .orderBy(sql`${householdJoinRequests.reviewedAt} desc nulls first`)
      .limit(20),
  ]);

  const map = ({ request: r, pseudo, avatarColor }: (typeof pending)[number]) => ({
    id: r.id,
    household_id: r.householdId,
    requester_user_id: r.requesterUserId,
    code_used: r.codeUsed,
    status: r.status,
    created_at: iso(r.createdAt)!,
    reviewed_at: iso(r.reviewedAt) ?? undefined,
    reviewed_by_user_id: r.reviewedByUserId,
    requester_pseudo: pseudo || "Unknown user",
    requester_avatar_color: avatarColor || "#9B8E7F",
  });

  return { pending: pending.map(map), reviewed: reviewed.map(map) };
}

export async function listMyPendingJoinRequests(db: Db, userId: string) {
  const rows = await db
    .select({ request: householdJoinRequests, householdName: households.name })
    .from(householdJoinRequests)
    .innerJoin(households, eq(households.id, householdJoinRequests.householdId))
    .where(and(eq(householdJoinRequests.requesterUserId, userId), eq(householdJoinRequests.status, "pending")));

  return rows.map(({ request, householdName }) => ({
    id: request.id,
    household_id: request.householdId,
    status: request.status,
    created_at: iso(request.createdAt)!,
    household_name: householdName,
  }));
}

export type JoinResult =
  | { status: "invalid" }
  | { status: "paused" }
  | { status: "already_member" }
  | { status: "already_pending" }
  | { status: "sent"; request: Awaited<ReturnType<typeof listMyPendingJoinRequests>>[number] };

export async function requestToJoin(db: Db, userId: string, code: string): Promise<JoinResult> {
  const normalized = normalizeCode(code);
  const [household] = await db.select().from(households).where(eq(households.joinCode, normalized));

  if (!household) return { status: "invalid" };
  if (!household.joinCodeEnabled) return { status: "paused" };
  if (await getMembership(db, userId, household.id)) return { status: "already_member" };

  const [pending] = await db
    .select({ id: householdJoinRequests.id })
    .from(householdJoinRequests)
    .where(
      and(
        eq(householdJoinRequests.householdId, household.id),
        eq(householdJoinRequests.requesterUserId, userId),
        eq(householdJoinRequests.status, "pending")
      )
    );
  if (pending) return { status: "already_pending" };

  const [request] = await db
    .insert(householdJoinRequests)
    .values({ householdId: household.id, requesterUserId: userId, codeUsed: normalized, status: "pending" })
    .returning();

  return {
    status: "sent",
    request: {
      id: request.id,
      household_id: household.id,
      status: request.status,
      created_at: iso(request.createdAt)!,
      household_name: household.name,
    },
  };
}

/** The requester cancels their own pending request */
export async function cancelJoinRequest(db: Db, userId: string, requestId: string) {
  if (!isUuid(requestId)) throw new AccessError();
  const updated = await db
    .update(householdJoinRequests)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(householdJoinRequests.id, requestId),
        eq(householdJoinRequests.requesterUserId, userId),
        eq(householdJoinRequests.status, "pending")
      )
    )
    .returning({ id: householdJoinRequests.id });
  if (updated.length === 0) throw new AccessError();
}

async function getRequestForOwner(db: Db, userId: string, requestId: string) {
  if (!isUuid(requestId)) throw new AccessError();
  const [request] = await db.select().from(householdJoinRequests).where(eq(householdJoinRequests.id, requestId));
  if (!request) throw new AccessError();
  await requireOwner(db, userId, request.householdId);
  return request;
}

/** Owner approves: the requester becomes a member (unless already one) */
export async function approveJoinRequest(db: Db, userId: string, requestId: string) {
  const request = await getRequestForOwner(db, userId, requestId);
  const alreadyMember = !!(await getMembership(db, request.requesterUserId, request.householdId));

  await db.transaction(async (tx) => {
    if (!alreadyMember) {
      await tx
        .insert(householdMembers)
        .values({ householdId: request.householdId, userId: request.requesterUserId, role: "member", status: "active" });
    }
    await tx
      .update(householdJoinRequests)
      .set({ status: "approved", reviewedAt: new Date(), reviewedByUserId: userId })
      .where(eq(householdJoinRequests.id, request.id));
  });

  return { alreadyMember, members: await listMembers(db, request.householdId) };
}

export async function rejectJoinRequest(db: Db, userId: string, requestId: string) {
  const request = await getRequestForOwner(db, userId, requestId);
  await db
    .update(householdJoinRequests)
    .set({ status: "rejected", reviewedAt: new Date(), reviewedByUserId: userId })
    .where(eq(householdJoinRequests.id, request.id));
}

export async function regenerateJoinCode(db: Db, userId: string, householdId: string) {
  await requireOwner(db, userId, householdId);
  const joinCode = await uniqueJoinCode(db);
  await db.update(households).set({ joinCode, joinCodeUpdatedAt: new Date() }).where(eq(households.id, householdId));
  return joinCode;
}

export async function setJoinCodeEnabled(db: Db, userId: string, householdId: string, enabled: boolean) {
  await requireOwner(db, userId, householdId);
  await db.update(households).set({ joinCodeEnabled: enabled }).where(eq(households.id, householdId));
}

export type InviteResult =
  | { status: "not_found" }
  | { status: "already_member" }
  | { status: "added"; members: Awaited<ReturnType<typeof listMembers>> };

/** Owner adds an existing user by email */
export async function inviteMemberByEmail(db: Db, userId: string, householdId: string, email: string): Promise<InviteResult> {
  await requireOwner(db, userId, householdId);
  const [invited] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()));

  if (!invited) return { status: "not_found" };
  if (await getMembership(db, invited.id, householdId)) return { status: "already_member" };

  await db.insert(householdMembers).values({ householdId, userId: invited.id, role: "member", status: "active" });
  return { status: "added", members: await listMembers(db, householdId) };
}

/** Owner removes a member (their payers and splits go with them, as before) */
export async function removeMember(db: Db, userId: string, householdId: string, memberId: string) {
  await requireOwner(db, userId, householdId);
  if (!isUuid(memberId)) throw new AccessError();
  await db
    .delete(householdMembers)
    .where(and(eq(householdMembers.id, memberId), eq(householdMembers.householdId, householdId)));
}

export async function renameHousehold(db: Db, userId: string, householdId: string, name: string) {
  await requireOwner(db, userId, householdId);
  const trimmed = name.trim();
  if (!trimmed) throw new UserError("Household name cannot be empty");
  await db.update(households).set({ name: trimmed, updatedAt: new Date() }).where(eq(households.id, householdId));
}

/** Owner deletes the household: members, expenses, requests and reports cascade */
export async function deleteHousehold(db: Db, userId: string, householdId: string) {
  await requireOwner(db, userId, householdId);
  await db.delete(households).where(eq(households.id, householdId));
}
