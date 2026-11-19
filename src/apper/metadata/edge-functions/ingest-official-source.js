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

  const MAX_BYTES = 20 * 1024 * 1024;

  try {
    const { eq } = sdk.core;
    const body = await req.json();
    const registryId = String(body.registryId || "").trim();
    const documentUrl = String(body.documentUrl || "").trim();
    const documentTitle = String(body.documentTitle || "").trim().slice(0, 180);
    if (!registryId) return reply(400, { success: false, message: "Choose a registered issuing authority." });

    let target;
    try {
      target = new URL(documentUrl);
    } catch {
      return reply(400, { success: false, message: "The document URL is not valid." });
    }
    if (target.protocol !== "https:") {
      return reply(400, { success: false, message: "Only HTTPS official URLs can be retrieved." });
    }

    const registryRes = await sdk.table("source_registry_c")
      .select(["Name", "official_domain_c", "is_authoritative_c", "active_c"])
      .get(registryId);
    const authority = registryRes.data;
    if (!registryRes.success || !authority) {
      return reply(404, { success: false, message: "The issuing authority is not registered." });
    }
    if (authority.is_authoritative_c !== true || authority.active_c !== true) {
      return reply(403, { success: false, message: "The issuing authority is not an active authoritative source." });
    }

    const expectedDomain = String(authority.official_domain_c || "").toLowerCase().replace(/^www\./, "").trim();
    const host = target.hostname.toLowerCase().replace(/^www\./, "");
    if (!expectedDomain || (host !== expectedDomain && !host.endsWith("." + expectedDomain))) {
      return reply(403, { success: false, message: "The URL is not on the registered official domain of this authority." });
    }

    const duplicate = await sdk.table("source_document_versions_c")
      .select(["Name"])
      .where(eq("document_url_c", target.toString()))
      .page(1, 1)
      .fetch();
    if (!duplicate.success) {
      return reply(502, { success: false, message: "Existing source records could not be checked." });
    }
    if ((duplicate.data ?? []).length) {
      return reply(409, { success: false, message: "This document has already been retrieved." });
    }

    const fetched = await fetch(target.toString(), {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/pdf" },
      redirect: "follow",
      signal: AbortSignal.timeout(30000)
    });
    if (!fetched.ok) {
      return reply(502, { success: false, message: "The official site returned HTTP " + fetched.status + "." });
    }
    const finalHost = new URL(fetched.url).hostname.toLowerCase().replace(/^www\./, "");
    if (finalHost !== expectedDomain && !finalHost.endsWith("." + expectedDomain)) {
      return reply(403, { success: false, message: "The download redirected away from the official domain." });
    }
    const contentType = String(fetched.headers.get("content-type") || "").toLowerCase();
    const bytes = new Uint8Array(await fetched.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      return reply(422, { success: false, message: "The file is empty or exceeds the 20 MB source limit." });
    }
    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    if (!isPdf || (!contentType.includes("pdf") && !target.pathname.toLowerCase().endsWith(".pdf"))) {
      return reply(422, { success: false, message: "The official link did not return a PDF document." });
    }

    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const checksum = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const now = new Date().toISOString();
    const title = documentTitle || target.pathname.split("/").pop() || "Official document";

    const parent = await sdk.table("source_documents_c").create({
      Name: title,
      source_registry_c: registryId,
      issuing_authority_c: authority.Name,
      source_category_c: "Official",
      document_type_c: "Syllabus",
      official_url_c: target.toString(),
      retrieved_at_c: now,
      rights_status_c: "Unknown",
      verification_status_c: "New",
      ingestion_status_c: "Queued"
    });
    if (!parent.data?.length) {
      return reply(502, { success: false, message: parent.messages?.join("; ") || "Source document was not saved." });
    }
    const parentId = parent.data[0].Id;

    const version = await sdk.table("source_document_versions_c").create({
      Name: title,
      source_document_c: parentId,
      source_registry_c: registryId,
      version_label_c: "Retrieved " + now.slice(0, 10),
      official_title_c: title,
      document_url_c: target.toString(),
      sha256_checksum_c: checksum,
      mime_type_c: "application/pdf",
      file_size_kb_c: Math.round(bytes.byteLength / 1024),
      retrieved_at_c: now,
      rights_status_c: "Unknown",
      rights_notes_c: "Retrieved automatically from an authoritative official domain. Rights and licence must be confirmed by a reviewer before verification.",
      ingestion_status_c: "Retrieved",
      version_status_c: "Current"
    });
    if (!version.data?.length) {
      return reply(502, {
        success: false,
        saved: true,
        message: "Source document was saved but its version could not be stored. " + (version.messages?.join("; ") || "")
      });
    }

    return reply(200, {
      success: true,
      sourceDocumentId: parentId,
      versionId: version.data[0].Id,
      checksum,
      message: "Document retrieved and queued for rights and verification review."
    });
  } catch (error) {
    return reply(502, {
      success: false,
      message: "Official source retrieval could not complete.",
      detail: String(error && error.message ? error.message : error)
    });
  }
});