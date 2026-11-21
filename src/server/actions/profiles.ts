"use server";

import * as data from "@/server/data/profiles";
import { run } from "./run";

export async function getProfile(profileUserId: string) {
  return run(({ db, userId }) => data.getProfile(db, userId, profileUserId));
}

export async function updateMyProfile(updates: { pseudo: string; description: string; avatarColor: string }) {
  return run(({ db, userId }) => data.updateMyProfile(db, userId, updates));
}
