const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbz4RFANjPjkHL6nuMbNBtRUf3cRtQ5vz2DpIUF6mql8z4PMRgFxBKeTWVX_4pQUGENa/exec";

async function forwardToGAS(payload) {
  try {
    console.log("Forwarding Telegram Payload to GAS (POST)...");
    
    // EXPLICIT POST with redirect: "manual" so fetch does NOT convert POST into GET on 302 redirect!
    let res = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: payload,
      redirect: "manual"
    });
    
    console.log("GAS Request Triggered. Status:", res.status);
  } catch(err) {
    console.error("GAS Forward Error:", err.toString());
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
