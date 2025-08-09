import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Giris() {
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage("❌ Giriş başarısız: " + error.message);
      return;
    }

    const user = data.user;
    const confirmed = (user as any)?.confirmed_at ?? null;
    if (!confirmed) {
      setMessage("❗ Lütfen e-posta adresinizi doğrulayın (mailinizi kontrol edin).");
      return;
    }

    const role = (user?.user_metadata?.role as "alici" | "satici" | undefined) ?? undefined;
    setMessage("✅ Giriş başarılı! Yönlendiriliyorsunuz...");

    setTimeout(() => {
      if (role === "satici") router.push("/");     // Satıcı → satıcı anasayfa
      else router.push("/index2");                 // Diğer tüm durumlar → alıcı sayfası
    }, 900);
  }

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg, #f4f4f6 0%, #e6e8ec 100%)"}}>
      <div style={{background:"#fff",borderRadius:14,boxShadow:"0 4px 16px #e1e3e8",padding:36,minWidth:350}}>
        <h2 style={{fontSize:24,fontWeight:700,color:"#223555",textAlign:"center",marginBottom:24}}>Giriş Yap</h2>
        <form onSubmit={handleSubmit}>
          <input name="email" type="email" placeholder="E-posta"
            style={{width:"100%",padding:12,marginBottom:18,border:"1px solid #bbb",borderRadius:8,fontSize:15,background:"#f8fafc",color:"#222"}}/>
          <input name="password" type="password" placeholder="Şifre"
            style={{width:"100%",padding:12,marginBottom:18,border:"1px solid #bbb",borderRadius:8,fontSize:15,background:"#f8fafc",color:"#222"}}/>
          <button type="submit" style={{width:"100%",background:"#2563eb",color:"#fff",padding:12,border:"none",borderRadius:8,fontWeight:700,fontSize:16,marginBottom:12,cursor:"pointer"}}>Giriş Yap</button>
        </form>
        {message && <p style={{ color: message.startsWith("✅") ? "#16a34a" : "#000" }}>{message}</p>}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <a href="/kayit" style={{ color: "#2563eb", textDecoration:"underline" }}>Hesabın yok mu? Kayıt ol</a>
        </div>
      </div>
    </div>
  );
}
