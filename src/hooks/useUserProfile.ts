"use client";

import { useState, useEffect } from "react";
import { UserProfile, getRandomAvatarColor } from "@/types/profile";
import { supabase } from "@/lib/supabase/client";

export function useUserProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (fetchError) {
        if (fetchError.code === "PGRST116") {
          // Not found - create default profile
          const generatedColor = getRandomAvatarColor();
          const pseudo = `User${userId.slice(0, 8).toUpperCase()}`;

          const { data: newProfile, error: createError } = await supabase
            .from("user_profiles")
            .insert({
              id: userId,
              pseudo,
              avatar_color: generatedColor,
            })
            .select()
            .single();

          if (createError) throw createError;
          setProfile(mapProfile(newProfile));
        } else {
          throw fetchError;
        }
      } else {
        setProfile(mapProfile(data));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch profile");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: { pseudo: string; description: string; avatarColor: string }): Promise<UserProfile> => {
    if (!userId) throw new Error("User ID required");

    try {
      setError(null);

      const { data, error: updateError } = await supabase
        .from("user_profiles")
        .update({
          pseudo: updates.pseudo,
          description: updates.description || null,
          avatar_color: updates.avatarColor,
        })
        .eq("id", userId)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedProfile = mapProfile(data);
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
      throw err;
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  return { profile, loading, error, updateProfile };
}

function mapProfile(data: any): UserProfile {
  return {
    id: data.id,
    pseudo: data.pseudo,
    description: data.description,
    avatarColor: data.avatar_color,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
