// /pages/api/paytr/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabase } from "../../../lib/supabaseClient";

/** PayTR form-urlencoded gönderir → bodyParser kapat */
export const config = { api: { bodyParser: false } };

type AddressFields = {
  fullName?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  address?: string;
  email?: string;
};

type PaytrPost = {
  merchant_oid: string;
  status: "success" | "failed";
  total_amount: string; // kuruş, ör: "3456"
  hash: string;
  [k: string]: any;
};

/* -------------------- helpers -------------------- */
async function readRawBody(req: NextApiRequest): Promise<string> {
  const bufs: Buffer[] = [];
  for await (const c of req) bufs.push(Buffer.from(c));
  return Buffer.concat(bufs).toString("utf8");
}
function parseForm(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const sp = new URLSearchParams(body);
  sp.forEach((v, k) => (out[k] = v));
  return out;
}
function safeJSON<T = any>(v: any, fallback: T): T {
  try {
    if (typeof v === "string") return JSON.parse(v);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}
function splitFullName(full?: string): { first: string | null; last: string | null } {
  if (!full) return { first: null, last: null };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: null };
  const last = parts.pop() || null;
  const first = parts.join(" ") || null;
  return { first, last };
}
function pick<T>(...cands: (T | null | undefined)[]): T | undefined {
  for (const c of cands) if (c !== null && c !== undefined && c !== "") return c as T;
  return undefined;
}
/** Resmî hash: base64(HMAC_SHA256(merchant_oid + merchant_salt + status + total_amount, merchant_key)) */
function verifyPaytrHash(post: PaytrPost): boolean {
  const merchant_key =
    process.env.PAYTR_MERCHANT_KEY ?? process.env.PAYTR_KEY ?? "";
  const merchant_salt =
    process.env.PAYTR_MERCHANT_SALT ?? process.env.PAYTR_SALT ?? "";
  if (!merchant_key || !merchant_salt) {
    console.error("❌ PAYTR hash verify: missing key/salt");
    return false;
  }
  const raw =
    String(post.merchant_oid || "") +
    merchant_salt +
    String(post.status || "") +
    String(post.total_amount || "");
  const token = crypto.createHmac("sha256", merchant_key).update(raw).digest("base64");
  return token === post.hash;
}

