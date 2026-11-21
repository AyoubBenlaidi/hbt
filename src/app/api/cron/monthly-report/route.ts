import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
import { isUuid } from "@/server/data/common";
import { buildMonthlyReport, getMonth, getPreviousMonth, type ReportMonth } from "@/services/monthlyReport";
import { renderMonthlyReportEmail } from "@/services/email/monthlyReportEmail";
import { sendEmail } from "@/services/email/mailer";

/**
 * Monthly report cron
 * Triggered by Vercel Cron on the 1st of each month (see vercel.json).
 * Sends every household member the report of the previous month.
 *
 * Query params (all optional, still require the cron secret):
 *   month=YYYY-MM        report another month
 *   householdId=<uuid>   restrict to one household
 *   dryRun=1             build reports without sending or recording anything
 *   preview=1            with householdId: return the email HTML instead of sending
 */

export const dynamic = "force-dynamic";

// Matches no household: an invalid householdId selects nothing
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
export const maxDuration = 60;

function parseMonth(value: string | null): ReportMonth | null {
  const match = value?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  return match ? getMonth(Number(match[1]), Number(match[2])) : null;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const month = parseMonth(params.get("month")) ?? getPreviousMonth();
  const householdId = params.get("householdId");
  const dryRun = params.get("dryRun") === "1";
  const preview = params.get("preview") === "1";

  const db = getDb();
  const { households: householdsTable, monthlyReports } = schema;

  let households: { id: string; name: string }[];
  try {
    households = await db
      .select({ id: householdsTable.id, name: householdsTable.name })
      .from(householdsTable)
      .where(householdId ? eq(householdsTable.id, isUuid(householdId) ? householdId : NIL_UUID) : undefined);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  const results: Record<string, unknown>[] = [];

  for (const household of households || []) {
    try {
      const report = await buildMonthlyReport(db, household, month);
      const recipients = report.members.filter((m) => m.status === "active" && m.email);

      if (preview) {
        if (recipients.length === 0) continue;
        const { html } = renderMonthlyReportEmail(report, recipients[0]);
        return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }

      const hasActivity =
        report.monthExpenses.length > 0 || report.members.some((m) => m.balanceCents !== 0);
      if (!hasActivity || recipients.length === 0) {
        results.push({ householdId: household.id, status: "skipped" });
        continue;
      }

      if (dryRun) {
        results.push({
          householdId: household.id,
          status: "dry-run",
          recipients: recipients.map((r) => r.email),
          expenses: report.monthExpenses.length,
          settlements: report.settlements,
        });
        continue;
      }

      // Claim the (household, month) pair so a retried cron never sends twice
      const claimed = await db
        .insert(monthlyReports)
        .values({ householdId: household.id, month: month.key })
        .onConflictDoNothing()
        .returning({ id: monthlyReports.id });

      if (claimed.length === 0) {
        results.push({ householdId: household.id, status: "already-sent" });
        continue;
      }

      const failures: { email: string; error: string }[] = [];
      for (const recipient of recipients) {
        try {
          await sendEmail({ to: recipient.email!, ...renderMonthlyReportEmail(report, recipient) });
        } catch (err) {
          console.error(`Monthly report: failed to email ${recipient.email}`, err);
          failures.push({
            email: recipient.email!,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Nobody received it: release the claim so a manual re-run can retry
      if (failures.length === recipients.length) {
        await db
          .delete(monthlyReports)
          .where(and(eq(monthlyReports.householdId, household.id), eq(monthlyReports.month, month.key)));
      }

      results.push({
        householdId: household.id,
        status:
          failures.length === 0 ? "sent" : failures.length === recipients.length ? "failed" : "partial",
        sent: recipients.length - failures.length,
        failures,
      });
    } catch (err) {
      console.error(`Monthly report: household ${household.id} failed`, err);
      results.push({
        householdId: household.id,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (preview) {
    return NextResponse.json({ error: "No household with recipients found" }, { status: 404 });
  }

  return NextResponse.json({ month: month.key, dryRun, results });
}
