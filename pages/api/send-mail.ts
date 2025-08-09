import type { NextApiRequest, NextApiResponse } from "next";
import sgMail, { MailDataRequired } from "@sendgrid/mail";
import type { MailContent } from "@sendgrid/helpers/classes/mail"; // <-- doğru import

const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM || "no-reply@yourdomain.com";

if (!SENDGRID_KEY) {
  console.warn("[send-mail] SENDGRID_API_KEY .env.local'da yok");
} else {
  sgMail.setApiKey(SENDGRID_KEY);
}

type Body = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { to, subject, text, html, cc, bcc } = (req.body || {}) as Body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ error: "to, subject ve text|html zorunludur" });
    }
    if (!SENDGRID_KEY || !SENDGRID_FROM) {
      return res.status(500).json({ error: "SendGrid yapılandırması eksik" });
    }

    // 🔒 'content' en az 1 elemanlı tuple olmalı
    const firstPart: MailContent = html
      ? { type: "text/html", value: html }
      : { type: "text/plain", value: text! };

    const content = [firstPart] as [MailContent, ...MailContent[]];

    const msg: MailDataRequired = {
      to,
      from: SENDGRID_FROM,
      subject,
      content,       // <-- doğru tip: tuple + MailContent
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
    };

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
