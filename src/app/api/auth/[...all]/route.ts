import { getAuth } from "@/lib/auth";

/**
 * Better Auth endpoints (/api/auth/sign-in/email, /api/auth/get-session, …)
 */

const handler = (request: Request) => getAuth().handler(request);

export const GET = handler;
export const POST = handler;
