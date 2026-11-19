const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apper-public-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const reply = (status, value) => new Response(JSON.stringify(value), { status, headers: HEADERS });

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_AUTHORITIES_PER_RUN = 5;
const MAX_DOCUMENTS_PER_AUTHORITY = 5;
const FETCH_TIMEOUT_MS = 30000;
const REGISTRY_FIELDS = ["Name", "official_domain_c", "website_url_c", "is_authoritative_c", "active_c"];

const normaliseHost = (value) => String(value || "").toLowerCase().replace(/^www\./, "").trim();
const onDomain = (host, domain) => Boolean(domain) && (host === domain || host.endsWith("." + domain));

async function storeDocument(authority, documentUrl, domain, eq) {
  const duplicate = await sdk.table("source_document_versions_c")
    .select(["Name"])
    .where(eq("document_url_c", documentUrl))
    .page(1, 1)
    .fetch();
  if (!duplicate.success) return { skipped: "Existing source records could not be checked." };
  if ((duplicate.data ?? []).length) return { skipped: "Already retrieved." };

  const fetched = await fetch(documentUrl, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/pdf" },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  }).catch(() => null);
  if (!fetched || !fetched.ok) return { skipped: "The official document could not be downloaded." };

  const finalHost = normaliseHost(new URL(fetched.url || documentUrl).hostname);
  if (!onDomain(finalHost, domain)) return { skipped: "The download redirected away from the official domain." };

  const contentType = String(fetched.headers.get("content-type") || "").toLowerCase();
  const bytes = new Uint8Array(await fetched.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return { skipped: "The file is empty or exceeds the 20 MB source limit." };
  }
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (!isPdf || (!contentType.includes("pdf") && !documentUrl.toLowerCase().split("?")[0].endsWith(".pdf"))) {
    return { skipped: "The link did not return a PDF document." };
  }

  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const checksum = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const now = new Date().toISOString();
  const title = decodeURIComponent(documentUrl.split("/").pop().split("?")[0] || "").slice(0, 180) || "Official document";

  const parent = await sdk.table("source_documents_c").create({
    Name: title,
    source_registry_c: authority.Id,
    issuing_authority_c: authority.Name,
    source_category_c: "Official",
    document_type_c: "Syllabus",
    official_url_c: documentUrl,
    retrieved_at_c: now,
    rights_status_c: "Review",
    verification_status_c: "New",
    ingestion_status_c: "Queued"
  });
  if (!parent.data?.length) return { skipped: parent.messages?.join("; ") || "Source document was not saved." };
  const parentId = parent.data[0].Id;

  const version = await sdk.table("source_document_versions_c").create({
    Name: title,
    source_document_c: parentId,
    source_registry_c: authority.Id,
    version_label_c: "Retrieved " + now.slice(0, 10),
    official_title_c: title,
    document_url_c: documentUrl,
    sha256_checksum_c: checksum,
    mime_type_c: "application/pdf",
    file_size_kb_c: Math.round(bytes.byteLength / 1024),
    retrieved_at_c: now,
    rights_status_c: "Review",
    rights_notes_c: "Retrieved automatically from an authoritative official domain. Rights and licence must be confirmed by a reviewer before verification.",
    ingestion_status_c: "Retrieved",
    version_status_c: "Current"
  });
  if (!version.data?.length) {
    return { skipped: "Source document was saved but its version could not be stored. " + (version.messages?.join("; ") || "") };
  }
  return { stored: { title, sourceDocumentId: parentId, versionId: version.data[0].Id, checksum } };
}

async function retrieveAuthority(authority, eq) {
  const result = { authority: authority.Name, stored: [], skipped: [] };
  const domain = normaliseHost(authority.official_domain_c);
  if (authority.is_authoritative_c !== true || authority.active_c !== true || !domain) {
    result.skipped.push({ url: "", reason: "Not an active authoritative source with a registered domain." });
    return result;
  }

  let site;
  try {
    site = new URL(String(authority.website_url_c || "").trim());
  } catch {
    result.skipped.push({ url: "", reason: "The registered website URL is not valid." });
    return result;
  }
  if (site.protocol !== "https:" || !onDomain(normaliseHost(site.hostname), domain)) {
    result.skipped.push({ url: site.toString(), reason: "The registered website is not on the official domain." });
    return result;
  }

  const page = await fetch(site.toString(), {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  }).catch(() => null);
  if (!page || !page.ok) {
    result.skipped.push({ url: site.toString(), reason: "The official website could not be read." });
    return result;
  }
  const html = await page.text();

  const links = [];
  const seen = new Set();
  for (const match of html.matchAll(/href\s*=\s*["']([^"'#]+\.pdf(?:\?[^"']*)?)["']/gi)) {
    let target;
    try {
      target = new URL(match[1].replaceAll("&amp;", "&"), page.url || site.toString());
    } catch {
      continue;
    }
    if (target.protocol !== "https:" || !onDomain(normaliseHost(target.hostname), domain)) continue;
    const key = target.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(key);
    if (links.length >= MAX_DOCUMENTS_PER_AUTHORITY) break;
  }

  for (const link of links) {
    try {
      const outcome = await storeDocument(authority, link, domain, eq);
      if (outcome.stored) result.stored.push({ url: link, ...outcome.stored });
      else result.skipped.push({ url: link, reason: outcome.skipped });
    } catch (error) {
      result.skipped.push({ url: link, reason: String(error && error.message ? error.message : error).slice(0, 200) });
    }
  }
  return result;
}

apper.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });
  if (req.method !== "POST") return reply(405, { success: false, message: "Use POST." });

  try {
    const cronToken = await apper.getSecret("RETRIEVAL_CRON_TOKEN");
    const bearer = String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!cronToken || bearer !== cronToken) {
      return reply(401, { success: false, message: "Retrieval requires the scheduler token." });
    }
    const { eq, and } = sdk.core;
    const body = await req.json().catch(() => ({}));
    const registryId = String(body.registryId || "").trim();
    const limit = Math.min(Math.max(Number(body.limit) || MAX_AUTHORITIES_PER_RUN, 1), MAX_AUTHORITIES_PER_RUN);

    let authorities;
    if (registryId) {
      const one = await sdk.table("source_registry_c").select(REGISTRY_FIELDS).get(registryId);
      if (!one.success || !one.data) {
        return reply(404, { success: false, message: "The issuing authority is not registered." });
      }
      authorities = [one.data];
    } else {
      const all = await sdk.table("source_registry_c")
        .select(REGISTRY_FIELDS)
        .where(and(eq("is_authoritative_c", true), eq("active_c", true)))
        .page(1, limit)
        .fetch();
      if (!all.success) {
        return reply(502, { success: false, message: "Active issuing authorities could not be loaded." });
      }
      authorities = all.data ?? [];
    }
    if (!authorities.length) {
      return reply(200, { success: true, runs: [], message: "No active authoritative sources are registered." });
    }

    const runs = [];
    for (const authority of authorities.slice(0, limit)) {
      try {
        runs.push(await retrieveAuthority(authority, eq));
      } catch (error) {
        runs.push({
          authority: authority.Name,
          stored: [],
          skipped: [{ url: "", reason: String(error && error.message ? error.message : error).slice(0, 200) }]
        });
      }
    }

    const storedCount = runs.reduce((total, run) => total + run.stored.length, 0);
    return reply(200, {
      success: true,
      runs,
      storedCount,
      message: storedCount
        ? "Retrieved " + storedCount + " official document(s). Each is stored as Review and New until a reviewer confirms rights and verification."
        : "No new official documents were retrieved."
    });
  } catch (error) {
    return reply(502, {
      success: false,
      message: "Scheduled source retrieval could not complete.",
      detail: String(error && error.message ? error.message : error).slice(0, 300)
    });
  }
});