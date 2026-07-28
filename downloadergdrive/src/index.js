const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbz4RFANjPjkHL6nuMbNBtRUf3cRtQ5vz2DpIUF6mql8z4PMRgFxBKeTWVX_4pQUGENa/exec";

async function forwardToGAS(payload) {
  try {
    console.log("Forwarding Telegram Payload to GAS:", payload);
    let res = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    });
    let resText = await res.text();
    console.log("GAS Response Status:", res.status, "Body:", resText.substring(0, 300));
  } catch(err) {
    console.error("GAS Forward Exception:", err.toString());
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST") {
      try {
        const payload = await request.text();
        
        ctx.waitUntil(forwardToGAS(payload));
        
        return new Response("OK", { status: 200 });
      } catch(e) {
        return new Response("OK", { status: 200 });
      }
    }
    return new Response("🚀 Downloader G-Drive Telegram Gateway Online", { status: 200 });
  }
};
