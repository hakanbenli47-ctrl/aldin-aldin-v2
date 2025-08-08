import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Giris() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // İstersen kaldır
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setMessage("Kod gönderiliyor…");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL + "/auth/callback" }
    });
    if (error) return setMessage("❌ Kod gönderilemedi: " + error.message);
    setOtpSent(true);
    setMessage("✅ 6 haneli kod e-postana gönderildi.");
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setMessage("Kod doğrulanıyor…");
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: "email", // 6 haneli e-posta kodu
    });
    if (error) return setMessage("❌ Kod hatalı/expired: " + error.message);

    setMessage("✅ Giriş başarılı! Yönlendiriliyor…");
    const rol = localStorage.getItem("selectedRole");
    setTimeout(() => {
      if (rol === "satici") router.push("/satici");
      else if (rol === "alici") router.push("/index2");
      else router.push("/");
    }, 800);
  }

  // (İstersen parola ile giriş kalsın)
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMessage("❌ Giriş başarısız: " + error.message);
    setMessage("✅ Giriş başarılı! Yönlendiriliyor…");
    const rol = localStorage.getItem("selectedRole");
    setTimeout(() => {
      if (rol === "satici") router.push("/satici");
      else if (rol === "alici") router.push("/index2");
      else router.push("/");
    }, 800);
  }

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#f4f4f6 0%,#e6e8ec 100%)"}}>
      <div style={{background:"#fff",borderRadius:14,boxShadow:"0 4px 16px #e1e3e8",padding:36,minWidth:350}}>
        <h2 style={{textAlign:"center",marginBottom:24,color:"#223555"}}>Giriş Yap</h2>

        {/* E-posta */}
        <input
          name="email"
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          style={{width:"100%",padding:12,marginBottom:12,border:"1px solid #bbb",borderRadius:8}}
        />

        {/* Parola ile giriş (istersen kaldır) */}
        <form onSubmit={handlePasswordLogin} style={{marginBottom:16}}>
          <input
            name="password"
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            style={{width:"100%",padding:12,marginBottom:10,border:"1px solid #bbb",borderRadius:8}}
          />
          <button type="submit" style={{width:"100%",background:"#2563eb",color:"#fff",padding:12,border:"none",borderRadius:8,fontWeight:700}}>
            Şifre ile Giriş
          </button>
        </form>

        {/* Kodla giriş */}
        {!otpSent ? (
          <form onSubmit={handleSendOtp}>
            <button type="submit" style={{width:"100%",background:"#16a34a",color:"#fff",padding:12,border:"none",borderRadius:8,fontWeight:700}}>
              Kodu Gönder
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{marginTop:12}}>
            <input
              placeholder="6 haneli kod"
              value={otpCode}
              onChange={(e)=>setOtpCode(e.target.value.replace(/\D/g,"").slice(0,6))}
              style={{width:"100%",padding:12,marginBottom:10,border:"1px solid #bbb",borderRadius:8,letterSpacing:2,textAlign:"center"}}
            />
            <button type="submit" style={{width:"100%",background:"#0ea5e9",color:"#fff",padding:12,border:"none",borderRadius:8,fontWeight:700}}>
              Kodu Doğrula
            </button>
          </form>
        )}

        {message && <p style={{marginTop:12,color:"#111"}}>{message}</p>}

        <div style={{textAlign:"center",marginTop:10}}>
          <a href="/kayit" style={{color:"#2563eb",fontWeight:600,textDecoration:"underline"}}>Kaydol</a>
        </div>
      </div>
    </div>
  );
}
