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

const lookupId = (value) => {
  if (value && typeof value === "object") {
    return String(value.Id ?? value.id ?? value.value ?? "");
  }
  return String(value ?? "");
};

const clean = (value, max = 1200) => String(value ?? "").trim().slice(0, max);

const splitAnswer = (value) => {
  const values = Array.isArray(value) ? value : String(value ?? "").split(/[,;+\s]+/);
  return [...new Set(values.map((item) => String(item).trim().toUpperCase()).filter(Boolean))].sort();
};

const isCorrectAnswer = (submitted, answerKey, questionType) => {
  if (questionType === "Numeric") {
    const left = Number(clean(submitted, 120).replace(/,/g, ""));
    const right = Number(clean(answerKey, 120).replace(/,/g, ""));
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    return Math.abs(left - right) <= 0.0001 * Math.max(1, Math.abs(right));
  }
  const left = splitAnswer(submitted);
  const right = splitAnswer(answerKey);
  return left.length > 0 &&
    left.length === right.length &&
    left.every((item, index) => item === right[index]);
};

const normaliseAnswer = (question, value) => {
  if (question.type === "Numeric") return clean(value, 40);
  const list = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(list.map((item) => clean(item, 4).toUpperCase()).filter(Boolean))].sort().join(",");
};

const grade = (question, value) => {
  const answer = normaliseAnswer(question, value);
  const correctAnswer = question.type === "Numeric"
    ? question.answerKey
    : question.choices.filter((choice) => choice.correct).map((choice) => choice.key).sort().join(",");

  if (!answer) {
    return { answer: "", correctAnswer, status: "unattempted", marks: 0 };
  }

  const correct = isCorrectAnswer(answer, correctAnswer, question.type);
  return {
    answer,
    correctAnswer,
    status: correct ? "correct" : "wrong",
    marks: correct ? question.marks : -question.negativeMarks
  };
};

const TEST_QUESTION_FIELDS = ["Id", "question_c", "sequence_c", "section_code_c", "marks_c", "negative_marks_c", "status_c"];
const QUESTION_FIELDS = ["Id", "Name", "question_type_c", "question_body_c", "answer_key_c", "solution_c"];
const OPTION_FIELDS = ["Id", "question_c", "option_key_c", "option_text_c", "sequence_c", "is_correct_c", "status_c"];

const loadTestQuestions = async (testId) => {
  const { eq, and, isIn } = sdk.core;

  const linkResult = await sdk.table("test_questions_c")
    .select(TEST_QUESTION_FIELDS)
    .where(and(eq("test_c", testId), eq("status_c", "Published")))
    .orderBy("sequence_c")
    .limit(200, 0)
    .fetch();

  if (!linkResult.success) {
    throw new Error(linkResult.messages?.join("; ") || linkResult.message || "Test questions could not be loaded.");
  }

  const links = linkResult.data || [];
  const questionIds = [...new Set(links.map((link) => lookupId(link.question_c)).filter(Boolean))];
  if (!questionIds.length) return [];

  const questionResult = await sdk.table("questions_c")
    .select(QUESTION_FIELDS)
    .where(isIn("Id", questionIds))
    .limit(200, 0)
    .fetch();

  if (!questionResult.success) {
    throw new Error(questionResult.messages?.join("; ") || questionResult.message || "Questions could not be loaded.");
  }

  const optionResult = await sdk.table("question_options_c")
    .select(OPTION_FIELDS)
    .where(and(isIn("question_c", questionIds), eq("status_c", "Published")))
    .orderBy("sequence_c")
    .limit(500, 0)
    .fetch();

  if (!optionResult.success) {
    throw new Error(optionResult.messages?.join("; ") || optionResult.message || "Answer options could not be loaded.");
  }

  const questions = new Map((questionResult.data || []).map((question) => [String(question.Id), question]));
  const options = new Map();
  for (const option of optionResult.data || []) {
    const key = lookupId(option.question_c);
    options.set(key, [...(options.get(key) || []), option]);
  }

  return links.flatMap((link) => {
    const questionId = lookupId(link.question_c);
    const question = questions.get(questionId);
    if (!question) return [];

    const type = clean(question.question_type_c, 20);
    const choices = (options.get(questionId) || [])
      .map((option) => ({
        key: clean(option.option_key_c, 4).toUpperCase(),
        text: clean(option.option_text_c, 1000),
        correct: option.is_correct_c === true
      }))
      .filter((choice) => choice.key);

    return [{
      testQuestionId: String(link.Id),
      questionId,
      sequence: Number(link.sequence_c || 0),
      sectionCode: clean(link.section_code_c, 40),
      marks: Number(link.marks_c || 0),
      negativeMarks: Number(link.negative_marks_c || 0),
      type,
      body: clean(question.question_body_c, 4000),
      choices,
      answerKey: clean(question.answer_key_c, 120),
      solution: clean(question.solution_c, 3000)
    }];
  });
};

