import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const code =
      method === "POST"
        ? (req.body as any)?.code
        : (req.query?.code as string | undefined);

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

    if (error) {
      console.error("[verify-otp] query error:", error);
      return res.status(500).send("Sorgu hatası");
    }
    if (!data) return res.status(400).send("Geçersiz kod");
    if (data.consumed) return res.status(400).send("Kod zaten kullanılmış");
    if (new Date(data.expires_at).getTime() < Date.now()) {
      return res.status(400).send("Kodun süresi dolmuş");
    }

    const { error: upErr } = await supabase
      .from("login_otps")
      .update({ consumed: true })
      .eq("id", data.id);
    if (upErr) {
      console.error("[verify-otp] update error:", upErr);
      return res.status(500).send("Kod güncellenemedi");
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[verify-otp] error:", e);
    return res.status(500).send("Sunucu hatası");
  }
}
