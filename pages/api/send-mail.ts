// pages/api/send-mail.ts
import type { NextApiRequest, NextApiResponse } from "next";
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Only POST");

  const { to, subject, text, html } = req.body;
  if (!to || !subject || !text) {
    return res.status(400).json({ error: "Eksik parametre" });
  }

  try {
    await sgMail.send({
      to,
      from: {
        email: "aldinaldininfo@gmail.com", // Buraya SendGrid'de onayladığın mail!
        name: "Aldın Aldın",
      },
      subject,
      text,
      html,
    });
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Mail gönderilemedi" });
  }
}
