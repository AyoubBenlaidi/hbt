"use server";

import { createClient } from "@supabase/supabase-js";
import type { ApiResponse } from "@/types";

/**
 * Server Actions for Household mutations
 * Using Supabase client directly since database is remote
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createHouseholdAction(
  name: string,
  userId: string
): Promise<ApiResponse<{ householdId: string }>> {
  try {
    // Create household
    const { data: householdData, error: householdError } = await supabase
      .from("households")
      .insert({
        name,
        created_by_user_id: userId,
      })
      .select("id")
      .single();

    if (householdError) {
      return { success: false, error: "Failed to create household" };
    }

    const householdId = householdData.id;

    // Add creator as member
    const { error: memberError } = await supabase
      .from("household_members")
      .insert({
        household_id: householdId,
        user_id: userId,
        role: "owner",
        status: "active",
      });

    if (memberError) {
      return { success: false, error: "Failed to add creator as member" };
    }

    return {
      success: true,
      data: { householdId },
    };
  } catch (error) {
    console.error("Error in createHouseholdAction:", error);
    return {
      success: false,
      error: "Failed to create household",
    };
  }
}

export async function addHouseholdMemberAction(
  householdId: string,
  userId: string
): Promise<ApiResponse<{ memberId: string }>> {
  try {
    const { data, error } = await supabase
      .from("household_members")
      .insert({
        household_id: householdId,
        user_id: userId,
        role: "member",
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: "Failed to add member" };
    }

    return {
      success: true,
      data: { memberId: data.id },
    };
  } catch (error) {
    console.error("Error in addHouseholdMemberAction:", error);
    return {
      success: false,
      error: "Failed to add member",
    };
  }
}
