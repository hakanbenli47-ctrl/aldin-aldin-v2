// /pages/auth/callback.tsx
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

        // 1) OAuth / PKCE dönüşleri (code ile gelir)
        const code = url.searchParams.get("code");

        // 2) E-posta linkleri bazı durumlarda hash ile gelebilir
        const accessToken = url.hash.match(/access_token=([^&]+)/)?.[1];
        const refreshToken = url.hash.match(/refresh_token=([^&]+)/)?.[1];

        // 3) E-posta doğrulama/şifre sıfırlama linkleri (token_hash + type)
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type"); // signup | recovery | magiclink | email_change
        const email = url.searchParams.get("email") || "";

        if (code) {
          // Supabase v2: code takası
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setMsg("Giriş başarılı, yönlendiriliyorsunuz...");
          router.replace("/index2");
          return;
        }

        if (accessToken && refreshToken) {
          // Bazı magic link akışlarında #hash ile gelir
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          setMsg("Giriş başarılı, yönlendiriliyorsunuz...");
          router.replace("/index2");
          return;
        }

        if (tokenHash && type) {
          // E-posta doğrulama/sıfırlama (email parametresi yoksa çoğu durumda gerekmez)
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
            email, // varsa kullan, yoksa Supabase genelde gerektirmez
          });
          if (error) throw error;
          setMsg("E-posta doğrulandı! Lütfen giriş yapın.");
          router.replace("/giris");
          return;
        }

        // Hiçbiri yoksa giriş sayfasına at
        setMsg("Yönlendiriliyor...");
        router.replace("/giris");
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message || "Bir hata oluştu.");
      }
    };

    run();
  }, [router.isReady]);

  return <p style={{ padding: 40, textAlign: "center" }}>{msg}</p>;
}
