import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { adsoyad, email, telefon, sure, mesaj } = req.body;

  // Formdan gelenleri formatla
  const sureText =
    sure === '1g' ? '1 Gün / 250 TL' :
    sure === '1h' ? '1 Hafta / 1.500 TL' :
    sure === '1a' ? '1 Ay / 7.000 TL' : sure;

  // Mail ayarlarını girmen gerekiyor! (aşağıdaki alanları kendine göre düzenle)
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: 'hakanbenli47@gmail.com',
      pass: 'owhd zrcg xawx igvl'
    }
  });

  const mailOptions = {
    from: '"Reklam Başvuru" <hakanbenli47@gmail.com>',
    to: 'hakanbenli47@gmail.com', // başvurular buraya gelsin
    subject: 'Yeni Reklam Başvuru Formu',
    html: `
      <b>Ad Soyad:</b> ${adsoyad}<br/>
      <b>E-posta:</b> ${email}<br/>
      <b>Telefon:</b> ${telefon || '-'}<br/>
      <b>Süre:</b> ${sureText}<br/>
      <b>Ek Not:</b> ${mesaj || '-'}<br/>
      <hr/>
      <i>Bu e-posta otomatik olarak reklam başvuru formundan gönderildi.</i>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
