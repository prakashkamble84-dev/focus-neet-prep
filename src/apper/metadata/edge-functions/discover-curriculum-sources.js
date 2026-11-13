apper.serve(async (req) => {
  return new Response(JSON.stringify({ success: true, results: [] }), {
    headers: { "Content-Type": "application/json" }
  });
});