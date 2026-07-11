// Thin SMS sender. One function the app calls; provider chosen by env vars.
// No keys set -> logged mock, so the whole pipeline is demo-able with zero setup.
//   TextBee   : TEXTBEE_API_KEY + TEXTBEE_DEVICE_ID  (free, Android phone gateway)
//   Fast2SMS  : FAST2SMS_API_KEY                      (India, production, DLT)
// ponytail: adapter over 2 providers + mock; add a 3rd only when a real need shows up.

async function textbee(phone, text) {
  const url = `https://api.textbee.dev/api/v1/gateway/devices/${process.env.TEXTBEE_DEVICE_ID}/send-sms`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.TEXTBEE_API_KEY },
    body: JSON.stringify({ recipients: [phone], message: text }),
  });
  if (!res.ok) throw new Error(`textbee HTTP ${res.status}`);
  return { ok: true, provider: "textbee" };
}

async function fast2sms(phone, text) {
  const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: { authorization: process.env.FAST2SMS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      route: "q", message: text, language: "unicode",
      numbers: String(phone).replace(/\D/g, "").replace(/^91/, ""),
    }),
  });
  if (!res.ok) throw new Error(`fast2sms HTTP ${res.status}`);
  return { ok: true, provider: "fast2sms" };
}

async function sendSMS(phone, text) {
  try {
    if (process.env.TEXTBEE_API_KEY && process.env.TEXTBEE_DEVICE_ID) return await textbee(phone, text);
    if (process.env.FAST2SMS_API_KEY) return await fast2sms(phone, text);
  } catch (e) {
    // A dead gateway must never crash the request — degrade to mock and report it.
    console.error("[SMS] send failed, using mock:", e.message);
    return { ok: false, provider: "error", error: e.message, phone, text };
  }
  console.log(`[SMS MOCK] -> ${phone}: ${text}`);
  return { ok: true, provider: "mock", phone, text };
}

module.exports = { sendSMS };
