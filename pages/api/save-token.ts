// /pages/api/save-token.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 🚨 Burada service role key kullan
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { token, user_id } = req.body;
  if (!token) return res.status(400).json({ error: "Token eksik" });

  const { error } = await supabase
    .from("notification_tokens")
    .insert([{ token, user_id }]);

  if (error) {
    console.error("Token kaydedilemedi:", error);
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json({ success: true });
}
