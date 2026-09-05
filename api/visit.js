module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  const webhook = process.env.VISIT_SHEETS_WEBHOOK;
  const secret = process.env.VISIT_LOG_SECRET;

  // Soft-fail: never affect page UX if logging isn't configured.
  if (!webhook || !secret) {
    res.status(204).end();
    return;
  }

  let body = {};
  try {
    if (typeof req.body === "string" && req.body) {
      body = JSON.parse(req.body);
    } else if (req.body && typeof req.body === "object") {
      body = req.body;
    }
  } catch (_) {
    body = {};
  }

  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0] : "") ||
    req.headers["x-real-ip"] ||
    "";

  const payload = {
    secret,
    timestamp: new Date().toISOString(),
    ip: String(ip).trim(),
    country: req.headers["x-vercel-ip-country"] || "",
    state: req.headers["x-vercel-ip-country-region"] || "",
    city: req.headers["x-vercel-ip-city"] || "",
    path: typeof body.path === "string" ? body.path.slice(0, 500) : "",
    referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 1000) : "",
    userAgent: req.headers["user-agent"] || "",
    language: typeof body.language === "string" ? body.language.slice(0, 80) : "",
  };

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (_) {
    // Ignore webhook failures so visits never break the site.
  }

  res.status(204).end();
};
