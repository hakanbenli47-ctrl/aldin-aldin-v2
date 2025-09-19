// /pages/api/paytr/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabase } from "../../../lib/supabaseClient";

export const config = { api: { bodyParser: false } };

type PaytrPost = {
  merchant_oid: string;
  status: "success" | "failed";
  total_amount: string; // kuruş
  hash: string;
  [k: string]: any;
};

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
/** base64(HMAC_SHA256(merchant_oid + merchant_salt + status + total_amount, merchant_key)) */
function verifyPaytrHash(post: PaytrPost): boolean {
  const merchant_key = process.env.PAYTR_MERCHANT_KEY ?? process.env.PAYTR_KEY ?? "";
  const merchant_salt = process.env.PAYTR_MERCHANT_SALT ?? process.env.PAYTR_SALT ?? "";
  if (!merchant_key || !merchant_salt) {
    console.error("❌ PAYTR hash verify: missing key/salt envs");
    return false;
  }
  const raw = String(post.merchant_oid || "") + merchant_salt + String(post.status || "") + String(post.total_amount || "");
  const token = crypto.createHmac("sha256", merchant_key).update(raw).digest("base64");
  return token === post.hash;
}

// İsteğe bağlı: email helper (alıcı ve/veya satıcıya)
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  try {
    // 1) Body + hash
    const raw = await readRawBody(req);
    const post = parseForm(raw) as unknown as PaytrPost;

    if (!verifyPaytrHash(post)) {
      console.error("❌ PAYTR callback bad hash", post);
      return res.status(200).send("PAYTR notification failed: bad hash");
    }

    const { merchant_oid, status, total_amount } = post;
    if (!merchant_oid) return res.status(200).send("OK");

    // 2) Order’ı çek
    const { data: orderRow, error: orderErr } = await supabase
      .from("orders")
      .select("id, user_id, email, custom_address, cart_items, status")
      .eq("id", merchant_oid)
      .maybeSingle();

    if (orderErr || !orderRow) {
      console.error("order fetch err:", orderErr);
      return res.status(200).send("OK");
    }

    // 3) Zaten finalize ise idempotent dönüş
    if (["Ödendi", "Ödeme Başarısız", "odeme_onaylandi", "odeme_basarisiz"].includes(orderRow.status)) {
      return res.status(200).send("OK");
    }

    // 4) Alıcı snapshot
    const addr = safeJSON<AddressFields>(orderRow.custom_address, {} as AddressFields);
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

    const payedTL = Number(total_amount || 0) / 100;

    // 5) Order’ı finalize et
    const yenistat = status === "success" ? "Ödendi" : "Ödeme Başarısız";
    const { data: orderData, error: updErr } = await supabase
      .from("orders")
      .update({
        status: yenistat,
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

    if (updErr || !orderData) {
      console.error("order update err:", updErr);
      return res.status(200).send("OK");
    }

    // Başarısız ödemede seller_orders açmayız
    if (yenistat !== "Ödendi") return res.status(200).send("OK");

    // 6) Ürünleri toparla
    const urunlerRaw = safeJSON<any[]>(orderRow.cart_items, []);
    const urunler = Array.isArray(urunlerRaw) ? urunlerRaw : [];

    // 6.a) Satıcı belirleme (üründe yoksa ilan tablosundan fallback)
    // - Giriş: item.id veya item.product_id → ilan.id olarak varsayıyoruz.
    // - Çıkış: seller_id, seller_email
    type Enriched = any & { seller_id?: string; seller_email?: string };
    const enriched: Enriched[] = [];
    const toLookup: number[] = [];

    for (const it of urunler) {
      const sellerId =
        it.seller_id ?? it.satici_id ?? it.firma_id ?? it.satici_firma_id ?? undefined;
      const sellerEmail = it.seller_email ?? it.email ?? undefined;

      const pid = Number(it.product_id ?? it.id ?? NaN);
      if (!sellerId && Number.isFinite(pid)) {
        // ilan user_id/email lazım → lookup listesine ekle
        (it as any).__pid = pid;
        toLookup.push(pid);
      } else {
        enriched.push({ ...it, seller_id: sellerId, seller_email: sellerEmail });
      }
    }

    if (toLookup.length) {
      const uniqueIds = Array.from(new Set(toLookup));
      const { data: ilanRows, error: ilanErr } = await supabase
        .from("ilan")
        .select("id, user_id, user_email")
        .in("id", uniqueIds);

      if (ilanErr) console.warn("ilan lookup err:", ilanErr);

      const map = new Map<number, { user_id: string; user_email?: string | null }>();
      (ilanRows || []).forEach((r: any) => map.set(Number(r.id), { user_id: r.user_id, user_email: r.user_email }));

      for (const it of urunler) {
        if (!(it as any).__pid) continue;
        const pid = Number((it as any).__pid);
        const rec = map.get(pid);
        enriched.push({
          ...it,
          seller_id: rec?.user_id,
          seller_email: rec?.user_email ?? it.seller_email,
        });
      }
    }

    // Son güvenlik: seller_id olmayanları atla
    const finalItems: Enriched[] = enriched.filter((it) => !!it.seller_id);

    // ---- TIP DÜZELTME: FeatureItem + Group tanımları ----
    type FeatureItem = {
      product_id: any;
      title: any;
      image: any;
      quantity: number;
      unit_price: number;
      line_total: number;
      ozellikler: any;
    };
    type Group = {
      seller_id: string;
      seller_email?: string;
      features: FeatureItem[];
      lineTotal: number;
    };

    // 7) Satıcıya göre grupla → tek kayıtta tüm kalemler
    const groups = new Map<string, Group>();

    for (const it of finalItems) {
      const qty = Number(it.quantity ?? it.adet ?? 1);
      const unit = Number(it.unitPrice ?? it.price ?? 0);
      const lt = qty * unit;

      const existing = groups.get(it.seller_id!);
      const g: Group =
        existing ??
        {
          seller_id: it.seller_id!,
          seller_email: it.seller_email,
          features: [] as FeatureItem[], // <<< burada tip sabit
          lineTotal: 0,
        };

      g.features.push({
        product_id: it.id ?? it.product_id ?? null,
        title: it.name ?? it.title ?? "Ürün",
        image: it.image ?? it.resim_url ?? it.images?.[0] ?? null,
        quantity: qty,
        unit_price: unit,
        line_total: Number(lt.toFixed(2)),
        ozellikler: it.ozellikler ?? it.selection ?? null,
      });
      g.lineTotal += lt;
      groups.set(it.seller_id!, g);
    }

    // 8) Idempotency: bu order için zaten yazılmış seller_orders var mı?
    const sellerIds = Array.from(groups.keys());
    if (sellerIds.length) {
      const { data: existing } = await supabase
        .from("seller_orders")
        .select("seller_id")
        .eq("order_id", orderData.id)
        .in("seller_id", sellerIds);

      const already = new Set((existing || []).map((r: any) => String(r.seller_id)));
      const toInsert: any[] = [];

      for (const sid of sellerIds) {
        if (already.has(String(sid))) continue;
        const g = groups.get(sid)!;
        toInsert.push({
          order_id: orderData.id,
          seller_id: sid,
          buyer_id: orderRow.user_id,
          total_price: Number(g.lineTotal.toFixed(2)),
          status: "ödendi",
          first_name: fn,
          last_name: ln,
          phone,
          city,
          address,
          email, // alıcı maili
          custom_features: g.features, // FeatureItem[]
          created_at: new Date().toISOString(),
        });
      }

      if (toInsert.length) {
        // Supabase tip üreticiniz varsa, burada da tip esnetmek isterseniz: as any
        const { error: insErr } = await supabase.from("seller_orders").insert(toInsert as any[]);
        if (insErr) console.error("seller_orders insert err:", insErr);
      }
    }

    // 9) Mail (alıcıya — satıcıya istiyorsan g.seller_email ile ayrı da atabiliriz)
    if (email) {
      await sendOrderEmails({
        aliciMail: email,
        siparis: orderData,
        urunler: finalItems,
      });
    }

    // 10) Sepeti temizle (bu projede cart kaldırılacak olsa da problem olmaz)
    try {
      await supabase.from("cart").delete().eq("user_id", orderRow.user_id);
    } catch {}

    return res.status(200).send("OK");
  } catch (e) {
    console.error("❌ PAYTR callback exception:", e);
    return res.status(200).send("OK");
  }
}
