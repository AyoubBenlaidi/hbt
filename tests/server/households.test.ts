import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { PGlite } from "@electric-sql/pglite";
import * as schema from "@/db/schema";
import { AccessError } from "@/server/data/common";
import * as households from "@/server/data/households";
import { createTestDb, type TestDb } from "../helpers/db";
import { addMember, createExpense, createHousehold, createUser } from "../helpers/factories";

let db: TestDb;
let client: PGlite;

beforeAll(async () => {
  ({ db, client } = await createTestDb());
});
afterAll(async () => {
  await client.close();
});

describe("households", () => {
  it("create: owner membership, unique join code, Supabase-like shape", async () => {
    const owner = await createUser(db);
    const h = await households.createHousehold(db, owner.id, "  Coloc  ");
    expect(h).toMatchObject({ name: "Coloc", created_by_user_id: owner.id, join_code_enabled: true });
    expect(h.join_code).toMatch(/^[A-Z2-9]{6}$/);

    const detail = await households.getHouseholdDetail(db, owner.id, h.id);
    expect(detail?.members).toEqual([
      expect.objectContaining({ user_id: owner.id, role: "owner", users: { email: owner.email, display_name: owner.displayName } }),
    ]);
    expect(detail?.joinRequests).toEqual({ pending: [], reviewed: [] });
  });

  it("lists my households with my paid / owed totals, ignoring deleted expenses", async () => {
    const alice = await createUser(db);
    const bob = await createUser(db);
    const { household, ownerMember } = await createHousehold(db, alice);
    const bobMember = await addMember(db, household, bob);
    const shares = { payers: [{ member: ownerMember, amount: "100" }], splits: [{ member: ownerMember, amount: "50" }, { member: bobMember, amount: "50" }] };
    await createExpense(db, { household, createdBy: alice, amount: "100", ...shares });
    const deleted = await createExpense(db, { household, createdBy: alice, amount: "100", ...shares });
    await db.update(schema.expenses).set({ deletedAt: new Date() }).where(eq(schema.expenses.id, deleted.id));

    expect(await households.listMyHouseholds(db, alice.id)).toEqual([
      { id: household.id, name: household.name, created_by_user_id: alice.id, totalPaid: 100, totalOwed: 50, balance: 50 },
    ]);
    expect((await households.listMyHouseholds(db, bob.id))[0]).toMatchObject({ totalPaid: 0, totalOwed: 50, balance: -50 });
  });

  it("hides a household from non-members", async () => {
    const owner = await createUser(db);
    const stranger = await createUser(db);
    const { household } = await createHousehold(db, owner);
    expect(await households.getHouseholdDetail(db, stranger.id, household.id)).toBeNull();
    expect(await households.getHouseholdDetail(db, stranger.id, "not-a-uuid")).toBeNull();
    expect(await households.listMyHouseholds(db, stranger.id)).toEqual([]);
  });

  it("only the owner manages the household", async () => {
    const owner = await createUser(db);
    const member = await createUser(db);
    const { household } = await createHousehold(db, owner);
    const m = await addMember(db, household, member);

    for (const attempt of [
      () => households.renameHousehold(db, member.id, household.id, "Mine"),
      () => households.regenerateJoinCode(db, member.id, household.id),
      () => households.setJoinCodeEnabled(db, member.id, household.id, false),
      () => households.inviteMemberByEmail(db, member.id, household.id, owner.email),
      () => households.removeMember(db, member.id, household.id, m.id),
      () => households.deleteHousehold(db, member.id, household.id),
    ]) {
      await expect(attempt()).rejects.toBeInstanceOf(AccessError);
    }

    await households.renameHousehold(db, owner.id, household.id, " Nouveau nom ");
    const code = await households.regenerateJoinCode(db, owner.id, household.id);
    expect(code).not.toBe(household.joinCode);
    const detail = await households.getHouseholdDetail(db, member.id, household.id);
    expect(detail?.household).toMatchObject({ name: "Nouveau nom", join_code: code });
    expect(detail?.joinRequests).toBeNull(); // members don't see join requests
  });

  it("invites by email (case-insensitive) and removes a member", async () => {
    const owner = await createUser(db);
    const invited = await createUser(db);
    const { household } = await createHousehold(db, owner);

    expect(await households.inviteMemberByEmail(db, owner.id, household.id, "nobody@example.com")).toEqual({ status: "not_found" });
    const added = await households.inviteMemberByEmail(db, owner.id, household.id, invited.email.toUpperCase());
    expect(added.status).toBe("added");
    expect(await households.inviteMemberByEmail(db, owner.id, household.id, invited.email)).toEqual({ status: "already_member" });

    const memberId = added.status === "added" ? added.members.find((m) => m.user_id === invited.id)!.id : "";
    await households.removeMember(db, owner.id, household.id, memberId);
    expect(await households.getHouseholdDetail(db, invited.id, household.id)).toBeNull();
  });

  it("deletes the household with everything in it", async () => {
    const owner = await createUser(db);
    const { household, ownerMember } = await createHousehold(db, owner);
    await createExpense(db, { household, createdBy: owner, amount: "10", payers: [{ member: ownerMember, amount: "10" }], splits: [{ member: ownerMember, amount: "10" }] });
    await households.deleteHousehold(db, owner.id, household.id);
    expect(await db.select().from(schema.expenses).where(eq(schema.expenses.householdId, household.id))).toEqual([]);
  });
});

