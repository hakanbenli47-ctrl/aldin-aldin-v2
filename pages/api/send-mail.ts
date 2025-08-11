import type { NextApiRequest, NextApiResponse } from "next";
import sgMail, { MailDataRequired } from "@sendgrid/mail";

const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM || "no-reply@yourdomain.com";

if (!SENDGRID_KEY) {
  console.warn("[send-mail] SENDGRID_API_KEY .env.local'da yok");
} else {
  sgMail.setApiKey(SENDGRID_KEY);
}

type Body = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { to, subject, text, html, cc, bcc, replyTo } = (req.body || {}) as Body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ error: "to, subject ve text|html zorunludur" });
    }
    if (!SENDGRID_KEY || !SENDGRID_FROM) {
      return res.status(500).json({ error: "SendGrid yapılandırması eksik" });
    }

    // Çoğu sürümle uyumlu basit tip: text/html'i üst alanlardan veriyoruz.
    const msg: MailDataRequired = {
      to,
      from: SENDGRID_FROM,
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
      ...(replyTo ? { replyTo } : {}),
    } as MailDataRequired;

    const [response] = await sgMail.send(msg);
    return res.status(200).json({ ok: true, status: response.statusCode });
  } catch (err: any) {
    console.error("[send-mail] error:", err?.response?.body || err);
    return res.status(500).json({
      error: "Mail gönderilemedi",
      detail: err?.response?.body ?? err?.message ?? "unknown",
    });
  }
}