const publicQuestion = (question) => ({
  testQuestionId: question.testQuestionId,
  sequence: question.sequence,
  sectionCode: question.sectionCode,
  marks: question.marks,
  negativeMarks: question.negativeMarks,
  type: question.type,
  body: question.body,
  options: question.choices.map((choice) => ({ key: choice.key, text: choice.text }))
});

apper.serve(async (req) => {
  const { eq, and } = sdk.core;

  if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });
  if (req.method !== "POST") {
    return send(405, { success: false, message: "Use POST." });
  }

  try {
    const body = await req.json();
    const action = clean(body.action, 20);
    const studentUserId = clean(body.studentUserId, 80);

    if (!studentUserId) {
      return send(400, { success: false, message: "A student account is required to sit a test." });
    }

    if (action === "start") {
      const testId = clean(body.testId, 80);
      if (!testId) {
        return send(400, { success: false, message: "Choose a test first." });
      }

      const testResult = await sdk.table("tests_c")
        .select(["Id", "Name", "status_c", "duration_minutes_c"])
        .get(testId);

      if (!testResult.success || !testResult.data || testResult.data.status_c !== "Published") {
        return send(404, { success: false, message: "This test is not available." });
      }

      const test = testResult.data;
      const questions = await loadTestQuestions(testId);
      if (!questions.length) {
        return send(409, {
          success: false,
          code: "TEST_EMPTY",
          message: "This test has no published questions yet."
        });
      }

      const attemptsResult = await sdk.table("test_attempts_c")
        .select(["Id", "status_c", "attempt_number_c", "started_at_c"])
        .where(and(eq("test_c", testId), eq("student_user_c", studentUserId)))
        .orderByDesc("attempt_number_c")
        .limit(100, 0)
        .fetch();

      if (!attemptsResult.success) {
        return send(400, {
          success: false,
          message: attemptsResult.messages?.join("; ") || attemptsResult.message || "Your attempts could not be loaded."
        });
      }

      const attempts = attemptsResult.data || [];
      let attempt = attempts.find((item) => item.status_c === "Started") || null;

      if (!attempt) {
        const attemptNumber = Number(attempts[0]?.attempt_number_c || 0) + 1;
        const startedAt = new Date().toISOString();
        const created = await sdk.table("test_attempts_c").create({
          Name: clean(test.Name, 180) + " · attempt " + attemptNumber,
          test_c: testId,
          student_user_c: studentUserId,
          attempt_number_c: attemptNumber,
          status_c: "Started",
          started_at_c: startedAt
        });

        if (!created.data?.length) {
          return send(400, {
            success: false,
            message: created.messages?.join("; ") || created.message || "Your attempt could not be started. Check student access and retry."
          });
        }

        attempt = { Id: created.data[0].Id, attempt_number_c: attemptNumber, started_at_c: startedAt };
      }

      return send(200, {
        success: true,
        attempt: {
          id: String(attempt.Id),
          number: Number(attempt.attempt_number_c || 0),
          startedAt: attempt.started_at_c,
          durationMinutes: Number(test.duration_minutes_c || 0)
        },
        questions: questions.map(publicQuestion)
      });
    }

    if (action === "submit") {
      const attemptId = clean(body.attemptId, 80);
      if (!attemptId) {
        return send(400, { success: false, message: "Start a test before submitting." });
      }

      const attemptResult = await sdk.table("test_attempts_c")
        .select(["Id", "test_c", "student_user_c", "status_c", "started_at_c"])
        .get(attemptId);
      const attempt = attemptResult.data;

      if (!attemptResult.success || !attempt || lookupId(attempt.student_user_c) !== studentUserId) {
        return send(404, { success: false, message: "This attempt is not available." });
      }

      if (attempt.status_c !== "Started") {
        return send(409, {
          success: false,
          code: "ATTEMPT_CLOSED",
          message: "This attempt has already been submitted."
        });
      }

      const questions = await loadTestQuestions(lookupId(attempt.test_c));
      const submittedById = new Map(
        (Array.isArray(body.responses) ? body.responses : []).map((item) => [
          clean(item?.testQuestionId, 80),
          item?.answer
        ])
      );

      const graded = questions.map((question) => ({
        question,
        ...grade(question, submittedById.get(question.testQuestionId))
      }));
      const answered = graded.filter((item) => item.status !== "unattempted");
      const evaluatedAt = new Date().toISOString();
      const startedMs = Date.parse(attempt.started_at_c);
      const timeSpentSeconds = Number.isFinite(startedMs)
        ? Math.max(0, Math.round((Date.now() - startedMs) / 1000))
        : 0;

      if (answered.length) {
        const saved = await sdk.table("test_responses_c").create(answered.map((item) => ({
          Name: "Response · Q" + item.question.sequence,
          student_user_c: studentUserId,
          test_attempt_c: attemptId,
          test_question_c: item.question.testQuestionId,
          question_c: item.question.questionId,
          selected_answer_c: item.question.type === "Numeric" ? "" : item.answer,
          numerical_answer_c: item.question.type === "Numeric" ? item.answer : ""
        })));

        if (!saved.data?.length) {
          return send(400, {
            success: false,
            message: saved.messages?.join("; ") || saved.message || "Your responses could not be saved. Check student access and retry."
          });
        }
      }

      const updated = await sdk.table("test_attempts_c").update({
        Id: attemptId,
        status_c: "Evaluated",
        submitted_at_c: evaluatedAt,
        time_spent_seconds_c: timeSpentSeconds
      });

      if (!updated.data?.length) {
        return send(400, {
          success: false,
          message: updated.messages?.join("; ") || updated.message || "Your attempt could not be closed. Retry the submission."
        });
      }

      const count = (status) => graded.filter((item) => item.status === status).length;

      return send(200, {
        success: true,
        evaluatedAt,
        timeSpentSeconds,
        totalMarks: questions.reduce((sum, question) => sum + question.marks, 0),
        scoreObtained: graded.reduce((sum, item) => sum + item.marks, 0),
        correctCount: count("correct"),
        wrongCount: count("wrong"),
        unattemptedCount: count("unattempted"),
        breakdown: graded.map((item) => ({
          testQuestionId: item.question.testQuestionId,
          sequence: item.question.sequence,
          status: item.status,
          submittedAnswer: item.answer,
          correctAnswer: item.correctAnswer,
          marks: item.marks,
          solution: item.question.solution
        }))
      });
    }

    return send(400, {
      success: false,
      message: "Unsupported mock test action."
    });
  } catch (error) {
    return send(502, {
      success: false,
      code: "MOCK_TEST_FAILED",
      message: String(error?.message || error).slice(0, 600)
    });
  }
});