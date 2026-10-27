import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let householdsQuery = supabase.from("households").select("id, name");
  if (householdId) householdsQuery = householdsQuery.eq("id", householdId);
  const { data: households, error: householdsError } = await householdsQuery;

  if (householdsError) {
    return NextResponse.json({ error: householdsError.message }, { status: 500 });
  }

  const results: Record<string, unknown>[] = [];

  for (const household of households || []) {
    try {
      const report = await buildMonthlyReport(supabase, household, month);
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
      const { error: claimError } = await supabase
        .from("monthly_reports")
        .insert({ household_id: household.id, month: month.key });

      if (claimError) {
        if (claimError.code === "23505") {
          results.push({ householdId: household.id, status: "already-sent" });
          continue;
        }
        throw claimError;
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
        await supabase
          .from("monthly_reports")
          .delete()
          .eq("household_id", household.id)
          .eq("month", month.key);
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
