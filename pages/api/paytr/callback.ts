// /pages/api/paytr/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabase } from "../../../lib/supabaseClient";

/** Alıcı & satıcıya özet e-posta gönderimi */
async function sendOrderEmails({
  aliciMail,
  saticiMail,
  siparis,
  urunler,
}: {
  aliciMail?: string;
  saticiMail?: string;
  siparis: any;
  urunler: any[];
}) {
  try {
    const urunListesi = (urunler || [])
      .map((u) => `${u.title} x${u.adet} - ${Number(u.price || 0)}₺`)
      .join("\n");

    // Alıcı
    if (aliciMail) {
      await fetch(process.env.NEXT_PUBLIC_SITE_URL + "/api/send-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: aliciMail,
          subject: `Siparişiniz Alındı (#${siparis.id})`,
          text:
            `Siparişiniz başarıyla oluşturuldu!\n\n` +
            `Sipariş No: ${siparis.id}\n` +
            `Toplam: ${siparis.total_price}₺\n` +
            `Adres: ${siparis?.custom_addre?.address || "-"}\n\n` +
            `Ürünler:\n${urunListesi}`,
        }),
      });
    }

    // Satıcı
    if (saticiMail) {
      await fetch(process.env.NEXT_PUBLIC_SITE_URL + "/api/send-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: saticiMail,
          subject: `Yeni Sipariş Geldi (#${siparis.id})`,
          text:
            `Yeni sipariş aldınız!\n\n` +
            `Sipariş No: ${siparis.id}\n` +
            `Toplam: ${siparis.total_price}₺\n` +
            `Alıcı: ${siparis?.custom_addre?.first_name || ""} ${siparis?.custom_addre?.last_name || ""}\n` +
            `Tel: ${siparis?.custom_addre?.phone || "-"}\n` +
            `Adres: ${siparis?.custom_addre?.address || "-"}\n\n` +
            `Ürünler:\n${urunListesi}`,
        }),
      });
    }
  } catch (e) {
    console.error("sendOrderEmails error:", e);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const { merchant_oid, status, total_amount, hash } = req.body || {};

  // PayTR hash doğrulaması
  const key = process.env.PAYTR_MERCHANT_KEY!;
  const salt = process.env.PAYTR_MERCHANT_SALT!;
  const checkStr = `${merchant_oid}${salt}${status}${total_amount}`;
  const myHash = crypto.createHmac("sha256", key).update(checkStr).digest("base64");

  if (hash !== myHash) {
    console.error("❌ Hash uyuşmadı:", { merchant_oid, hash, myHash });
    return res.status(400).send("Invalid hash");
  }

  try {
    if (status === "success") {
      // 1) Order'ı bul
      const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", merchant_oid)
        .single();

      if (error || !order) {
        console.error("Order not found:", merchant_oid, error);
        return res.status(404).send("Order not found");
      }

      // 2) Ödendi yap
      await supabase.from("orders").update({ status: "odendi" }).eq("id", order.id);

      // 3) cart_items parse
      let cartItems: any[] = [];
      try {
        cartItems =
          typeof order.cart_items === "string"
            ? JSON.parse(order.cart_items)
            : order.cart_items || [];
      } catch (e) {
        console.error("cart_items parse error:", e);
        cartItems = [];
      }

      // 4) Satıcıya göre grupla
      const gruplar = new Map<
        string,
        { sellerId: string; sellerEmail?: string; items: any[] }
      >();

      for (const it of cartItems) {
        const sellerId = it.seller_id || it.product?.user_id;
        const sellerEmail = it.seller_email || it.product?.user_email || "";
        if (!sellerId) continue;

        if (!gruplar.has(sellerId)) {
          gruplar.set(sellerId, { sellerId, sellerEmail, items: [] });
        }
        gruplar.get(sellerId)!.items.push(it);
      }

      // 5) Her satıcı için seller_orders’a yaz
      for (const [, grup] of gruplar) {
        const total = grup.items.reduce(
          (acc, it) => acc + (Number(it.price) || 0) * (it.adet || 1),
          0
        );

        const customFeatures = grup.items.map((i: any) => ({
          product_id: i.product_id || i.id || i.product?.id || null,
          title: i.title,
          adet: i.adet,
          ozellikler: i.ozellikler,
          fiyat: i.price,
        }));

        const { error: sellerError } = await supabase.from("seller_orders").insert([
          {
            seller_id: grup.sellerId,
            order_id: order.id,
            total_price: total,
            status: "beklemede",
            created_at: new Date().toISOString(),
            first_name: order?.custom_addre?.first_name || null,
            last_name: order?.custom_addre?.last_name || null,
            phone: order?.custom_addre?.phone || null,
            city: order?.custom_addre?.city || null,
            address: order?.custom_addre?.address || null,
            /** 👇 Satıcı panelinin beklediği alan adı */
            custom_features: customFeatures,
          },
        ]);

        if (sellerError) {
          console.error("seller_orders insert error:", sellerError);
        }

        // 6) Mail gönder (alıcı & satıcı)
        await sendOrderEmails({
          aliciMail: order.user_email || order?.meta?.email, // orders'ta email yoksa meta.email
          saticiMail: grup.sellerEmail,
          siparis: order,
          urunler: grup.items,
        });
      }

      // 7) Kupon redemption kaydı
      if (order?.meta?.coupon?.code) {
        await supabase.from("coupon_redemptions").insert([
          {
            user_id: order.user_id,
            code: order.meta.coupon.code,
            used_at: new Date().toISOString(),
            order_id: order.id,
          },
        ]);
      }

      // 8) Sözleşme logları
      if (order?.meta?.agreements) {
        const ua = order?.meta?.userAgent || "";
        const versionMap: Record<string, string> = {
          mesafeli: "v3",
          teslimat: "v2",
          gizlilik: "v2",
        };
        const logs: any[] = [];
        for (const [k, v] of Object.entries(order.meta.agreements)) {
          if (v) {
            logs.push({
              user_id: order.user_id,
              agreement_key: k,
              agreed: true,
              version: versionMap[k as keyof typeof versionMap],
              user_agent: ua,
            });
          }
        }
        if (logs.length) {
          await supabase.from("user_agreement_logs").insert(logs);
        }
      }
    } else {
      // Ödeme başarısız -> iptal
      await supabase.from("orders").update({ status: "iptal" }).eq("id", merchant_oid);
    }
  } catch (err) {
    console.error("callback error:", err);
    // PayTR beklemesin
  }

  return res.status(200).send("OK");
}
