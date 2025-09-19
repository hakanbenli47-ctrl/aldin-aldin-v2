// /pages/api/paytr.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabase } from "../../lib/supabaseClient";

/* ---------------- Basit bellek içi rate-limit ---------------- */
type Hit = { count: number; resetAt: number };
const ipHits = new Map<string, Hit>();
const WINDOW_MS = 30_000; // 30 sn
const MAX_HITS = 3;       // 30 sn içinde en fazla 3 istek

function hitOK(ip: string) {
  const now = Date.now();
  const rec = ipHits.get(ip);
  if (!rec || now > rec.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (rec.count < MAX_HITS) {
    rec.count++;
    return true;
  }
  return false;
}
/* -------------------------------------------------------------- */

function isIPv4(ip?: string | null) {
  return !!ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
}
function isPrivateIPv4(ip: string) {
  if (!isIPv4(ip)) return true;
  const [a, b] = ip.split(".").map(Number);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}
function firstIPv4FromCSV(s?: string | null) {
  if (!s) return null;
  for (const part of s.split(",").map(x => x.trim())) {
    const m = part.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    if (m && !isPrivateIPv4(m[0])) return m[0];
  }
  return null;
}
function extractIPv4(input?: string | null): string | null {
  if (!input) return null;
  const m = input.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
  return m ? m[0] : null;
}
function getClientIPv4(req: NextApiRequest, bodyClientIp?: string | null): string | null {
  const headers = req.headers;
  const cand: (string | null | undefined)[] = [
    headers["cf-connecting-ip"] as string,
    headers["x-real-ip"] as string,
    headers["x-client-ip"] as string,
    firstIPv4FromCSV(headers["x-forwarded-for"] as string),
    (() => {
      const f = headers["forwarded"] as string;
      if (!f) return null;
      const m = f.match(/for="?(\d{1,3}(?:\.\d{1,3}){3})"?/i);
      return m ? m[1] : null;
    })(),
    bodyClientIp,
    typeof req.socket?.remoteAddress === "string" ? extractIPv4(req.socket.remoteAddress) : null,
  ];
  for (const ip of cand) {
    if (ip && isIPv4(ip) && !isPrivateIPv4(ip)) return ip;
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    console.log("PAYTR BODY RAW:", req.body);

    let {
      amount,
      user_id,
      email,
      address,
      paytrBasket,
      basketItems,
      meta,
      client_ip,
      test_mode: testModeFromBody,
    } = req.body || {};

    if (typeof paytrBasket === "string") {
      try {
        const parsed = JSON.parse(paytrBasket);
        if (Array.isArray(parsed)) paytrBasket = parsed;
      } catch {}
    }

    // ---- TEST / CANLI MOD ----
    const FORCE_TEST_MODE: string = "1"; // test için "1" yapabilirsin
    const queryTest = req.query?.test === "1";
    const bodyTest = testModeFromBody === 1 || testModeFromBody === "1";
    const test_mode = (queryTest || bodyTest || FORCE_TEST_MODE === "1") ? "1" : "0";
    // --------------------------

    // Girdi doğrulama
    if (!amount || !user_id || !email || !Array.isArray(paytrBasket) || !paytrBasket.length) {
      console.error("❌ Eksik parametre:", { amount, user_id, email, paytrBasket });
      return res.status(400).json({ success: false, message: "Eksik parametre" });
    }

    // Gerçek public IPv4 bul
    let user_ip = getClientIPv4(req, client_ip);

    // Dev ortam fallback
    if (process.env.NODE_ENV !== "production" && !user_ip) {
      user_ip = "93.184.216.34"; // örnek public IP (example.com)
      console.log("⚠ Dev mode: user_ip fallback kullanıldı:", user_ip);
    }

    if (!user_ip) {
      return res.status(400).json({
        success: false,
        message: "İstemci public IPv4 bulunamadı. Frontend’den 'client_ip' gönderin (api.ipify.org).",
      });
    }

    // Basit rate-limit
    if (!hitOK(user_ip)) {
      return res.status(429).json({
        success: false,
        message: "Çok fazla deneme (IP). Lütfen 20-30 sn sonra tekrar deneyiniz.",
      });
    }

    // Sepet toplamı kontrolü
    const basketSum = paytrBasket.reduce(
      (acc: number, [_, priceStr, qty]: [string, string, number]) =>
        acc + parseFloat(priceStr) * qty,
      0
    );
    const amountNum = parseFloat(amount);
    if (Math.abs(basketSum - amountNum) > 0.5) {
      console.error("❌ Tutar uyuşmazlığı:", { basketSum, amountNum, paytrBasket });
      return res.status(400).json({ success: false, message: "Tutar uyuşmazlığı" });
    }

    // Siparişi beklemede kaydet
    const { data: newOrder, error: insertError } = await supabase
      .from("orders")
      .insert([
        {
          user_id,
          total_price: amountNum,
          status: "beklemede",
          created_at: new Date().toISOString(),
          custom_address: address,
          meta,
          cart_items: basketItems || [],
        },
      ])
      .select()
      .single();

    if (insertError || !newOrder) {
      console.error("❌ Supabase insert error:", insertError);
      return res.status(500).json({ success: false, message: "Sipariş kaydedilemedi" });
    }

    // ENV
    const merchant_id = String(process.env.PAYTR_MERCHANT_ID || "");
    const merchant_key = String(process.env.PAYTR_MERCHANT_KEY || "");
    const merchant_salt = String(process.env.PAYTR_MERCHANT_SALT || "");
    const ok_url = String(process.env.PAYTR_SUCCESS_URL || "");
    const fail_url = String(process.env.PAYTR_FAIL_URL || "");
    const site_url = String(process.env.NEXT_PUBLIC_SITE_URL || "");

    if (!merchant_id || !merchant_key || !merchant_salt || !ok_url || !fail_url || !site_url) {
      console.error("❌ PAYTR env eksik");
      return res.status(500).json({ success: false, message: "PAYTR env değişkenleri eksik" });
    }

    // PayTR parametreleri
    const merchant_oid = String(newOrder.id);
    const payment_amount = String(Math.round(amountNum * 100));
    const user_basket = Buffer.from(JSON.stringify(paytrBasket), "utf8").toString("base64");
    const no_installment = "1";
    const max_installment = "1";
    const currency = "TL";

    // Hash
    const hash_str =
      merchant_id +
      user_ip +
      merchant_oid +
      email +
      payment_amount +
      user_basket +
      no_installment +
      max_installment +
      currency +
      test_mode +
      merchant_salt;

    const paytr_token = crypto.createHmac("sha256", merchant_key).update(hash_str).digest("base64");

    const form: Record<string, string> = {
      merchant_id,
      user_ip,
      merchant_oid,
      email,
      payment_amount,
      user_basket,
      no_installment,
      max_installment,
      currency,
      test_mode,
      merchant_ok_url: ok_url,
      merchant_fail_url: fail_url,
      callback_url: site_url.replace(/\/+$/, "") + "/api/paytr/callback",
      timeout_limit: "60",
      debug_on: test_mode === "1" ? "1" : "0",
      lang: "tr",
      user_name:
        String(
          address?.fullName ||
            [address?.first_name, address?.last_name].filter(Boolean).join(" ")
        ) || email,
      user_address: String(address?.address || "Adres girilmedi"),
      user_phone: String(address?.phone || "05555555555"),
      paytr_token,
    };

    // PayTR'a istek
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json,text/plain,*/*",
      "User-Agent": process.env.PAYTR_USER_AGENT || "80bir/1.0 (+https://www.80bir.com.tr)",
      "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      Connection: "close",
    } as Record<string, string>;

    async function getTokenOnce() {
      const resp = await fetch("https://www.paytr.com/odeme/api/get-token", {
        method: "POST",
        headers,
        body: new URLSearchParams(form).toString(),
      });
      const raw = await resp.text();
      return { status: resp.status, ok: resp.ok, raw };
    }

    let r = await getTokenOnce();
    if (!r.ok && [429, 403, 503].includes(r.status)) {
      await sleep(1200 + Math.floor(Math.random() * 800));
      r = await getTokenOnce();
    }

    if (!r.ok) {
      console.error("❌ PayTR HTTP error:", r.status, r.raw?.slice(0, 500));
      return res.status(502).json({ success: false, message: `PayTR HTTP ${r.status}` });
    }

    let data: any = null;
    try {
      data = r.raw ? JSON.parse(r.raw) : null;
    } catch {
      console.error("❌ PayTR non-JSON response:", r.raw?.slice(0, 500));
      return res.status(502).json({ success: false, message: "PayTR beklenmeyen yanıt" });
    }

    if (!data || data.status !== "success" || !data.token) {
      console.error("❌ PayTR response error:", data);
      return res.status(400).json({ success: false, message: "PayTR token alınamadı" });
    }

    return res.status(200).json({ success: true, token: data.token, merchant_oid });
  } catch (e: any) {
    console.error("❌ paytr api error:", e);
    return res.status(500).json({ success: false, message: e?.message || "Sunucu hatası" });
  }
}
