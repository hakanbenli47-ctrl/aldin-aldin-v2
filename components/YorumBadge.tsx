import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function YorumBadge({ user }: { user: any }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function fetchUnread() {
      if (!user?.email) return;

      // satıcının ilanlarını bul
      const { data: ilanlar } = await supabase
        .from("ilan")
        .select("id")
        .eq("user_email", user.email);

      const ids = ilanlar?.map((i) => i.id) || [];
      if (ids.length === 0) {
        setUnreadCount(0);
        return;
      }

      // okunmamış yorumları say
      const { count } = await supabase
        .from("yorumlar")
        .select("*", { count: "exact", head: true })
        .in("urun_id", ids)
        .eq("okundu", false);

      setUnreadCount(count || 0);
    }
 
    fetchUnread();

    // belli aralıklarla yenile
    const interval = setInterval(fetchUnread, 20000);
    return () => clearInterval(interval);
  }, [user?.email]);

  if (unreadCount === 0) return null;

  return (
    <span
      style={{
        background: "#ef4444",
        color: "#fff",
        borderRadius: "50%",
        padding: "2px 6px",
        marginLeft: "6px",
        fontSize: "12px",
        fontWeight: "bold",
      }}
    >
      {unreadCount}
    </span>
  );
}
