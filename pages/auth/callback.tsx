import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();
  const [msg, setMsg] = useState("Doğrulanıyor...");

  useEffect(() => {
    if (!router.isReady) return;

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const accessToken = url.hash.match(/access_token=([^&]+)/)?.[1];
        const refreshToken = url.hash.match(/refresh_token=([^&]+)/)?.[1];

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
       
          setMsg("Giriş başarılı, yönlendiriliyorsunuz...");
          router.replace("/index2");
          return;
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          localStorage.setItem("trustedDevice", "true");
          setMsg("Giriş başarılı, yönlendiriliyorsunuz...");
          router.replace("/index2");
          return;
        }

        setMsg("Yönlendiriliyor...");
        router.replace("/giris");
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message || "Bir hata oluştu.");
      }
    };

    run();
  }, [router.isReady, router]);

  return (
    <p style={{ padding: 40, textAlign: "center", fontFamily: "system-ui" }}>
      {msg}
    </p>
  );
}
