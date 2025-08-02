import { useState } from 'react';

type ReklamFormModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function ReklamFormModal({ open, onClose }: ReklamFormModalProps) {
  const [adsoyad, setAdsoyad] = useState('');
  const [email, setEmail] = useState('');
  const [telefon, setTelefon] = useState('');
  const [sure, setSure] = useState('1g');
  const [mesaj, setMesaj] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const fiyatlar = {
    '1g': '1 Gün - 250 TL',
    '1h': '1 Hafta - 1.500 TL',
    '1a': '1 Ay - 7.000 TL'
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSending(true);
    const resp = await fetch('/api/reklam-basvuru', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adsoyad, email, telefon, sure, mesaj })
    });
    setSending(false);
    if (resp.ok) setSent(true);
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      zIndex: 2000,
      top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(29, 39, 57, 0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '36px 28px 28px 28px',
        minWidth: 340,
        boxShadow: '0 8px 40px #1bbd8a22',
        position: 'relative',
        maxWidth: '92vw'
      }}>
        {/* Çarpı butonu */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            right: 15,
            top: 15,
            border: 'none',
            background: 'transparent',
            fontSize: 22,
            color: '#64748b',
            cursor: 'pointer',
            fontWeight: 800,
            zIndex: 5,
            transition: 'color 0.2s'
          }}
          title="Kapat"
          aria-label="Kapat"
          onMouseOver={e => ((e.target as HTMLButtonElement).style.color = '#e11d48')}
          onMouseOut={e => ((e.target as HTMLButtonElement).style.color = '#64748b')}
        >×</button>

        <h2 style={{
          fontSize: 23,
          fontWeight: 800,
          marginBottom: 17,
          color: '#223555',
          letterSpacing: 0.5,
          textAlign: 'center'
        }}>
          Reklam Başvurusu
        </h2>
        <p style={{
          color: '#666',
          fontSize: 15,
          marginBottom: 12,
          textAlign: 'center',
          fontWeight: 500
        }}>
          Reklam alanını satın almak için formu doldurun. Sizi en kısa sürede arayacağız!
        </p>
        {sent ? (
          <div style={{ textAlign: 'center', padding: 10 }}>
            <b style={{ color: '#1bbd8a', fontSize: 17 }}>Talebiniz alındı!</b>
            <br />
            <span style={{ color: '#222', fontSize: 15 }}>
              En kısa sürede size dönüş yapılacak.<br />
              <button
                style={{
                  marginTop: 20,
                  padding: '8px 26px',
                  borderRadius: 9,
                  border: 'none',
                  background: '#1bbd8a',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px #1bbd8a20',
                  letterSpacing: 0.5
                }}
                onClick={onClose}
              >Kapat</button>
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 7 }}>
            <input
              required
              value={adsoyad}
              onChange={e => setAdsoyad(e.target.value)}
              placeholder="Ad Soyad"
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 9,
                padding: '10px 12px',
                fontSize: 16,
                fontWeight: 600,
                outline: 'none',
                color: '#223555',
                background: '#f8fafc'
              }}
            />
            <input
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="E-posta"
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 9,
                padding: '10px 12px',
                fontSize: 16,
                fontWeight: 600,
                outline: 'none',
                color: '#223555',
                background: '#f8fafc'
              }}
            />
            <input
              value={telefon}
              onChange={e => setTelefon(e.target.value)}
              placeholder="Telefon (isteğe bağlı)"
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 9,
                padding: '10px 12px',
                fontSize: 16,
                fontWeight: 600,
                outline: 'none',
                color: '#223555',
                background: '#f8fafc'
              }}
            />
            <select
              value={sure}
              onChange={e => setSure(e.target.value)}
              required
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 9,
                padding: '10px 12px',
                fontSize: 16,
                fontWeight: 700,
                outline: 'none',
                color: '#fb8500',
                background: '#fffbe8'
              }}
            >
              {Object.entries(fiyatlar).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <textarea
              value={mesaj}
              onChange={e => setMesaj(e.target.value)}
              placeholder="Ek Notunuz (isteğe bağlı)"
              rows={3}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 9,
                padding: '10px 12px',
                fontSize: 15,
                fontWeight: 500,
                outline: 'none',
                color: '#223555',
                background: '#f8fafc',
                resize: 'vertical'
              }}
            />
            <button
              type="submit"
              disabled={sending}
              style={{
                background: 'linear-gradient(90deg, #fb8500 0%, #ffbc38 80%)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '11px 0',
                fontWeight: 800,
                fontSize: 17,
                cursor: sending ? 'wait' : 'pointer',
                width: '100%',
                boxShadow: '0 2px 8px #fb850022',
                letterSpacing: 0.5,
                marginTop: 5,
                opacity: sending ? 0.65 : 1,
                transition: 'opacity 0.18s'
              }}
            >
              {sending ? 'Gönderiliyor...' : 'Gönder'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