/** Basit mail helper */
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const list = urunler
    .map((u) => {
      const name = u.name ?? u.title ?? "Ürün";
      const qty = Number(u.quantity ?? u.adet ?? 1);
      const unit = Number(u.unitPrice ?? u.price ?? 0);
      return `${name} x${qty} - ${unit}₺`;
    })
    .join("\n");

  if (aliciMail) {
    await fetch(`${siteUrl}/api/send-mail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: aliciMail,
        subject: `Siparişiniz Alındı (#${siparis.id})`,
        text: `Siparişiniz başarıyla oluşturuldu!\n\n${list}`,
      }),
    });
  }
  if (saticiMail) {
    await fetch(`${siteUrl}/api/send-mail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: saticiMail,
        subject: `Yeni Sipariş Geldi (#${siparis.id})`,
        text: `Yeni sipariş aldınız!\n\n${list}`,
      }),
    });
  }
}
/* ------------------------------------------------- */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("📩 CALLBACK GELDİ! Method:", req.method);

  if (req.method !== "POST") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(405).send("Method Not Allowed");
  }

  try {
    // 1) Ham body
    const raw = await readRawBody(req);
    const post = parseForm(raw) as unknown as PaytrPost;
    console.log("📩 CALLBACK PARSED:", post);

    // 2) Hash verify
    if (!verifyPaytrHash(post)) {
      console.error("❌ PAYTR callback bad hash", post);
      return res.status(200).send("PAYTR notification failed: bad hash");
    }

    const { merchant_oid, status, total_amount } = post;
    if (!merchant_oid) {
      console.warn("⚠️ merchant_oid boş, OK dönüyorum.");
      return res.status(200).send("OK");
    }

    // 3) Order çek
    const { data: orderRow, error: orderFetchErr } = await supabase
      .from("orders")
      .select("id, user_id, email, custom_address, cart_items, status")
      .eq("id", merchant_oid)
      .single();

    if (orderFetchErr || !orderRow) {
      console.error("❌ Orders fetch error:", orderFetchErr);
      return res.status(200).send("OK");
    }

    // Eğer zaten finalize ise çık
    if (["Ödendi", "ödendi", "odeme_onaylandi", "odeme_basarisiz"].includes(orderRow.status)) {
      console.log("ℹ️ Order zaten finalize edilmiş, OK.");
      return res.status(200).send("OK");
    }

    // 4) Buyer snapshot
    const addr = safeJSON<AddressFields>(orderRow.custom_address, {});
    const fn = pick(addr.first_name, addr.firstName) ?? splitFullName(addr.fullName).first ?? "Müşteri";
    const ln = pick(addr.last_name, addr.lastName) ?? splitFullName(addr.fullName).last ?? "";
    const phone = pick(addr.phone) ?? "";
    const city = pick(addr.city) ?? "";
    const address = pick(addr.address) ?? "";
    let buyerEmail = pick(addr.email, orderRow.email);

    if (!buyerEmail) {
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("user_id", orderRow.user_id)
        .maybeSingle();
      buyerEmail = prof?.email;
    }
    const email = buyerEmail ?? "";

    // 5) Ürünler
    const urunlerRaw = safeJSON<any[]>(orderRow.cart_items, []);
    const urunler = Array.isArray(urunlerRaw) ? urunlerRaw : [];

    // 6) Orders update
    const payedTL = Number(total_amount || 0) / 100;
    const { data: orderData, error: orderErr } = await supabase
      .from("orders")
      .update({
        status: status === "success" ? "Ödendi" : "Ödeme Başarısız",
        total_price: payedTL,
        first_name: fn,
        last_name: ln,
        phone,
        city,
        address,
        email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", merchant_oid)
      .select()
      .single();

    if (orderErr || !orderData) {
      console.error("❌ Orders update error:", orderErr);
      return res.status(200).send("OK");
    }

    // 7) Başarısızsa çık
    if (status !== "success") {
      console.warn("⚠️ Ödeme başarısız, seller_orders yazılmadı.");
      return res.status(200).send("OK");
    }

    // 8) seller_orders
    for (const item of urunler) {
      const qty = Number(item.quantity ?? item.adet ?? 1);
      const unit = Number(item.unitPrice ?? item.price ?? 0);
      const lineTotal = qty * unit;

      const sellerId =
        item.seller_id ?? item.satici_id ?? item.firma_id ?? item.satici_firma_id ?? null;

      if (!sellerId) {
        console.error("❌ seller_id yok, atlandı:", item);
        continue;
      }

      const sellerRow = {
        order_id: orderData.id,
        seller_id: sellerId,
        buyer_id: orderRow.user_id,
        total_price: Number(lineTotal.toFixed(2)),
        status: "ödendi", // 🔹 artık ödendi
        first_name: fn,
        last_name: ln,
        phone,
        city,
        address,
        email,
        custom_features: [
          {
            product_id: item.id ?? item.product_id ?? null,
            title: item.name ?? item.title ?? "Ürün",
            image: item.image ?? item.resim_url ?? item.images?.[0] ?? null,
            quantity: qty,
            unit_price: unit,
            line_total: Number(lineTotal.toFixed(2)),
            ozellikler: item.ozellikler ?? item.selection ?? null,
          },
        ],
        created_at: new Date().toISOString(),
      };

      const { error: sErr } = await supabase.from("seller_orders").insert([sellerRow]);
      if (sErr) console.error("❌ seller_orders insert error:", sErr);
      else console.log("✅ seller_orders insert:", sellerRow);
    }

    // 9) Mails
    if (email) {
      await sendOrderEmails({
        aliciMail: email,
        siparis: orderData,
        urunler,
      });
    }

    // 🔟 Cart temizle
    const { error: cartDelErr } = await supabase
      .from("cart")
      .delete()
      .eq("user_id", orderRow.user_id);

    if (cartDelErr) {
      console.error("❌ Cart temizlenemedi:", cartDelErr);
    } else {
      console.log("🛒 Cart temizlendi:", orderRow.user_id);
    }

    // ✅ Son
    return res.status(200).send("OK");
  } catch (e) {
    console.error("❌ PAYTR callback exception:", e);
    return res.status(200).send("OK");
  }
}
