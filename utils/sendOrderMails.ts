// utils/sendOrderMails.ts
export async function sendOrderEmails({
  aliciMail,
  saticiMail,
  urunBaslik,
  urunFiyat,
  siparisNo,
}: {
  aliciMail: string;
  saticiMail: string;
  urunBaslik: string;
  urunFiyat: string;
  siparisNo: number | string;
}) {
  // Alıcıya mail
  await fetch("/api/send-mail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: aliciMail,
      subject: `Siparişiniz Alındı! (#${siparisNo})`,
      text: `Siparişiniz başarıyla oluşturuldu!\nÜrün: ${urunBaslik}\nFiyat: ${urunFiyat}₺\nSipariş No: ${siparisNo}`,
      html: `<h2>Siparişiniz Alındı!</h2><p><b>Ürün:</b> ${urunBaslik}</p><p><b>Fiyat:</b> ${urunFiyat}₺</p><p><b>Sipariş No:</b> #${siparisNo}</p>`
    }),
  });

  // Satıcıya mail
  await fetch("/api/send-mail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: saticiMail,
      subject: `Yeni Sipariş Geldi! (#${siparisNo})`,
      text: `Yeni bir sipariş aldınız!\nÜrün: ${urunBaslik}\nFiyat: ${urunFiyat}₺\nSipariş No: ${siparisNo}`,
      html: `<h2>Yeni Sipariş Geldi!</h2><p><b>Ürün:</b> ${urunBaslik}</p><p><b>Fiyat:</b> ${urunFiyat}₺</p><p><b>Sipariş No:</b> #${siparisNo}</p>`
    }),
  });
}
