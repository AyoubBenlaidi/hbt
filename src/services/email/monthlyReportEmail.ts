import type { MonthlyReport, ReportMember } from "@/services/monthlyReport";

/**
 * Monthly report email (HTML + plain text), personalized for one member
 */

const ACCENT = "#4A7C59";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/** "de mars 2026" / "d'octobre 2026" */
function ofMonth(label: string): string {
  return /^[aeiouâéèêîôû]/i.test(label) ? `d'${label}` : `de ${label}`;
}

export function renderMonthlyReportEmail(
  report: MonthlyReport,
  recipient: ReportMember
): { subject: string; html: string; text: string } {
  const money = (cents: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: report.currency }).format(
      cents / 100
    );
  const nameOf = (memberId: string) =>
    report.members.find((m) => m.memberId === memberId)?.name ?? "Membre";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const subject = `${report.householdName} — bilan ${ofMonth(report.month.label)}`;

  // Personal summary
  const owes = report.settlements.filter((s) => s.fromMemberId === recipient.memberId);
  const owed = report.settlements.filter((s) => s.toMemberId === recipient.memberId);
  const personalLines = [
    ...owes.map((s) => `Tu dois ${money(s.amountCents)} à ${nameOf(s.toMemberId)}.`),
    ...owed.map((s) => `${nameOf(s.fromMemberId)} te doit ${money(s.amountCents)}.`),
  ];
  if (personalLines.length === 0) personalLines.push("Tu es à l'équilibre, rien à régler.");

  const settlementLines = report.settlements.map(
    (s) => `${nameOf(s.fromMemberId)} doit ${money(s.amountCents)} à ${nameOf(s.toMemberId)}`
  );

  // Members with a balance, plus active members (to show who is at 0)
  const balanceMembers = report.members
    .filter((m) => m.status === "active" || m.balanceCents !== 0)
    .sort((a, b) => b.balanceCents - a.balanceCents);

  const cell = "padding:8px 10px;border-bottom:1px solid #eee;font-size:14px;";
  const expenseRows = report.monthExpenses
    .map(
      (e) => `<tr>
        <td style="${cell}white-space:nowrap;color:#666;">${formatDate(e.date)}</td>
        <td style="${cell}">${escapeHtml(e.description)}</td>
        <td style="${cell}color:#666;">${escapeHtml(e.paidBy)}</td>
        <td style="${cell}text-align:right;white-space:nowrap;">${money(e.amountCents)}</td>
      </tr>`
    )
    .join("");

  const balanceRows = balanceMembers
    .map((m) => {
      const color = m.balanceCents > 0 ? ACCENT : m.balanceCents < 0 ? "#B3261E" : "#666";
      const sign = m.balanceCents > 0 ? "+" : "";
      return `<tr>
        <td style="${cell}">${escapeHtml(m.name)}</td>
        <td style="${cell}text-align:right;color:${color};font-weight:600;">${sign}${money(m.balanceCents)}</td>
      </tr>`;
    })
    .join("");

  const heading = "margin:28px 0 8px;font-size:16px;color:#222;";

  const html = `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f5f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#222;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#fff;border-radius:12px;padding:24px;">
      <p style="margin:0;font-size:13px;color:#666;">${escapeHtml(report.householdName)}</p>
      <h1 style="margin:4px 0 16px;font-size:22px;">Bilan ${escapeHtml(ofMonth(report.month.label))}</h1>

      <p style="margin:0 0 4px;">Bonjour ${escapeHtml(recipient.name)},</p>
      <div style="margin:12px 0 0;padding:12px 14px;background:#f0f5f1;border-left:4px solid ${ACCENT};border-radius:6px;">
        ${personalLines.map((l) => `<p style="margin:2px 0;font-weight:600;">${escapeHtml(l)}</p>`).join("")}
      </div>

      <h2 style="${heading}">Dépenses du mois</h2>
      ${
        report.monthExpenses.length > 0
          ? `<table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="${cell}text-align:left;color:#666;font-weight:500;">Date</th>
          <th style="${cell}text-align:left;color:#666;font-weight:500;">Description</th>
          <th style="${cell}text-align:left;color:#666;font-weight:500;">Payé par</th>
          <th style="${cell}text-align:right;color:#666;font-weight:500;">Montant</th>
        </tr></thead>
        <tbody>${expenseRows}</tbody>
        <tfoot><tr>
          <td colspan="3" style="${cell}font-weight:600;">Total (${report.monthExpenses.length} dépense${report.monthExpenses.length > 1 ? "s" : ""})</td>
          <td style="${cell}text-align:right;font-weight:600;white-space:nowrap;">${money(report.monthTotalCents)}</td>
        </tr></tfoot>
      </table>`
          : `<p style="margin:0;color:#666;">Aucune dépense ce mois-ci.</p>`
      }

      <h2 style="${heading}">Soldes cumulés</h2>
      <p style="margin:0 0 8px;font-size:13px;color:#666;">Depuis la création du foyer, remboursements inclus. Positif : on lui doit de l'argent.</p>
      <table style="width:100%;border-collapse:collapse;"><tbody>${balanceRows}</tbody></table>

      <h2 style="${heading}">Pour équilibrer</h2>
      ${
        settlementLines.length > 0
          ? settlementLines.map((l) => `<p style="margin:4px 0;">• ${escapeHtml(l)}</p>`).join("")
          : `<p style="margin:0;color:#666;">Tout le monde est à l'équilibre.</p>`
      }

      ${
        appUrl
          ? `<p style="margin:28px 0 0;"><a href="${escapeHtml(appUrl)}/households/${report.householdId}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Voir le foyer</a></p>`
          : ""
      }
    </div>
  </div>
</body>
</html>`;

  const text = [
    `${report.householdName} — Bilan ${ofMonth(report.month.label)}`,
    "",
    `Bonjour ${recipient.name},`,
    ...personalLines,
    "",
    "DÉPENSES DU MOIS",
    ...(report.monthExpenses.length > 0
      ? [
          ...report.monthExpenses.map(
            (e) => `${formatDate(e.date)}  ${e.description} (${e.paidBy})  ${money(e.amountCents)}`
          ),
          `Total : ${money(report.monthTotalCents)}`,
        ]
      : ["Aucune dépense ce mois-ci."]),
    "",
    "SOLDES CUMULÉS",
    ...balanceMembers.map(
      (m) => `${m.name} : ${m.balanceCents > 0 ? "+" : ""}${money(m.balanceCents)}`
    ),
    "",
    "POUR ÉQUILIBRER",
    ...(settlementLines.length > 0 ? settlementLines : ["Tout le monde est à l'équilibre."]),
    ...(appUrl ? ["", `${appUrl}/households/${report.householdId}`] : []),
  ].join("\n");

  return { subject, html, text };
}
