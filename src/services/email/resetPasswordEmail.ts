/**
 * Password reset email (HTML + plain text)
 */

const ACCENT = "#1E3A5F";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderResetPasswordEmail({ name, url }: { name: string; url: string }) {
  const subject = "Réinitialisation de ton mot de passe";

  const html = `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f5f1ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2c2416;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#fff;border-radius:12px;padding:24px;">
      <h1 style="margin:0 0 16px;font-size:20px;">Réinitialisation du mot de passe</h1>
      <p style="margin:0 0 12px;">Bonjour ${escapeHtml(name)},</p>
      <p style="margin:0 0 20px;">Tu as demandé à changer ton mot de passe. Ce lien est valable une heure.</p>
      <p style="margin:0 0 20px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Choisir un nouveau mot de passe</a></p>
      <p style="margin:0;font-size:13px;color:#6b6359;">Si tu n'es pas à l'origine de cette demande, ignore cet email : ton mot de passe ne change pas.</p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    `Bonjour ${name},`,
    "",
    "Tu as demandé à changer ton mot de passe. Ce lien est valable une heure :",
    url,
    "",
    "Si tu n'es pas à l'origine de cette demande, ignore cet email : ton mot de passe ne change pas.",
  ].join("\n");

  return { subject, html, text };
}
