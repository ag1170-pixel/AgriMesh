// Thin SMS sender. One function the app calls; provider chosen by env vars.
// No keys set -> logged mock, so the whole pipeline is demo-able with zero setup.
//   TextBee   : TEXTBEE_API_KEY + TEXTBEE_DEVICE_ID  (free, Android phone gateway)
//   Fast2SMS  : FAST2SMS_API_KEY                      (India, production, DLT)
// Adapter over 2 providers + mock; add a 3rd only when a real need shows up.

// Never log a phone number in full — mask all but the last 3 digits so logs
// (which may end up in a shared dashboard or ticket) don't leak PII.
function maskPhone(phone) {
  const s = String(phone);
  return s.length > 3 ? "*".repeat(s.length - 3) + s.slice(-3) : "***";
}

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
    // Error message is logged server-side only; never returned raw to the client
    // (it can include provider response bodies that occasionally echo request headers).
    console.error(`[SMS] send failed for ${maskPhone(phone)}, using mock:`, e.message);
    return { ok: false, provider: "error", phone: maskPhone(phone) };
  }
  console.log(`[SMS MOCK] -> ${maskPhone(phone)}: ${text}`);
  return { ok: true, provider: "mock", phone, text };
}

module.exports = { sendSMS, maskPhone };
