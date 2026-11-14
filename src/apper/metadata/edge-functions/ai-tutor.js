const MODEL = "gemini-3.8-flash";
const PROMPT_VERSION = "tutor-v1";
const SUBJECTS = ["Physics", "Chemistry", "Maths", "Biology", "Other"];
const DEPTHS = ["hint", "full"];
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apper-public-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const send = (status, value) => new Response(JSON.stringify(value), {
  status,
  headers: HEADERS
});

const clean = (value, max = 2000) => String(value ?? "").trim().slice(0, max);

const systemPrompt = (subject, depth) => `You are Northstar's AI teacher for JEE and NEET students, subject area: ${subject}.
Teach through reasoning. Explain the concept, the key principle and the method the student should apply.
${depth === "full"
  ? "The student asked for a full worked solution: give the complete steps with units and a dimensional or sanity check."
  : "The student asked for hints first: give a guiding question or a single hint, and do not reveal the final answer or the full solution."}
If the question is not about ${subject} or about studying, politely redirect the student.
Say clearly when you are unsure. Never claim a source, syllabus reference or exam year you cannot verify.`;

async function callTutor(apiKey, input) {
  const result = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ model: MODEL, input })
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    throw new Error(String(data?.error?.message || data?.message || "Provider request failed").slice(0, 450));
  }
  if (data.status && !["completed", "succeeded"].includes(String(data.status).toLowerCase())) {
    throw new Error("Model status " + data.status);
  }
  let text = data.output_text;
  if (!text) {
    const parts = [];
    for (const step of data.steps || []) {
      for (const part of step.content || []) {
        if (part.type === "text" && part.text) parts.push(part.text);
      }
    }
    text = parts.join("\n");
  }
  const reply = String(text || "").trim();
  if (!reply) throw new Error("The provider returned no reply.");
  return {
    reply,
    inputTokens: Number(data.usage?.input_tokens),
    outputTokens: Number(data.usage?.output_tokens)
  };
}

apper.serve(async (req) => {
  const { eq } = sdk.core;

  if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });
  if (req.method !== "POST") {
    return send(405, { success: false, message: "Use POST." });
  }

  try {
    const body = await req.json();
    const message = clean(body.message);
    const studentUserId = clean(body.studentUserId, 80);
    const subject = SUBJECTS.includes(body.subject) ? body.subject : "Other";
    const depth = DEPTHS.includes(body.depth) ? body.depth : "hint";
    const existingConversationId = clean(body.conversationId, 80);

    if (message.length < 3) {
      return send(400, { success: false, message: "Type a question of at least 3 characters." });
    }
    if (String(body.message ?? "").trim().length > 2000) {
      return send(400, { success: false, message: "Keep each question under 2000 characters." });
    }
    if (!studentUserId) {
      return send(401, { success: false, message: "Sign in as a student to use the AI teacher." });
    }

    const apiKey = await apper.getSecret("GEMINI_API_KEY");
    if (!apiKey) {
      return send(503, {
        success: false,
        message: "GEMINI_API_KEY is unavailable to the server function. Verify its value in Apper Secrets Manager."
      });
    }

    const now = new Date().toISOString();
    let conversationId = existingConversationId;

    if (conversationId) {
      const existing = await sdk.table("ai_conversations_c")
        .select(["Id", "status_c"])
        .get(conversationId);
      if (!existing.success || !existing.data) {
        return send(404, { success: false, message: "This conversation is not available." });
      }
      if (existing.data.status_c && existing.data.status_c !== "Open") {
        return send(409, { success: false, message: "This conversation is closed. Start a new one." });
      }
    } else {
      const created = await sdk.table("ai_conversations_c").create({
        Name: `${subject} tutoring session`,
        student_user_c: studentUserId,
        topic_type_c: subject,
        status_c: "Open",
        privacy_level_c: "Private",
        started_at_c: now,
        last_activity_at_c: now
      });
      if (!created.success || !created.data?.length) {
        return send(500, {
          success: false,
          message: (created.messages || []).join("; ") || "Could not start a conversation."
        });
      }
      conversationId = String(created.data[0].Id);
    }

    const history = await sdk.table("ai_messages_c")
      .select(["Id", "message_role_c", "message_body_c", "CreatedOn"])
      .where(eq("conversation_c", conversationId))
      .orderByDesc("CreatedOn")
      .page(1, 12)
      .fetch();
    const priorTurns = history.success && Array.isArray(history.data)
      ? [...history.data].reverse().map((row) => ({
          role: row.message_role_c === "Assistant" ? "Teacher" : "Student",
          text: clean(row.message_body_c, 2000)
        }))
      : [];

    const transcript = priorTurns.map((turn) => `${turn.role}: ${turn.text}`).join("\n");
    const input = [
      systemPrompt(subject, depth),
      transcript ? `Conversation so far:\n${transcript}` : "",
      `Student's new message:\n${message}`,
      "Reply to the student's new message only."
    ].filter(Boolean).join("\n\n");

    let answer;
    try {
      answer = await callTutor(apiKey, input);
    } catch (error) {
      return send(502, {
        success: false,
        message: "The AI teacher could not answer right now: " + String(error.message || error).slice(0, 300)
      });
    }

    const usage = {
      ...(Number.isFinite(answer.inputTokens) ? { input_tokens_c: answer.inputTokens } : {}),
      ...(Number.isFinite(answer.outputTokens) ? { output_tokens_c: answer.outputTokens } : {})
    };

    const saved = await sdk.table("ai_messages_c").create([
      {
        Name: "Student message",
        conversation_c: conversationId,
        student_user_c: studentUserId,
        message_role_c: "Student",
        message_body_c: message
      },
      {
        Name: "Tutor reply",
        conversation_c: conversationId,
        student_user_c: studentUserId,
        message_role_c: "Assistant",
        message_body_c: answer.reply,
        model_provider_c: "Google Gemini",
        model_name_c: MODEL,
        prompt_version_c: PROMPT_VERSION,
        ...usage
      }
    ]);
    if (!saved.success || saved.data?.length < 2) {
      return send(500, {
        success: false,
        message: (saved.messages || []).join("; ") || "The reply could not be saved to your conversation."
      });
    }

    await sdk.table("ai_conversations_c").update({ Id: conversationId, last_activity_at_c: now });

    return send(200, { success: true, conversationId, reply: answer.reply });
  } catch (error) {
    return send(500, { success: false, message: "The AI teacher request failed: " + String(error.message || error).slice(0, 300) });
  }
});