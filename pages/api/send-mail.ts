// pages/api/send-mail.ts
import type { NextApiRequest, NextApiResponse } from "next";
import sgMail from "@sendgrid/mail";
import { createClient } from "@supabase/supabase-js";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY!;
const SENDGRID_FROM =
  process.env.SENDGRID_FROM || "Aldın Aldın <aldinaldininfo@gmail.com>";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// storage bucket adın
const INVOICE_BUCKET = "faturalar";

sgMail.setApiKey(SENDGRID_API_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

type Body = {
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  orderId?: number;
  invoicePath?: string;        // örn: "siparisler/123/fatura.pdf"
  invoiceFilename?: string;    // opsiyonel dosya adı
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Only POST");

  const { to, subject, text, html, orderId, invoicePath, invoiceFilename } =
    (req.body || {}) as Body;

  try {
    // 1) Alıcıyı bul
    let recipient = to;
    if (!recipient && orderId) {
      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .select("user_id")
        .eq("id", orderId)
        .single();
      if (orderErr) throw orderErr;

      if (order?.user_id) {
        const { data: userRes, error: authErr } =
          await supabaseAdmin.auth.admin.getUserById(order.user_id);
        if (!authErr && userRes?.user?.email) {
          recipient = userRes.user.email;
        } else {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .eq("id", order.user_id)
            .single();
          if (profile?.email) recipient = profile.email;
        }
      }
    }

    if (!recipient) return res.status(400).json({ error: "to veya orderId gerekli" });
    if (!subject) return res.status(400).json({ error: "subject gerekli" });
    if (!text && !html) return res.status(400).json({ error: "text veya html gerekli" });

    // 2) Fatura varsa Storage'tan indir -> ek yap
    let attachments: any[] | undefined;
    let signedUrl: string | undefined;

    if (invoicePath) {
      // Dosyayı indir
      const { data: fileBlob, error: dErr } = await supabaseAdmin
        .storage.from(INVOICE_BUCKET)
        .download(invoicePath);
      if (dErr) throw dErr;

      const ab = await fileBlob.arrayBuffer();
      const base64 = Buffer.from(ab).toString("base64");

      const filename =
        invoiceFilename || invoicePath.split("/").pop() || `fatura-${orderId || ""}.pdf`;

      attachments = [
        {
          content: base64,
          filename,
          type: "application/pdf",
          disposition: "attachment",
        },
      ];

      // (opsiyonel) imzalı link üret – maile de ekleyelim
      const { data: signed } = await supabaseAdmin
        .storage.from(INVOICE_BUCKET)
        .createSignedUrl(invoicePath, 60 * 60 * 24 * 7); // 7 gün
      signedUrl = signed?.signedUrl;
    }

    // 3) Gönder
    await sgMail.send({
      to: recipient,
      from: SENDGRID_FROM,
      subject,
      text: text ?? undefined,
      html:
        (html ?? text!) +
        (signedUrl
          ? `<p><a href="${signedUrl}" target="_blank" rel="noopener noreferrer">Faturayı indir (link)</a></p>`
          : ""),
      attachments,
    });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("send-mail error:", err);
    return res.status(500).json({ error: err?.message || "Mail gönderilemedi" });
  }
}
