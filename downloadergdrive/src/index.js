const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbz4RFANjPjkHL6nuMbNBtRUf3cRtQ5vz2DpIUF6mql8z4PMRgFxBKeTWVX_4pQUGENa/exec";

async function forwardToGAS(payload) {
  try {
    console.log("Forwarding Telegram Payload to GAS (POST)...");
    
    // Step 1: Send initial POST request to trigger doPost(e)
    let res = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      redirect: "manual"
    });
    
    console.log("GAS Initial Response Status:", res.status);
    
    // Step 2: Fetch Google Apps Script echo output from Location header
    if (res.status === 302 || res.status === 301 || res.status === 307 || res.status === 308) {
      const location = res.headers.get("Location");
      if (location) {
        let res2 = await fetch(location, { method: "GET" });
        let echoText = await res2.text();
        console.log("GAS Execution Echo Result:", echoText);
      }
    }
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
