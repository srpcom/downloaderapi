const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbz4RFANjPjkHL6nuMbNBtRUf3cRtQ5vz2DpIUF6mql8z4PMRgFxBKeTWVX_4pQUGENa/exec";

export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST") {
      try {
        const payload = await request.text();
        
        // Forward Webhook payload to Google Apps Script asynchronously (following 302 redirects)
        ctx.waitUntil(
          fetch(GAS_WEBAPP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            redirect: "follow"
          }).catch(err => console.error("GAS Forward Error:", err))
        );
        
        // Return HTTP 200 OK to Telegram in < 20 milliseconds!
        return new Response("OK", { status: 200 });
      } catch(e) {
        return new Response("OK", { status: 200 });
      }
    }
    return new Response("🚀 Downloader G-Drive Telegram Gateway Online", { status: 200 });
  }
};
