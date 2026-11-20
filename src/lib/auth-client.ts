"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser client for the Better Auth endpoints mounted on /api/auth
 */
export const authClient = createAuthClient();
