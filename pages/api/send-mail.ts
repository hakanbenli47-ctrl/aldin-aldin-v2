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
  firmaAdi?: string;
  vergiNo?: string;
  telefon?: string;
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
    const { to, subject, text, html, cc, bcc, replyTo, firmaAdi, vergiNo, telefon } =
      (req.body || {}) as Body;

    if (!to || !subject) {
      return res.status(400).json({ error: "to ve subject zorunludur" });
    }
    if (!SENDGRID_KEY || !SENDGRID_FROM) {
      return res.status(500).json({ error: "SendGrid yapılandırması eksik" });
    }

    // Eğer özel html gönderilmemişse admin bildirimi için şablon hazırla
    const htmlContent =
      html ||
      `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb;">
        <h2 style="color: #1648b0;">Yeni Satıcı Başvurusu</h2>
        <p><b>Firma:</b> ${firmaAdi || "-"}</p>
        <p><b>Vergi No:</b> ${vergiNo || "-"}</p>
        <p><b>Telefon:</b> ${telefon || "-"}</p>
        <p style="margin-top:20px;">
          <a href="https://seninsite.com/admin/saticilar" target="_blank" 
             style="display:inline-block;padding:10px 16px;background:#1648b0;
             color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
             Başvuruyu Görüntüle
          </a>
        </p>
      </div>
    `;

    const msg: MailDataRequired = {
      to,
      from: SENDGRID_FROM,
      subject,
      ...(text ? { text } : { text: "Yeni satıcı başvurusu var." }),
      html: htmlContent,
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
