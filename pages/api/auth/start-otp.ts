import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // sadece server
);

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn("[start-otp] SENDGRID_API_KEY yok");
}

function hashCode(email: string, code: string) {
  const pepper = process.env.OTP_PEPPER || "pepper";
  return crypto.createHash("sha256").update(`${email}:${code}:${pepper}`).digest("hex");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS / preflight / health-check
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Allow", "POST, GET, OPTIONS, HEAD");
    if (req.method === "OPTIONS" || req.method === "HEAD") {
      res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, HEAD");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).end();
    }

    // POST + (gerekirse) GET destekle
    const method = req.method;
    if (method !== "POST" && method !== "GET") {
      return res.status(405).send("Method Not Allowed");
    }

    const email =
      method === "POST"
        ? (req.body as any)?.email
        : (req.query?.email as string | undefined);

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
      console.error("[start-otp] insert error:", insErr);
      return res.status(500).send("OTP yazılamadı");
    }

    if (!process.env.SENDGRID_FROM) {
      console.warn("[start-otp] SENDGRID_FROM eksik");
      return res.status(500).send("Mail gönderim yapılandırması eksik");
    }

    await sgMail.send({
      to: email,
      from: process.env.SENDGRID_FROM,
      subject: "Giriş Doğrulama Kodu",
      text: `Giriş doğrulama kodunuz: ${code}\nBu kod 5 dakika geçerlidir.`,
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[start-otp] error:", e?.response?.body || e);
    return res.status(500).send("Sunucu hatası");
  }
}
