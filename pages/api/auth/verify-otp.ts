// pages/api/auth/verify-otp.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function hashCode(email: string, code: string) {
  const pepper = process.env.OTP_PEPPER || "pepper";
  return crypto.createHash("sha256").update(`${email}:${code}:${pepper}`).digest("hex");
}

function getClientIp(req: NextApiRequest) {
  const xff = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  const cf  = (req.headers["cf-connecting-ip"] as string | undefined)?.trim();
  const ra  = (req.socket as any)?.remoteAddress as string | undefined;
  return xff || cf || ra || "";
}

function hashIp(email: string, ip: string) {
  const pepper = process.env.IP_PEPPER || process.env.OTP_PEPPER || "pepper";
  return crypto.createHash("sha256").update(`${email}:${ip}:${pepper}`).digest("hex");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Allow", "POST, GET, OPTIONS, HEAD");
    if (req.method === "OPTIONS" || req.method === "HEAD") return res.status(204).end();
    if (req.method !== "POST" && req.method !== "GET") return res.status(405).send("Method Not Allowed");

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).send(`Supabase env eksik (url=${!!SUPABASE_URL}, key=${!!SERVICE_KEY})`);
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const email =
      req.method === "POST" ? (req.body as any)?.email : (req.query?.email as string | undefined);
    const code  =
      req.method === "POST" ? (req.body as any)?.code  : (req.query?.code  as string | undefined);

    if (!email || !code) return res.status(400).send("email ve code gerekli");

    const code_hash = hashCode(email, code);
    const { data, error } = await supabase
      .from("login_otps")
      .select("id, expires_at, consumed")
      .eq("email", email)
      .eq("code_hash", code_hash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return res.status(500).send("Sorgu hatası");
    if (!data) return res.status(400).send("Geçersiz kod");
    if (data.consumed) return res.status(400).send("Kod zaten kullanılmış");
    if (new Date(data.expires_at as any).getTime() < Date.now()) return res.status(400).send("Kodun süresi dolmuş");

    const { error: upErr } = await supabase
      .from("login_otps")
      .update({ consumed: true })
      .eq("id", data.id);
    if (upErr) return res.status(500).send("Kod güncellenemedi");

    // ✅ OTP BAŞARILI → IP'yi güvenilir olarak kaydet / güncelle
    const ip = getClientIp(req);
    if (ip) {
      const ip_hash = hashIp(email, ip);
      await supabase
        .from("login_trusted_ips")
        .upsert(
          { email, ip_hash, user_agent: req.headers["user-agent"] as string | undefined, last_seen: new Date().toISOString() },
          { onConflict: "email,ip_hash" }
        );
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[verify-otp] error:", e);
    return res.status(500).send("Sunucu hatası");
  }
}
