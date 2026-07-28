const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbz4RFANjPjkHL6nuMbNBtRUf3cRtQ5vz2DpIUF6mql8z4PMRgFxBKeTWVX_4pQUGENa/exec";

export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST") {
      try {
        const payload = await request.text();
        
        // Fire-and-forget POST to Google Apps Script (redirect manual triggers doPost instantly)
        ctx.waitUntil(
          fetch(GAS_WEBAPP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            redirect: "manual"
          }).catch(err => console.error("GAS POST Forward Error:", err))
        );
        
        // Instantly return HTTP 200 OK to Telegram (< 20ms)
        return new Response("OK", { status: 200 });
      } catch(e) {
        return new Response("OK", { status: 200 });
      }
    }
    return new Response("🚀 Downloader G-Drive Telegram Gateway Online", { status: 200 });
  }
};
