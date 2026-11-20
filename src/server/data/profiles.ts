import { and, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getRandomAvatarColor } from "@/types/profile";
import { AccessError, UserError, iso, isUuid, type Db } from "./common";

/**
 * User profiles (pseudo, avatar color)
 */

const { userProfiles, householdMembers, householdJoinRequests, households } = schema;

function mapProfile(p: schema.UserProfile) {
  return {
    id: p.id,
    pseudo: p.pseudo,
    description: p.description,
    avatar_color: p.avatarColor,
    created_at: iso(p.createdAt),
    updated_at: iso(p.updatedAt),
  };
}

export type ProfileRow = ReturnType<typeof mapProfile>;

/**
 * A profile is visible to its owner, to people sharing a household, and to the
 * owner of a household the person asked to join.
 */
async function canSeeProfile(db: Db, userId: string, profileUserId: string) {
  if (profileUserId === userId) return true;

  const [shared] = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.userId, profileUserId),
        inArray(
          householdMembers.householdId,
          db.select({ id: householdMembers.householdId }).from(householdMembers).where(eq(householdMembers.userId, userId))
        )
      )
    )
    .limit(1);
  if (shared) return true;

  const [requested] = await db
    .select({ id: householdJoinRequests.id })
    .from(householdJoinRequests)
    .innerJoin(households, eq(households.id, householdJoinRequests.householdId))
    .where(and(eq(householdJoinRequests.requesterUserId, profileUserId), eq(households.createdByUserId, userId)))
    .limit(1);
  return !!requested;
}

/**
 * Profile of a user; the signed-in user's own profile is created on first
 * read (default pseudo and color), as before.
 */
export async function getProfile(db: Db, userId: string, profileUserId: string): Promise<ProfileRow | null> {
  if (!isUuid(profileUserId) || !(await canSeeProfile(db, userId, profileUserId))) return null;

  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.id, profileUserId));
  if (profile) return mapProfile(profile);
  if (profileUserId !== userId) return null;

  const [created] = await db
    .insert(userProfiles)
    .values({
      id: userId,
      pseudo: `User${userId.slice(0, 8).toUpperCase()}`,
      avatarColor: getRandomAvatarColor(),
    })
    .onConflictDoNothing()
    .returning();
  if (created) return mapProfile(created);

  // Created concurrently by another request
  const [existing] = await db.select().from(userProfiles).where(eq(userProfiles.id, userId));
  return mapProfile(existing);
}

export async function updateMyProfile(
  db: Db,
  userId: string,
  updates: { pseudo: string; description: string; avatarColor: string }
): Promise<ProfileRow> {
  const pseudo = updates.pseudo.trim();
  if (!pseudo) throw new UserError("Pseudo is required");

  const [taken] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(and(eq(userProfiles.pseudo, pseudo), sql`${userProfiles.id} <> ${userId}`));
  if (taken) throw new UserError("This pseudo is already taken");

  const [profile] = await db
    .update(userProfiles)
    .set({ pseudo, description: updates.description || null, avatarColor: updates.avatarColor })
    .where(eq(userProfiles.id, userId))
    .returning();
  if (!profile) throw new AccessError();
  return mapProfile(profile);
}
