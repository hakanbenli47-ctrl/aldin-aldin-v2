// /pages/api/paytr.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabase } from "../../lib/supabaseClient";

function isIPv4(ip?: string | null) {
  return !!ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { amount, user_id, email, address, paytrBasket, basketItems, meta, client_ip } = req.body || {};

    if (!amount || !user_id || !email || !Array.isArray(paytrBasket) || paytrBasket.length === 0) {
      return res.status(400).json({ success: false, message: "Eksik parametre" });
    }

    // (Opsiyonel) sepet toplamı ile amount doğrulaması
    const basketSum = Number(
      paytrBasket.reduce(
        (acc: number, [_, priceStr, qty]: [string, string, number]) =>
          acc + Number(priceStr) * Number(qty),
        0
      ).toFixed(2)
    );
    const amountNum = Number(Number(amount).toFixed(2));
    if (Math.abs(basketSum - amountNum) > 0.01) {
      return res.status(400).json({ success: false, message: "Tutar uyuşmazlığı" });
    }

    // 1) Siparişi beklemede kaydet
    const { data: newOrder, error: insertError } = await supabase
      .from("orders")
      .insert([{
        user_id,
        total_price: amountNum,
        status: "beklemede",
        created_at: new Date().toISOString(),
        custom_address: address,
        meta,
        cart_items: basketItems || [], // ✅ ekledik
      }])
      .select()
      .single();

    if (insertError || !newOrder) {
      console.error("❌ Supabase insert error:", insertError);
      return res.status(500).json({ success: false, message: "Sipariş kaydedilemedi" });
    }

    // 2) ENV anahtarları
    const merchant_id   = String(process.env.PAYTR_MERCHANT_ID || "");
    const merchant_key  = String(process.env.PAYTR_MERCHANT_KEY || "");
    const merchant_salt = String(process.env.PAYTR_MERCHANT_SALT || "");
    const ok_url        = String(process.env.PAYTR_SUCCESS_URL || "");
    const fail_url      = String(process.env.PAYTR_FAIL_URL || "");

    if (!merchant_id || !merchant_key || !merchant_salt || !ok_url || !fail_url) {
      return res.status(500).json({ success: false, message: "PAYTR env değişkenleri eksik" });
    }

    // 3) IP (mümkünse public IPv4)
    const xfwd = (req.headers["x-forwarded-for"] as string) || "";
    let user_ip =
      (isIPv4(client_ip) && client_ip) ||
      (xfwd ? xfwd.split(",")[0].trim() : "") ||
      (typeof req.socket?.remoteAddress === "string" ? req.socket.remoteAddress : "") ||
      "127.0.0.1";
    if (!isIPv4(user_ip)) user_ip = "127.0.0.1"; // dev'de ::1 ise düşür

    // 4) iFrame parametreleri (hepsi string)
    const merchant_oid   = String(newOrder.id);
    const payment_amount = String(Math.round(amountNum * 100)); // kuruş
    const user_basket    = Buffer.from(JSON.stringify(paytrBasket), "utf8").toString("base64");
    const no_installment  = "1";
    const max_installment = "1";
    const currency        = "TL";
    const test_mode       = "0"; // canlıda "0"

    // 5) iFrame HASH SIRASI
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

    // 6) POST edilecek form
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
      timeout_limit: "30",
      debug_on: "1",
      lang: "tr",
      user_name:
        String(
          address?.fullName ||
          [address?.first_name, address?.last_name].filter(Boolean).join(" ") ||
          email
        ),
      user_address: String(address?.address || "Adres girilmedi"),
      user_phone:   String(address?.phone || "05555555555"),
      paytr_token,
    };

    // Debug
    console.log("📦 PayTR POST:", {
      ...form,
      user_basket_decoded: Buffer.from(user_basket, "base64").toString("utf8"),
      merchant_key: "HIDDEN",
      merchant_salt: "HIDDEN",
      _hash_str: hash_str,
    });

    // 7) Token iste
    const resp = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });

    const data = await resp.json().catch(async () => ({ status: "failed", reason: await resp.text() }));

    if (data.status !== "success") {
      console.error("❌ PayTR response error:", data);
      return res.status(400).json({ success: false, message: data.reason || "PayTR token alınamadı" });
    }

    return res.status(200).json({ success: true, token: data.token, merchant_oid });
  } catch (e: any) {
    console.error("❌ paytr api error:", e);
    return res.status(500).json({ success: false, message: e.message || "Sunucu hatası" });
  }
}
