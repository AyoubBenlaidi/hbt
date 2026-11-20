"use server";

import * as data from "@/server/data/dashboard";
import { run } from "./run";

export async function getDashboard() {
  return run(({ db, userId }) => data.getDashboard(db, userId));
}
