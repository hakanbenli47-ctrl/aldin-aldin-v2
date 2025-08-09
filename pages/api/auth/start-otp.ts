import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // sadece server
);

if (!process.env.SENDGRID_API_KEY) {
  console.warn("[start-otp] SENDGRID_API_KEY yok");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
}

function hashCode(email: string, code: string) {
  const pepper = process.env.OTP_PEPPER || "pepper";
  return crypto.createHash("sha256").update(`${email}:${code}:${pepper}`).digest("hex");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS / preflight / health-check
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS" || req.method === "HEAD") {
      res.setHeader("Allow", "POST, OPTIONS, HEAD");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, HEAD");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).end();
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST, OPTIONS, HEAD");
      return res.status(405).send("Method Not Allowed");
    }

    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).send("email gerekli");

    // 30 sn rate limit
    const { data: last } = await supabase
      .from("login_otps")
      .select("created_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (last) {
      const lastTime = new Date(last.created_at).getTime();
      if (Date.now() - lastTime < 30_000) {
        return res.status(429).send("Çok sık deneme. Lütfen 30 sn bekleyin.");
      }
    }

    // 6 haneli OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const code_hash = hashCode(email, code);
    const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 dk

    const { error: insErr } = await supabase.from("login_otps").insert({
      email,
      code_hash,
      expires_at,
      consumed: false,
    });
    if (insErr) {
      console.error(insErr);
      return res.status(500).send("OTP yazılamadı");
    }

    await sgMail.send({
      to: email,
      from: process.env.SENDGRID_FROM!,
      subject: "Giriş Doğrulama Kodu",
      text: `Giriş doğrulama kodunuz: ${code}\nBu kod 5 dakika geçerlidir.`,
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[start-otp] error:", e?.response?.body || e);
    return res.status(500).send("Sunucu hatası");
  }
}
