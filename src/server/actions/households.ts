"use server";

import * as data from "@/server/data/households";
import { run } from "./run";

export async function listMyHouseholds() {
  return run(({ db, userId }) => data.listMyHouseholds(db, userId));
}

export async function listMyHouseholdNames() {
  return run(({ db, userId }) => data.listMyHouseholdNames(db, userId));
}

export async function listMyPendingJoinRequests() {
  return run(({ db, userId }) => data.listMyPendingJoinRequests(db, userId));
}

export async function createHousehold(name: string) {
  return run(({ db, userId }) => data.createHousehold(db, userId, name));
}

export async function getHouseholdDetail(householdId: string) {
  return run(({ db, userId }) => data.getHouseholdDetail(db, userId, householdId));
}

export async function requestToJoin(code: string) {
  return run(({ db, userId }) => data.requestToJoin(db, userId, code));
}

export async function cancelJoinRequest(requestId: string) {
  return run(({ db, userId }) => data.cancelJoinRequest(db, userId, requestId));
}

export async function approveJoinRequest(requestId: string) {
  return run(({ db, userId }) => data.approveJoinRequest(db, userId, requestId));
}

export async function rejectJoinRequest(requestId: string) {
  return run(({ db, userId }) => data.rejectJoinRequest(db, userId, requestId));
}

export async function regenerateJoinCode(householdId: string) {
  return run(({ db, userId }) => data.regenerateJoinCode(db, userId, householdId));
}

export async function setJoinCodeEnabled(householdId: string, enabled: boolean) {
  return run(({ db, userId }) => data.setJoinCodeEnabled(db, userId, householdId, enabled));
}

export async function inviteMemberByEmail(householdId: string, email: string) {
  return run(({ db, userId }) => data.inviteMemberByEmail(db, userId, householdId, email));
}

export async function removeMember(householdId: string, memberId: string) {
  return run(({ db, userId }) => data.removeMember(db, userId, householdId, memberId));
}

export async function renameHousehold(householdId: string, name: string) {
  return run(({ db, userId }) => data.renameHousehold(db, userId, householdId, name));
}

export async function deleteHousehold(householdId: string) {
  return run(({ db, userId }) => data.deleteHousehold(db, userId, householdId));
}
