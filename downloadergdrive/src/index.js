const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbz4RFANjPjkHL6nuMbNBtRUf3cRtQ5vz2DpIUF6mql8z4PMRgFxBKeTWVX_4pQUGENa/exec";

async function forwardToGAS(payload) {
  try {
    // Step 1: Send initial POST request with manual redirect handling
    let res = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      redirect: "manual"
    });

    // Step 2: Handle Google Apps Script 302/301 Redirect while preserving POST method & body
    if (res.status === 302 || res.status === 301 || res.status === 307 || res.status === 308) {
      const location = res.headers.get("Location");
      if (location) {
        await fetch(location, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload
        });
      }
    }
  } catch(err) {
    console.error("GAS Forward Error:", err);
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST") {
      try {
        const payload = await request.text();
        
        // Asynchronously process forwarding to Google Apps Script
        ctx.waitUntil(forwardToGAS(payload));
        
        // Return HTTP 200 OK to Telegram instantly (<20ms)
        return new Response("OK", { status: 200 });
      } catch(e) {
        return new Response("OK", { status: 200 });
      }
    }
    return new Response("🚀 Downloader G-Drive Telegram Gateway Online", { status: 200 });
  }
};
