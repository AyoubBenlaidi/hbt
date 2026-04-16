"use server";

import { signUp as authSignUp, signIn as authSignIn, signOut as authSignOut } from "@/modules/auth";
import type { ApiResponse } from "@/types";

/**
 * Server Actions for Authentication
 */

export async function signUpAction(
  email: string,
  password: string,
  displayName: string
): Promise<ApiResponse<{ userId: string }>> {
  try {
    const { user, error } = await authSignUp(email, password, displayName);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (!user) {
      return {
        success: false,
        error: "Failed to create user",
      };
    }

    return {
      success: true,
      data: { userId: user.id },
    };
  } catch (error) {
    console.error("Error in signUpAction:", error);
    return {
      success: false,
      error: "Failed to sign up",
    };
  }
}

export async function signInAction(
  email: string,
  password: string
): Promise<ApiResponse<{ userId: string }>> {
  try {
    const { user, error } = await authSignIn(email, password);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (!user) {
      return {
        success: false,
        error: "Failed to sign in",
      };
    }

    return {
      success: true,
      data: { userId: user.id },
    };
  } catch (error) {
    console.error("Error in signInAction:", error);
    return {
      success: false,
      error: "Failed to sign in",
    };
  }
}

export async function signOutAction(): Promise<ApiResponse<null>> {
  try {
    const { error } = await authSignOut();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error in signOutAction:", error);
    return {
      success: false,
      error: "Failed to sign out",
    };
  }
}
