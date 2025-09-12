// /pages/api/paytr/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabase } from "../../../lib/supabaseClient";

// PayTR form-urlencoded gönderir → Next'in JSON parserını kapat
export const config = {
  api: { bodyParser: false },
};

async function parseForm(req: NextApiRequest): Promise<Record<string, string>> {
  const chunks: any[] = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8"); // örn: key1=val1&key2=val2
  return Object.fromEntries(new URLSearchParams(raw));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const body = await parseForm(req);
  const { merchant_oid, status, total_amount, hash } = body;

  if (!merchant_oid || !status || !total_amount || !hash) {
    console.error("Eksik callback parametreleri:", body);
    return res.status(400).send("Eksik parametre");
  }

  // Hash doğrulama
  const merchant_key = process.env.PAYTR_MERCHANT_KEY!;
  const merchant_salt = process.env.PAYTR_MERCHANT_SALT!;
  const hashStr = merchant_oid + merchant_salt + status + total_amount;
  const myHash = crypto.createHmac("sha256", merchant_key).update(hashStr).digest("base64");

  if (hash !== myHash) {
    console.error("❌ Hash mismatch:", { received: hash, expected: myHash });
    return res.status(400).send("PAYTR notification failed: hash mismatch");
  }

  try {
    if (status === "success") {
      await supabase.from("orders").update({ status: "odendi" }).eq("id", merchant_oid);
      console.log("✅ Order başarıyla ödendi:", merchant_oid);
    } else {
      await supabase.from("orders").update({ status: "iptal" }).eq("id", merchant_oid);
      console.log("❌ Order iptal edildi:", merchant_oid);
    }
  } catch (err) {
    console.error("callback error:", err);
  }

  // PayTR aksi halde callback'i tekrarlar
  res.status(200).send("OK");
}
