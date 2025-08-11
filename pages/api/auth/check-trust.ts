// pages/api/auth/check-trust.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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

    const email = req.method === "POST" ? (req.body as any)?.email : (req.query?.email as string | undefined);
    if (!email) return res.status(400).json({ trusted: false, reason: "email gerekli" });

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ trusted: false, reason: "Supabase env eksik" });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const ip = getClientIp(req);
    if (!ip) return res.status(200).json({ trusted: false, reason: "ip yok" });

    const ip_hash = hashIp(email, ip);

    const { data, error } = await supabase
      .from("login_trusted_ips")
      .select("id, last_seen")
      .eq("email", email)
      .eq("ip_hash", ip_hash)
      .maybeSingle();

    if (error) return res.status(500).json({ trusted: false, reason: "sorgu hatası" });

    // (Opsiyonel) 90 gün kuralı
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const trusted = !!data && (Date.now() - new Date(data.last_seen!).getTime() < ninetyDays);

    return res.status(200).json({ trusted });
  } catch (e: any) {
    console.error("[check-trust] error:", e);
    return res.status(500).json({ trusted: false, reason: "sunucu hatası" });
  }
}
