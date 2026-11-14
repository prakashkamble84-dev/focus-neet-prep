apper.serve(async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apper-public-key, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
  const reply = (status, value) => new Response(JSON.stringify(value), { status, headers });

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { success: false, message: "Use POST." });

  try {
    const body = await req.json();
    const exam = String(body.exam || "").trim();
    const query = String(body.query || "").trim().slice(0, 180);
    const allowed = ["JEE Main", "JEE Advanced", "NEET UG", "General"];
    if (!allowed.includes(exam)) return reply(400, { success: false, message: "Choose a supported examination." });
    if (query.length < 3) return reply(400, { success: false, message: "Enter at least three characters." });

    const base = exam === "General" ? query : exam + " " + query;
    const terms = [
      base + " syllabus curriculum official",
      base + " chapters topics coaching institute syllabus"
    ];
    const officialDomains = [
      "nta.ac.in", "jeemain.nta.nic.in", "neet.nta.nic.in",
      "jeeadv.ac.in", "nmc.org.in", "ncert.nic.in", "education.gov.in"
    ];
    const strip = (value) => String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replaceAll("&amp;", "&")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll("&nbsp;", " ")
      .replaceAll("&#x27;", "'")
      .replaceAll("  ", " ")
      .trim();

    const candidates = [];
    for (const term of terms) {
      const response = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(term), {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" }
      });
      if (!response.ok) continue;
      const html = await response.text();
      let cursor = 0;
      while (candidates.length < 24) {
        const marker = html.indexOf("result__a", cursor);
        if (marker < 0) break;
        const start = html.lastIndexOf("<a", marker);
        const end = html.indexOf("</a>", marker);
        if (start < 0 || end < 0) break;
        const anchor = html.slice(start, end + 4);
        const hrefStart = anchor.indexOf('href="');
        const hrefEnd = hrefStart < 0 ? -1 : anchor.indexOf('"', hrefStart + 6);
        const titleStart = anchor.indexOf(">", hrefEnd);
        let target = hrefStart < 0 || hrefEnd < 0 ? "" : anchor.slice(hrefStart + 6, hrefEnd);
        const title = strip(titleStart < 0 ? "" : anchor.slice(titleStart + 1, anchor.lastIndexOf("</a>")));
        cursor = end + 4;
        if (!target || !title) continue;
        target = target.replaceAll("&amp;", "&");
        try {
          const redirect = new URL(target.startsWith("//") ? "https:" + target : target);
          const actual = redirect.searchParams.get("uddg");
          if (actual) target = actual;
        } catch {}
        try {
          const destination = new URL(target);
          if (destination.protocol !== "https:" && destination.protocol !== "http:") continue;
          const domain = destination.hostname.replace("www.", "").toLowerCase();
          if (domain.includes("duckduckgo.com") || domain.includes("google.com") || domain.includes("bing.com")) continue;
          const snippetMarker = html.indexOf("result__snippet", end);
          const nextResult = html.indexOf("result__a", end + 4);
          let snippet = "";
          if (snippetMarker >= 0 && (nextResult < 0 || snippetMarker < nextResult)) {
            const snippetStart = html.indexOf(">", snippetMarker);
            const snippetEnd = html.indexOf("</", snippetStart);
            if (snippetStart >= 0 && snippetEnd > snippetStart) snippet = strip(html.slice(snippetStart + 1, snippetEnd));
          }
          const isOfficial = officialDomains.some((item) => domain === item || domain.endsWith("." + item));
          candidates.push({
            title,
            url: destination.toString(),
            domain,
            snippet,
            sourceType: isOfficial ? "Official" : "Unofficial",
            exam,
            discoveredAt: new Date().toISOString()
          });
        } catch {}
      }
    }

    const unique = [];
    const seen = new Set();
    for (const item of candidates) {
      const key = item.url.toLowerCase().split("#")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
      if (unique.length === 12) break;
    }
    return reply(200, {
      success: true,
      exam,
      query,
      searchedQueries: terms,
      results: unique,
      message: unique.length ? "Candidates found. Verify source, date and rights before using material." : "No results returned. Try a broader search phrase."
    });
  } catch (error) {
    return reply(502, {
      success: false,
      message: "Internet search could not complete. The search provider may be temporarily unavailable.",
      detail: String(error && error.message ? error.message : error)
    });
  }
});