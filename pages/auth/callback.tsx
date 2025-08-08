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

        // 1) OAuth/PKCE dönüşleri (code ile gelir)
        const code = url.searchParams.get("code");

        // 2) Bazı magic link/OTP akışları #hash ile gelir
        const accessToken = url.hash.match(/access_token=([^&]+)/)?.[1];
        const refreshToken = url.hash.match(/refresh_token=([^&]+)/)?.[1];

        // 3) E-posta doğrulama/şifre sıfırlama linkleri (token_hash + type)
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type"); // signup | recovery | magiclink | email_change
        const email = url.searchParams.get("email") || "";

        // 4) Supabase hata parametreleri (bazı OAuth hataları için)
        const errorDescription = url.searchParams.get("error_description");

        if (errorDescription) {
          setMsg(decodeURIComponent(errorDescription));
          return;
        }

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
          setMsg("Giriş başarılı, yönlendiriliyorsunuz...");
          router.replace("/index2");
          return;
        }

        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
            email,
          });
          if (error) throw error;
          setMsg("E-posta doğrulandı! Lütfen giriş yapın.");
          router.replace("/giris");
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
