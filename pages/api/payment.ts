// /pages/api/payment.ts
import type { NextApiRequest, NextApiResponse } from "next";
// @ts-ignore
import Iyzipay from "iyzipay";
import { supabase } from "../../lib/supabaseClient";

const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY!,
  secretKey: process.env.IYZICO_SECRET!,
  uri: process.env.IYZICO_URI || "https://sandbox-api.iyzipay.com",
});

function iyzRequest(method: any, request: any) {
  return new Promise((resolve, reject) => {
    method(request, (err: any, result: any) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function moneyString(v: number | string) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function parseExpiry(exp: string) {
  // "MM/YY" -> {month, year("20YY")}
  const m = exp?.match(/^(\d{2})\/(\d{2})$/);
  if (!m) throw new Error("expiry formatı MM/YY olmalı");
  const month = m[1];
  const year = `20${m[2]}`;
  return { month, year };
}

function normalizeCardAssociation(assoc?: string): string {
  const a = (assoc || "").toLowerCase();
  if (a.includes("visa")) return "visa";
  if (a.includes("master")) return "mastercard";
  if (a.includes("troy")) return "troy";
  if (a.includes("amex")) return "amex";
  return "card";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const action = (req.query.action as string) || req.body?.action;

  try {
    // =========================================================
    // 1) KART KAYDET (TOKEN OLUŞTUR)
    // =========================================================
    if (action === "registerCard") {
      const { user_id, card } = req.body || {};
      if (!user_id) return res.status(400).json({ success: false, message: "user_id gerekli" });
      if (!card?.card_number || !card?.expiry || !card?.cvv || !card?.name_on_card) {
        return res.status(400).json({ success: false, message: "Kart bilgileri eksik" });
      }

      const { month, year } = parseExpiry(card.expiry);

      const cardReg: any = await iyzRequest(iyzipay.card.create, {
        locale: "tr",
        conversationId: "reg-" + Date.now(),
        cardUserKey: user_id, // Kullanıcı bazlı anahtar
        card: {
          cardAlias: card.title || "Kayıtlı Kart",
          cardNumber: card.card_number,
          expireMonth: month,
          expireYear: year,
          cardHolderName: card.name_on_card,
        },
      });

      // Supabase'e "kart kaydedildi" logu (token saklama)
      if (cardReg?.status === "success") {
        await supabase.from("payments").insert([
          {
            user_id,
            amount: 0,
            status: "card_registered",
            card_token: cardReg.cardToken,
            card_user_key: cardReg.cardUserKey,
            raw_response: cardReg,
          },
        ]);
      }

      // Frontend'te göstermek/DB'ye yazmak için normalize meta
      const meta = {
        title: card.title || "Kayıtlı Kart",
        name_on_card: card.name_on_card,
        last4: cardReg?.cardDetails?.lastFourDigits || (card.card_number || "").slice(-4),
        brand: normalizeCardAssociation(cardReg?.cardDetails?.cardAssociation),
        expiry: card.expiry,
      };

      return res.status(200).json({
        success: cardReg?.status === "success",
        message: cardReg?.status === "success" ? "Kart kaydedildi" : (cardReg?.errorMessage || "Kart kaydedilemedi"),
        tokens: { card_token: cardReg?.cardToken, card_user_key: cardReg?.cardUserKey },
        cardMeta: meta,
        raw: cardReg,
      });
    }

    // =========================================================
    // 2) KAYITLI KARTLA ÖDEME
    // body: { user_id, amount, card: { card_token, card_user_key, name_on_card? } }
    // =========================================================
    if (action === "payWithToken") {
      const { user_id, amount, card } = req.body || {};
      if (!user_id) return res.status(400).json({ success: false, message: "user_id gerekli" });
      if (!amount) return res.status(400).json({ success: false, message: "amount gerekli" });
      if (!card?.card_token || !card?.card_user_key) {
        return res.status(400).json({ success: false, message: "card_token ve card_user_key gerekli" });
      }

      const payment: any = await iyzRequest(iyzipay.payment.create, {
        locale: "tr",
        conversationId: Date.now().toString(),
        price: moneyString(amount),
        paidPrice: moneyString(amount),
        currency: "TRY",
        installment: "1",
        paymentCard: {
          cardToken: card.card_token,
          cardUserKey: card.card_user_key,
        },
        buyer: {
          id: user_id,
          name: card.name_on_card || "User",
          surname: "User",
          gsmNumber: "+905555555555",
          email: "test@example.com",
          identityNumber: "11111111111",
          registrationAddress: "Adres",
          ip: req.socket.remoteAddress || "127.0.0.1",
          city: "Istanbul",
          country: "Turkey",
        },
        basketItems: [
          {
            id: "BI101",
            name: "Sepet Ödemesi",
            category1: "Genel",
            itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
            price: moneyString(amount),
          },
        ],
      });

      if (payment?.status === "success") {
        await supabase.from("payments").insert([
          {
            user_id,
            amount,
            status: payment.status,
            iyz_payment_id: payment.paymentId,
            raw_response: payment,
          },
        ]);
      }

      return res.status(200).json({
        success: payment?.status === "success",
        payment,
      });
    }

    // =========================================================
    // 3) YENİ KARTLA ANLIK ÖDEME (opsiyonel)
    // body: { user_id, amount, card:{ name_on_card, card_number, expiry:'MM/YY', cvv, title? } }
    // Not: registerCard: '0' gönderiyoruz. İstersen '1' yapıp ödemeyle birlikte kaydedebilirsin.
    // =========================================================
    if (action === "payWithNewCard") {
      const { user_id, amount, card } = req.body || {};
      if (!user_id) return res.status(400).json({ success: false, message: "user_id gerekli" });
      if (!amount) return res.status(400).json({ success: false, message: "amount gerekli" });
      if (!card?.card_number || !card?.expiry || !card?.cvv || !card?.name_on_card) {
        return res.status(400).json({ success: false, message: "Kart bilgileri eksik" });
      }

      const { month, year } = parseExpiry(card.expiry);

      const payment: any = await iyzRequest(iyzipay.payment.create, {
        locale: "tr",
        conversationId: "pay-" + Date.now(),
        price: moneyString(amount),
        paidPrice: moneyString(amount),
        currency: "TRY",
        installment: "1",
        paymentCard: {
          cardHolderName: card.name_on_card,
          cardNumber: card.card_number,
          expireMonth: month,
          expireYear: year,
          cvc: card.cvv,
          registerCard: "0", // "1" yaparsan ödemeyle birlikte de kaydeder.
          cardAlias: card.title || "Kartım",
        },
        buyer: {
          id: user_id,
          name: card.name_on_card,
          surname: "User",
          gsmNumber: "+905555555555",
          email: "test@example.com",
          identityNumber: "11111111111",
          registrationAddress: "Adres",
          ip: req.socket.remoteAddress || "127.0.0.1",
          city: "Istanbul",
          country: "Turkey",
        },
        basketItems: [
          {
            id: "BI101",
            name: "Sepet Ödemesi",
            category1: "Genel",
            itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
            price: moneyString(amount),
          },
        ],
      });

      if (payment?.status === "success") {
        await supabase.from("payments").insert([
          {
            user_id,
            amount,
            status: payment.status,
            iyz_payment_id: payment.paymentId,
            raw_response: payment,
          },
        ]);
      }

      return res.status(200).json({
        success: payment?.status === "success",
        payment,
      });
    }

    // =========================================================
    // GERİYE DÖNÜK UYUMLULUK: card.card_token varsa ödeme; yoksa kart kaydet
    // (Önceki sürümünü korumak için bırakıldı)
    // =========================================================
    const { amount, card, user_id } = req.body || {};

    if (card?.card_token) {
      const payment: any = await iyzRequest(iyzipay.payment.create, {
        locale: "tr",
        conversationId: Date.now().toString(),
        price: moneyString(amount),
        paidPrice: moneyString(amount),
        currency: "TRY",
        installment: "1",
        paymentCard: {
          cardToken: card.card_token,
          cardUserKey: card.card_user_key,
        },
        buyer: {
          id: user_id,
          name: card.name_on_card || "User",
          surname: "User",
          gsmNumber: "+905555555555",
          email: "test@example.com",
          identityNumber: "11111111111",
          registrationAddress: "Adres",
          ip: req.socket.remoteAddress || "127.0.0.1",
          city: "Istanbul",
          country: "Turkey",
        },
        basketItems: [
          {
            id: "BI101",
            name: "Sepet Ödemesi",
            category1: "Genel",
            itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
            price: moneyString(amount),
          },
        ],
      });

      if (payment?.status === "success") {
        await supabase.from("payments").insert([
          {
            user_id,
            amount,
            status: payment.status,
            iyz_payment_id: payment.paymentId,
            raw_response: payment,
          },
        ]);
      }

      return res.status(200).json({ success: payment?.status === "success", payment });
    }

    if (card?.card_number && card?.expiry && card?.cvv && card?.name_on_card) {
      const { month, year } = parseExpiry(card.expiry);

      const cardReg: any = await iyzRequest(iyzipay.card.create, {
        locale: "tr",
        conversationId: "reg-" + Date.now(),
        cardUserKey: user_id,
        card: {
          cardAlias: card.title || "Kayıtlı Kart",
          cardNumber: card.card_number,
          expireMonth: month,
          expireYear: year,
          cardHolderName: card.name_on_card,
        },
      });

      if (cardReg?.status === "success") {
        await supabase.from("payments").insert([
          {
            user_id,
            amount: 0,
            status: "card_registered",
            card_token: cardReg.cardToken,
            card_user_key: cardReg.cardUserKey,
            raw_response: cardReg,
          },
        ]);
      }

      const meta = {
        title: card.title || "Kayıtlı Kart",
        name_on_card: card.name_on_card,
        last4: cardReg?.cardDetails?.lastFourDigits || (card.card_number || "").slice(-4),
        brand: normalizeCardAssociation(cardReg?.cardDetails?.cardAssociation),
        expiry: card.expiry,
      };

      return res.status(200).json({
        success: cardReg?.status === "success",
        message: cardReg?.status === "success" ? "Kart kaydedildi" : (cardReg?.errorMessage || "Kart kaydedilemedi"),
        tokens: { card_token: cardReg?.cardToken, card_user_key: cardReg?.cardUserKey },
        cardMeta: meta,
        raw: cardReg,
      });
    }

    return res.status(400).json({ success: false, message: "Geçersiz istek. action veya kart/ödeme alanlarını kontrol edin." });
  } catch (err: any) {
    console.error("Payment error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  }
}
