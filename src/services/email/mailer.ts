import nodemailer, { type Transporter } from "nodemailer";

/**
 * SMTP mailer
 * Works with any SMTP provider (Gmail app password, Brevo, Resend, ...)
 * configured through SMTP_* environment variables.
 */

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!_transporter) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
      throw new Error("Missing SMTP environment variables");
    }

    const port = Number(SMTP_PORT || 465);
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });
  }
  return _transporter;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    ...params,
  });
}
