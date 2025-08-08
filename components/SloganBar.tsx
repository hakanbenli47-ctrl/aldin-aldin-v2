import { useEffect, useState } from "react";

const SLOGANLAR = [
  "81 İlin Buluşma Noktası!",
  "Türkiye’nin Pazarı: 80bir",
  "Her Şehirden, Herkes İçin",
  "81 İl, Binlerce Ürün, Tek Adres: 80bir",
  "Türkiye’nin Yeni Pazarı: 80bir",
  "Yepyeni Fırsatlar – 80bir’de!",
  "Şimdi Başlıyoruz, Sen de Katıl!",
  "Her Şehirde, Her Evde, 80bir Yanında!",
  "Güvenli Alışverişin Yeni Adresi!",
  "Yeni açıldık, aramıza katıl!",
  "Sadece ilk aya özel %3 komisyon ile Başladık!",
  "Türkiye'nin her köşesine ulaşan yeni pazar!"
];

export default function SloganBar() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % SLOGANLAR.length);
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="kayan-slogan-bar">
      <span key={active}>{SLOGANLAR[active]}</span>
      <style jsx>{`
        .kayan-slogan-bar {
          width: 100vw;
          background: linear-gradient(90deg, #1bbd8a 0%, #27bdd7ff 100%);
          color: #fff;
          font-weight: 700;
          font-size: 19px;
          padding: 10px 0;
          text-align: center;
          letter-spacing: 0.4px;
          overflow: hidden;
          min-height: 42px;
        }
        .kayan-slogan-bar span {
          display: inline-block;
          animation: fadeInSlogan 0.6s;
        }
        @keyframes fadeInSlogan {
          from { opacity: 0; transform: translateY(24px);}
          to   { opacity: 1; transform: translateY(0);}
        }
      `}</style>
    </div>
  );
}
