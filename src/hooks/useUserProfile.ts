"use client";

import { useState, useEffect } from "react";
import { UserProfile } from "@/types/profile";
import { unwrap } from "@/lib/actionResult";
import { getProfile, updateMyProfile } from "@/server/actions/profiles";
import type { ProfileRow } from "@/server/data/profiles";

// One request per user for the whole page: avatars repeat on every expense row
const cache = new Map<string, Promise<UserProfile | null>>();

function loadProfile(userId: string): Promise<UserProfile | null> {
  let pending = cache.get(userId);
  if (!pending) {
    pending = getProfile(userId)
      .then(unwrap)
      .then((row) => (row ? mapProfile(row) : null));
    // Do not keep failures: a later render retries
    pending.catch(() => cache.delete(userId));
    cache.set(userId, pending);
  }
  return pending;
}

/** On sign-out: the next user must not see cached profiles */
export function clearProfileCache() {
  cache.clear();
}

export function useUserProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    loadProfile(userId)
      .then((loaded) => !cancelled && setProfile(loaded))
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch profile");
        setProfile(null);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const updateProfile = async (updates: { pseudo: string; description: string; avatarColor: string }): Promise<UserProfile> => {
    if (!userId) throw new Error("User ID required");

    try {
      setError(null);
      const updatedProfile = mapProfile(unwrap(await updateMyProfile(updates)));
      cache.set(userId, Promise.resolve(updatedProfile));
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
      throw err;
    }
  };

  return { profile, loading, error, updateProfile };
}

function mapProfile(data: ProfileRow): UserProfile {
  return {
    id: data.id,
    pseudo: data.pseudo,
    description: data.description,
    avatarColor: data.avatar_color,
    createdAt: data.created_at ?? "",
    updatedAt: data.updated_at ?? "",
  };
}
