/**
 * Нове замовлення з Firestore → Telegram
 * лише chat_id зі списку TELEGRAM_ADMIN_IDS.
 *
 * Секрети тільки в functions/.env або:
 * firebase functions:secrets:set TELEGRAM_BOT_TOKEN
 * firebase functions:secrets:set TELEGRAM_ADMIN_IDS
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

function getSecrets() {
  const cfg = (() => {
    try {
      return functions.config().telegram || {};
    } catch {
      return {};
    }
  })();
  return {
    token: process.env.TELEGRAM_BOT_TOKEN || cfg.token || "",
    admins: String(process.env.TELEGRAM_ADMIN_IDS || cfg.admins || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

async function sendTelegram(text) {
  const { token, admins } = getSecrets();
  if (!token || !admins.length) {
    console.error("Telegram secrets are not set");
    return;
  }
  for (const chatId of admins) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      console.error("Telegram error", chatId, await res.text());
    }
  }
}

exports.onOrderCreated = functions.firestore
  .document("orders/{id}")
  .onCreate(async (snap) => {
    const o = snap.data();
    const items = (o.items || [])
      .map((i) => `• ${i.title} (${i.extra}) — ${i.kg} кг`)
      .join("\n");
    const text =
      `<b>Нове замовлення Клешневар</b>\n` +
      `${o.name} · ${o.phone}\n` +
      `${o.type === "pickup" ? "Самовивіз" : "Доставка"}\n` +
      `${o.address ? o.address + "\n" : ""}` +
      `${items}\n` +
      `<b>${o.sum} грн</b>` +
      (o.comment ? `\nКоментар: ${o.comment}` : "");
    await sendTelegram(text);
  });
