import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import crypto from "crypto";

function hashCode(email: string, code: string) {
  const pepper = process.env.OTP_PEPPER || "pepper";
  return crypto.createHash("sha256").update(`${email}:${code}:${pepper}`).digest("hex");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS / preflight
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Allow", "POST, GET, OPTIONS, HEAD");
    if (req.method === "OPTIONS" || req.method === "HEAD") {
      res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, HEAD");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).end();
    }
    // Method guard
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).send("Method Not Allowed");
    }

    // --- ENV KONTROLLERİ ---
    // SUPABASE_URL'i önce oku; yoksa NEXT_PUBLIC'tan al
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SG_KEY       = process.env.SENDGRID_API_KEY;
    const SG_FROM      = process.env.SENDGRID_FROM;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res
        .status(500)
        .send(`Supabase env eksik (url=${!!SUPABASE_URL}, key=${!!SERVICE_KEY})`);
    }
    if (!SG_KEY || !SG_FROM) {
      return res
        .status(500)
        .send(`SendGrid env eksik (key=${!!SG_KEY}, from=${!!SG_FROM})`);
    }

    // Client'ları handler içinde kur
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    sgMail.setApiKey(SG_KEY);

    const email =
      req.method === "POST"
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
      const lastTime = new Date(last.created_at as any).getTime();
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
      consumed: false, // created_at DB default now()
    });
    if (insErr) {
      console.error("[start-otp] insert error:", insErr);
      return res.status(500).send("OTP yazılamadı");
    }

    await sgMail.send({
      to: email,
      from: SG_FROM, // ör: no-reply@80bir.com.tr
      subject: "Giriş Doğrulama Kodu",
      text: `Giriş doğrulama kodunuz: ${code}\nBu kod 5 dakika geçerlidir.`,
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[start-otp] error:", e?.response?.body || e);
    return res.status(500).send("Sunucu hatası");
  }
}
