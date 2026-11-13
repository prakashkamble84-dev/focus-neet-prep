apper.serve(async (req) => {
  const body = await req.json();
  const response = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(String(body.query || "JEE syllabus")));
  const html = await response.text();
  return new Response(JSON.stringify({ success: true, length: html.length }), {
    headers: { "Content-Type": "application/json" }
  });
});