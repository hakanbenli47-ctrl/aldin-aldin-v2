// /pages/api/save-token.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, user_id } = req.body;

  if (!token || !user_id) {
    return res.status(400).json({ error: "Eksik veri: token veya user_id yok" });
  }

  // Aynı kullanıcı için aynı token varsa tekrar ekleme
  const { data, error } = await supabase
    .from("notification_tokens")
    .upsert(
      { user_id, token, created_at: new Date().toISOString() },
      { onConflict: "user_id,token" } // duplicate engelle
    );

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, data });
}
