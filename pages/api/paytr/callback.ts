import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabase } from "../../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { merchant_oid, status, total_amount, hash } = req.body;

  const merchant_key = process.env.PAYTR_MERCHANT_KEY!;
  const merchant_salt = process.env.PAYTR_MERCHANT_SALT!;

  const hashStr = `${merchant_oid}${merchant_salt}${status}${total_amount}`;
  const myHash = crypto.createHmac("sha256", merchant_key).update(hashStr).digest("base64");

  if (hash !== myHash) {
    return res.status(400).send("PAYTR notification failed: hash mismatch");
  }

  try {
    if (status === "success") {
      // ✅ siparişi ödenmiş yap
      const { data: order } = await supabase
        .from("orders")
        .select("id,user_id,meta")
        .eq("id", merchant_oid)
        .single();

      if (!order) {
        console.error("Order bulunamadı:", merchant_oid);
      } else {
        await supabase.from("orders").update({ status: "odendi" }).eq("id", merchant_oid);

        // ✅ doping kontrolü
        if (order.meta?.dopingIlanId) {
          await supabase
            .from("ilan")
            .update({
              doped: true,
              doped_expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("id", order.meta.dopingIlanId);
        }

        // ✅ kupon kaydı
        if (order.meta?.coupon) {
          const coupon = order.meta.coupon;
          try {
            await supabase.from("coupon_redemptions").insert([
              {
                user_id: order.user_id,
                code: coupon.code,
                percent: coupon.percent,
                discount_amount: coupon.discountAmount,
                created_at: new Date().toISOString(),
              },
            ]);
          } catch (err) {
            console.error("coupon insert error:", err);
          }
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
            try {
              await supabase.from("user_agreement_logs").insert(rows);
            } catch (err) {
              console.error("agreement log insert error:", err);
            }
          }
        }
      }
    } else {
      // ödeme başarısız → siparişi iptal et
      await supabase.from("orders").update({ status: "iptal" }).eq("id", merchant_oid);
    }
  } catch (err) {
    console.error("callback error:", err);
  }

  res.status(200).send("OK");
}