describe("join requests", () => {
  it("full flow: invalid, paused, sent, already pending, approve, already member", async () => {
    const owner = await createUser(db);
    const requester = await createUser(db);
    const { household } = await createHousehold(db, owner);
    const code = household.joinCode.toLowerCase().replace(/^(...)/, "$1-");

    expect(await households.requestToJoin(db, requester.id, "ZZZZZZ")).toEqual({ status: "invalid" });
    await households.setJoinCodeEnabled(db, owner.id, household.id, false);
    expect(await households.requestToJoin(db, requester.id, code)).toEqual({ status: "paused" });
    await households.setJoinCodeEnabled(db, owner.id, household.id, true);

    const sent = await households.requestToJoin(db, requester.id, code);
    expect(sent).toMatchObject({ status: "sent", request: { household_id: household.id, household_name: household.name, status: "pending" } });
    expect(await households.requestToJoin(db, requester.id, code)).toEqual({ status: "already_pending" });
    expect(await households.listMyPendingJoinRequests(db, requester.id)).toHaveLength(1);

    const requestId = sent.status === "sent" ? sent.request.id : "";
    const pending = (await households.getHouseholdDetail(db, owner.id, household.id))!.joinRequests!.pending;
    expect(pending).toEqual([expect.objectContaining({ id: requestId, requester_pseudo: "Unknown user" })]);

    await expect(households.approveJoinRequest(db, requester.id, requestId)).rejects.toBeInstanceOf(AccessError);
    const approved = await households.approveJoinRequest(db, owner.id, requestId);
    expect(approved.alreadyMember).toBe(false);
    expect(approved.members.map((m) => m.user_id)).toContain(requester.id);
    expect(await households.requestToJoin(db, requester.id, code)).toEqual({ status: "already_member" });

    const reviewed = (await households.getHouseholdDetail(db, owner.id, household.id))!.joinRequests!.reviewed;
    expect(reviewed[0]).toMatchObject({ id: requestId, status: "approved" });
  });

  it("reject and cancel are limited to the owner and the requester", async () => {
    const owner = await createUser(db);
    const requester = await createUser(db);
    const other = await createUser(db);
    const { household } = await createHousehold(db, owner);

    const first = await households.requestToJoin(db, requester.id, household.joinCode);
    const firstId = first.status === "sent" ? first.request.id : "";
    await expect(households.rejectJoinRequest(db, other.id, firstId)).rejects.toBeInstanceOf(AccessError);
    await households.rejectJoinRequest(db, owner.id, firstId);

    const second = await households.requestToJoin(db, requester.id, household.joinCode);
    const secondId = second.status === "sent" ? second.request.id : "";
    await expect(households.cancelJoinRequest(db, other.id, secondId)).rejects.toBeInstanceOf(AccessError);
    await households.cancelJoinRequest(db, requester.id, secondId);
    expect(await households.listMyPendingJoinRequests(db, requester.id)).toEqual([]);
  });
});
