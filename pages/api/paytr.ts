import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabase } from "../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { amount, user_id, email, address, paytrBasket, cart_items, meta } = req.body;

    if (!amount || !user_id || !email) {
      return res.status(400).json({ success: false, message: "Eksik parametre" });
    }

    // 🔹 1) Siparişi Supabase'e kaydet
    const { data: newOrder, error } = await supabase
      .from("orders")
      .insert([
        {
          user_id,
          cart_items,
          total_price: amount,
          address_id: address?.id || null,
          status: "beklemede",
          meta,
        },
      ])
      .select()
      .single();

    if (error || !newOrder) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ success: false, message: "Sipariş kaydedilemedi" });
    }

    const merchant_oid = String(newOrder.id);

    // 🔹 2) Sepeti base64 encode
    const basket = Buffer.from(JSON.stringify(paytrBasket)).toString("base64");

    const merchant_id = process.env.PAYTR_MERCHANT_ID!;
    const merchant_key = process.env.PAYTR_MERCHANT_KEY!;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT!;

    const user_ip =
      req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "127.0.0.1";

    const params: Record<string, any> = {
      merchant_id,
      user_ip,
      merchant_oid,
      email,
      payment_amount: amount * 100, // kuruş
      currency: "TL",
      test_mode: "0", // ✅ CANLI mod
      no_installment: 1,
      max_installment: 1,
      user_name: email,
      user_address: address?.address || "Adres",
      user_phone: address?.phone || "05555555555",
      merchant_ok_url: process.env.PAYTR_SUCCESS_URL!,
      merchant_fail_url: process.env.PAYTR_FAIL_URL!,
      timeout_limit: "30",
      debug_on: 0, // canlıda debug kapalı
      lang: "tr",
      basket,
    };

    // 🔹 3) imza
    const hash_str = `${merchant_id}${user_ip}${merchant_oid}${email}${params.payment_amount}${params.merchant_ok_url}${params.merchant_fail_url}${merchant_salt}`;
    const token = crypto.createHmac("sha256", merchant_key).update(hash_str).digest("base64");
    params.paytr_token = token;

    // 🔹 4) PayTR API çağrısı
    const response = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });

    const data = await response.json();

    if (data.status !== "success") {
      return res
        .status(400)
        .json({ success: false, message: data.reason || "PayTR token alınamadı" });
    }

    return res.status(200).json({ success: true, token: data.token, order_id: newOrder.id });
  } catch (e: any) {
    console.error("paytr api error:", e);
    return res.status(500).json({ success: false, message: e.message });
  }
}
