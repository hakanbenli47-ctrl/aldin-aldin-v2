// /pages/api/paytr/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabase } from "../../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { merchant_oid, status, total_amount, hash } = req.body || {};

  if (!merchant_oid || !status || !total_amount || !hash) {
    console.error("Eksik callback parametreleri:", req.body);
    return res.status(400).send("Eksik parametre");
  }

  const merchant_key = process.env.PAYTR_MERCHANT_KEY!;
  const merchant_salt = process.env.PAYTR_MERCHANT_SALT!;

  // 🔹 Hash doğrulama
  const hashStr = `${merchant_oid}${merchant_salt}${status}${total_amount}`;
  const myHash = crypto.createHmac("sha256", merchant_key).update(hashStr).digest("base64");

  if (hash !== myHash) {
    console.error("Hash mismatch:", { received: hash, expected: myHash });
    return res.status(400).send("PAYTR notification failed: hash mismatch");
  }

  try {
    if (status === "success") {
      // ✅ siparişi bul
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id,user_id,meta")
        .eq("merchant_oid", merchant_oid) // ⚡ merchant_oid ile eşleştir
        .single();

      if (orderErr || !order) {
        console.error("Order bulunamadı:", merchant_oid, orderErr);
      } else {
        // ✅ siparişi ödenmiş yap
        const { error: updateErr } = await supabase
          .from("orders")
          .update({ status: "odendi" })
          .eq("merchant_oid", merchant_oid);
        if (updateErr) console.error("Order update error:", updateErr);

        // ✅ doping kontrolü
        if (order.meta?.dopingIlanId) {
          const { error: dopingErr } = await supabase
            .from("ilan")
            .update({
              doped: true,
              doped_expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("id", order.meta.dopingIlanId);
          if (dopingErr) console.error("Doping update error:", dopingErr);
        }

        // ✅ kupon kaydı
        if (order.meta?.coupon) {
          const coupon = order.meta.coupon;
          const { error: couponErr } = await supabase.from("coupon_redemptions").insert([
            {
              user_id: order.user_id,
              code: coupon.code,
              percent: coupon.percent,
              discount_amount: coupon.discountAmount,
              created_at: new Date().toISOString(),
            },
          ]);
          if (couponErr) console.error("Coupon insert error:", couponErr);
        }

        // ✅ sözleşme logları
        if (order.meta?.agreements) {
          const ua = order.meta?.userAgent || "";
          const versionMap: Record<string, string> = {
            mesafeli: "v3",
            teslimat: "v2",
            gizlilik: "v2",
          };

          const rows: any[] = [];
          if (order.meta.agreements.mesafeli) {
            rows.push({
              user_id: order.user_id,
              agreement_key: "mesafeli",
              agreed: true,
              version: versionMap.mesafeli,
              user_agent: ua,
            });
          }
          if (order.meta.agreements.teslimat) {
            rows.push({
              user_id: order.user_id,
              agreement_key: "teslimat",
              agreed: true,
              version: versionMap.teslimat,
              user_agent: ua,
            });
          }
          if (order.meta.agreements.gizlilik) {
            rows.push({
              user_id: order.user_id,
              agreement_key: "gizlilik",
              agreed: true,
              version: versionMap.gizlilik,
              user_agent: ua,
            });
          }

          if (rows.length) {
            const { error: logErr } = await supabase.from("user_agreement_logs").insert(rows);
            if (logErr) console.error("Agreement log insert error:", logErr);
          }
        }

        // ✅ Mail gönderimi
        try {
          const urunBaslik =
            order.meta?.basketItems?.length > 1
              ? `${order.meta.basketItems[0].name} +${order.meta.basketItems.length - 1} ürün`
              : order.meta?.basketItems?.[0]?.name || "Ürün";

          // müşteri mail
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-mail`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: order.meta?.email,
              subject: `Siparişiniz Alındı! (#${merchant_oid})`,
              html: `<h2>Siparişiniz Alındı!</h2>
                     <p><b>Ürün:</b> ${urunBaslik}</p>
                     <p><b>Tutar:</b> ${(total_amount / 100).toLocaleString("tr-TR")} ₺</p>
                     <p><b>Sipariş No:</b> #${merchant_oid}</p>`,
            }),
          });

          // satıcı mail (meta içine kaydetmen lazım: saticiMail)
          if (order.meta?.saticiMail) {
            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-mail`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: order.meta.saticiMail,
                subject: `Yeni Sipariş Geldi! (#${merchant_oid})`,
                html: `<h2>Yeni Sipariş Geldi!</h2>
                       <p><b>Ürün:</b> ${urunBaslik}</p>
                       <p><b>Tutar:</b> ${(total_amount / 100).toLocaleString("tr-TR")} ₺</p>
                       <p><b>Sipariş No:</b> #${merchant_oid}</p>`,
              }),
            });
          }
        } catch (mailErr) {
          console.error("Mail gönderilemedi:", mailErr);
        }
      }
    } else {
      // ödeme başarısız → siparişi iptal et
      const { error: cancelErr } = await supabase
        .from("orders")
        .update({ status: "iptal" })
        .eq("merchant_oid", merchant_oid);
      if (cancelErr) console.error("Order cancel error:", cancelErr);
    }
  } catch (err) {
    console.error("callback error:", err);
  }

  // ✅ PayTR'e mutlaka 200 OK dönmek gerekiyor
  res.status(200).send("OK");
}
