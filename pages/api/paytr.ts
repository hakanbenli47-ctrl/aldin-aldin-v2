// /pages/api/paytr.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabase } from "../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { amount, user_id, email, address, paytrBasket, meta } = req.body;

    if (!amount || !user_id || !email) {
      return res.status(400).json({ success: false, message: "Eksik parametre" });
    }

    // 🔹 Siparişi Supabase'e kaydet
    const { data: newOrder, error: insertError } = await supabase
      .from("orders")
      .insert([
        {
          user_id,
          total_price: amount,
          status: "beklemede",
          created_at: new Date().toISOString(),
          custom_address: address,
          meta,
        },
      ])
      .select()
      .single();

    if (insertError || !newOrder) {
      console.error("Supabase insert error:", insertError);
      return res.status(500).json({ success: false, message: "Sipariş kaydedilemedi" });
    }

    // 🔹 Basket format fix → fiyatlar string
    const basketFixed = (paytrBasket || []).map((it: any) => [
      String(it[0]),
      Number(it[1]).toFixed(2), // fiyat string olacak
      Number(it[2]) || 1,
    ]);

    const user_basket = Buffer.from(JSON.stringify(basketFixed)).toString("base64");

    const merchant_id = process.env.PAYTR_MERCHANT_ID!;
    const merchant_key = process.env.PAYTR_MERCHANT_KEY!;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT!;

    const user_ip =
      req.headers["x-forwarded-for"]?.toString() ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    const merchant_oid = String(newOrder.id);

    const params: Record<string, any> = {
      merchant_id,
      user_ip,
      merchant_oid,
      email,
      payment_amount: amount * 100, // kuruş
      currency: "TL",
      test_mode: "0",
      no_installment: 1,
      max_installment: 1,
      user_name: email,
      user_address: address?.address || "Adres",
      user_phone: address?.phone || "05555555555",
      merchant_ok_url: process.env.PAYTR_SUCCESS_URL!,
      merchant_fail_url: process.env.PAYTR_FAIL_URL!,
      timeout_limit: "30",
      debug_on: 1,
      lang: "tr",
      user_basket,
    };

    // 🔹 imza
    const hash_str = `${merchant_id}${user_ip}${merchant_oid}${email}${params.payment_amount}${params.merchant_ok_url}${params.merchant_fail_url}${merchant_salt}`;
    const paytr_token = crypto
      .createHmac("sha256", merchant_key)
      .update(hash_str)
      .digest("base64");

    params.paytr_token = paytr_token;

    // 🔎 DEBUG LOG
    console.log("🔑 ENV:", { merchant_id, merchant_key, merchant_salt });
    console.log("📦 Basket:", basketFixed);
    console.log("📄 HASH_STR:", hash_str);
    console.log("🔒 TOKEN:", paytr_token);

    // 🔹 PayTR API
    const response = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });

    const data = await response.json();

    if (data.status !== "success") {
      console.error("PayTR hata:", data);
      return res.status(400).json({
        success: false,
        message: data.reason || "PayTR token alınamadı",
      });
    }

    return res.status(200).json({
      success: true,
      token: data.token,
      merchant_oid,
    });
  } catch (e: any) {
    console.error("paytr api error:", e);
    return res.status(500).json({ success: false, message: e.message || "Sunucu hatası" });
  }
}
