/**
 * Mock Authentication for Development
 * Bypasses Supabase for local testing
 */

export const MOCK_USER_ID = "mock-user-123";
export const MOCK_USER = {
  id: MOCK_USER_ID,
  email: "test@example.com",
  displayName: "Test User",
};

export const MOCK_HOUSEHOLD_ID = "mock-household-123";
export const MOCK_HOUSEHOLD = {
  id: MOCK_HOUSEHOLD_ID,
  name: "Test Household",
  createdByUserId: MOCK_USER_ID,
  members: [
    {
      id: "mock-member-1",
      householdId: MOCK_HOUSEHOLD_ID,
      userId: MOCK_USER_ID,
      role: "owner",
      status: "active",
      displayName: "Test User",
    },
    {
      id: "mock-member-2",
      householdId: MOCK_HOUSEHOLD_ID,
      userId: "mock-user-456",
      role: "member",
      status: "active",
      displayName: "Bob",
    },
  ],
};

export const MOCK_MEMBERS = MOCK_HOUSEHOLD.members;

export async function mockGetCurrentUser() {
  return MOCK_USER;
}

export async function mockGetUserHouseholds() {
  return [MOCK_HOUSEHOLD];
}
