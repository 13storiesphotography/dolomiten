export default {
  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const target = String(url.searchParams.get("url") || "").trim();

    if (!target) {
      return Response.json(
        { error: "Missing url parameter" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!isAllowedMapsInput(target)) {
      return Response.json(
        { error: "Only Google Maps links are allowed" },
        { status: 400, headers: corsHeaders }
      );
    }

    try {
      let current = target;
      let finalUrl = target;

      for (let i = 0; i < 6; i++) {
        const response = await fetch(current, {
          method: "GET",
          redirect: "manual",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; DolomitenMapsResolver/1.1)",
          },
        });

        const location = response.headers.get("location");

        if (!location) {
          finalUrl = response.url || current;
          break;
        }

        finalUrl = new URL(location, current).toString();
        current = finalUrl;
      }

      return Response.json(
        {
          input: target,
          resolvedUrl: finalUrl,
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: error.message || "Could not resolve URL",
          input: target,
        },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};

function isAllowedMapsInput(target) {
  const allowedPrefixes = [
    "https://maps.app.goo.gl/",
    "https://goo.gl/maps/",
    "https://www.google.com/maps",
    "https://maps.google.com/",
    "https://share.google/",
    "http://maps.app.goo.gl/",
    "http://goo.gl/maps/",
    "http://www.google.com/maps",
    "http://maps.google.com/",
    "http://share.google/",
  ];
  return allowedPrefixes.some((prefix) => target.startsWith(prefix));
}
