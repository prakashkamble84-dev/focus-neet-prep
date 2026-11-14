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
  const actual = clean(submitted, 120).replace(/,/g, "");
  const expected = clean(answerKey, 120).replace(/,/g, "");

  if (!actual) return false;

  if (questionType === "Numeric") {
    const left = Number(actual);
    const right = Number(expected);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    return Math.abs(left - right) <= 0.0001 * Math.max(1, Math.abs(right));
  }

  const left = splitAnswer(submitted);
  const right = splitAnswer(answerKey);
  return left.length > 0 &&
    left.length === right.length &&
    left.every((item, index) => item === right[index]);
};

const confidenceValue = (value) => {
  if (value === "High") return 0.9;
  if (value === "Low") return 0.4;
  return 0.65;
};

const masteryStatus = (attemptCount, score) => {
  if (attemptCount < 1) return "New";
  if (attemptCount < 3) return "Learning";
  return score >= 0.85 ? "Secure" : "Practising";
};

const QUESTION_FIELDS = [
  "Id",
  "Name",
  "question_body_c",
  "examination_c",
  "question_type_c",
  "difficulty_c",
  "maximum_marks_c",
  "negative_marks_c",
  "curriculum_node_c"
];

apper.serve(async (req) => {
  const { eq, and, or, isIn } = sdk.core;

  if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });
  if (req.method !== "POST") {
    return send(405, { success: false, message: "Use POST." });
  }

  try {
    const body = await req.json();
    const action = clean(body.action, 20);
    const studentUserId = clean(body.studentUserId, 80);

    if (!studentUserId) {
      return send(400, { success: false, message: "A student account is required to practise." });
    }

    if (action === "next") {
      const examinationId = clean(body.examinationId, 80);
      if (!examinationId) {
        return send(400, { success: false, message: "Choose an examination first." });
      }

      const recentIds = new Set(
        (Array.isArray(body.recentQuestionIds) ? body.recentQuestionIds : [])
          .slice(0, 50)
          .map((id) => clean(id, 80))
          .filter(Boolean)
      );

      const candidateResult = await sdk.table("questions_c")
        .select(QUESTION_FIELDS)
        .where(and(
          eq("examination_c", examinationId),
          eq("status_c", "Published"),
          eq("answer_validation_status_c", "Verified"),
          or(
            eq("rights_status_c", "Public"),
            eq("rights_status_c", "Licensed")
          ),
          isIn("question_type_c", ["MCQ", "Multi", "Numeric", "Assert"])
        ))
        .orderByDesc("CreatedOn")
        .limit(60, 0)
        .fetch();

      if (!candidateResult.success) {
        return send(400, {
          success: false,
          message: candidateResult.messages?.join("; ") || candidateResult.message || "Practice questions could not be loaded."
        });
      }

      const pool = candidateResult.data || [];
      if (!pool.length) {
        return send(409, {
          success: false,
          code: "PRACTICE_POOL_EMPTY",
          message: "No verified, published questions are available for this examination yet."
        });
      }

      const masteryResult = await sdk.table("student_concept_mastery_c")
        .select(["Id", "curriculum_node_c", "mastery_score_c", "attempt_count_c"])
        .where(eq("student_user_c", studentUserId))
        .limit(500, 0)
        .fetch();

      if (!masteryResult.success) {
        return send(400, {
          success: false,
          message: masteryResult.messages?.join("; ") || masteryResult.message || "Your concept mastery could not be loaded."
        });
      }

      const masteryByConcept = new Map();
      for (const row of masteryResult.data || []) {
        const conceptId = lookupId(row.curriculum_node_c);
        if (conceptId) masteryByConcept.set(conceptId, row);
      }

      const unseen = pool.filter((question) => !recentIds.has(String(question.Id)));
      const eligible = unseen.length ? unseen : pool;
      const ranked = eligible
        .map((question) => {
          const conceptId = lookupId(question.curriculum_node_c);
          const row = conceptId ? masteryByConcept.get(conceptId) : null;
          const mastery = row ? Math.max(0, Math.min(1, Number(row.mastery_score_c || 0))) : null;
          return {
            question,
            conceptId,
            mastery,
            attempts: Number(row?.attempt_count_c || 0),
            tieBreak: Math.random()
          };
        })
        .sort((left, right) => (left.mastery ?? 0.5) - (right.mastery ?? 0.5) || left.tieBreak - right.tieBreak);

      const chosen = ranked[0];
      const question = chosen.question;
      const isNumeric = question.question_type_c === "Numeric";

      const optionResult = await sdk.table("question_options_c")
        .select(["question_c", "option_key_c", "option_text_c", "sequence_c"])
        .where(and(
          isIn("question_c", [String(question.Id)]),
          eq("status_c", "Published")
        ))
        .orderBy("sequence_c")
        .limit(40, 0)
        .fetch();

      if (!optionResult.success) {
        return send(400, {
          success: false,
          message: optionResult.messages?.join("; ") || optionResult.message || "Answer options could not be loaded."
        });
      }

      const options = (optionResult.data || []).map((option) => ({
        label: clean(option.option_key_c, 4),
        text: clean(option.option_text_c, 1600)
      }));

      if (!isNumeric && !options.length) {
        return send(409, {
          success: false,
          code: "PRACTICE_QUESTION_INCOMPLETE",
          message: "The selected question has no published answer options. Try again to load another question."
        });
      }

      let conceptName = question.Name;
      if (chosen.conceptId) {
        const nodeResult = await sdk.table("curriculum_nodes_c")
          .select(["Id", "Name", "node_path_c"])
          .where(isIn("Id", [chosen.conceptId]))
          .limit(1, 0)
          .fetch();
        const node = nodeResult.success ? nodeResult.data?.[0] : null;
        conceptName = node?.node_path_c || node?.Name || conceptName;
      }

      const masteryPercent = chosen.mastery === null ? null : Math.round(chosen.mastery * 100);
      const reason = masteryPercent === null
        ? "This concept is new to you, so it is queued alongside your weakest areas."
        : `${conceptName} is at ${masteryPercent}% mastery after ${chosen.attempts} attempts, so it is up next.`;

      return send(200, {
        success: true,
        question: {
          id: String(question.Id),
          title: clean(question.Name, 180),
          questionText: clean(question.question_body_c, 5000),
          questionType: question.question_type_c,
          difficulty: question.difficulty_c || "Moderate",
          maximumMarks: Number(question.maximum_marks_c || 0),
          negativeMarks: Number(question.negative_marks_c || 0),
          options
        },
        concept: {
          id: chosen.conceptId || null,
          name: conceptName,
          masteryPercent,
          attemptCount: chosen.attempts
        },
        reason
      });
    }

    if (action === "submit") {
      const questionId = clean(body.questionId, 80);
      const rawAnswer = Array.isArray(body.answer)
        ? body.answer.map((value) => clean(value, 8)).filter(Boolean).join(",")
        : clean(body.answer, 120);
      const selected = rawAnswer.trim();
      const confidence = ["Low", "Medium", "High"].includes(body.confidence) ? body.confidence : "Medium";
      const timeSeconds = Math.max(0, Math.min(7200, Math.round(Number(body.timeSeconds) || 0)));

      if (!questionId || !selected) {
        return send(400, { success: false, message: "Choose or enter an answer before submitting." });
      }

      const questionResult = await sdk.table("questions_c")
        .select([
          "Id",
          "Name",
          "question_type_c",
          "answer_key_c",
          "solution_c",
          "maximum_marks_c",
          "negative_marks_c",
          "curriculum_node_c"
        ])
        .where(and(
          isIn("Id", [questionId]),
          eq("status_c", "Published"),
          eq("answer_validation_status_c", "Verified"),
          or(
            eq("rights_status_c", "Public"),
            eq("rights_status_c", "Licensed")
          )
        ))
        .limit(1, 0)
        .fetch();

      if (!questionResult.success) {
        return send(400, {
          success: false,
          message: questionResult.messages?.join("; ") || questionResult.message || "The question could not be verified."
        });
      }

      const question = questionResult.data?.[0];
      if (!question) {
        return send(409, {
          success: false,
          message: "This question is no longer available for practice. Load the next question."
        });
      }

      const isNumeric = question.question_type_c === "Numeric";
      let correctAnswer = clean(question.answer_key_c, 120);

      if (!isNumeric) {
        const optionResult = await sdk.table("question_options_c")
          .select(["question_c", "option_key_c", "is_correct_c", "status_c"])
          .where(and(
            isIn("question_c", [questionId]),
            eq("status_c", "Published")
          ))
          .limit(40, 0)
          .fetch();

        if (!optionResult.success) {
          return send(400, {
            success: false,
            message: optionResult.messages?.join("; ") || optionResult.message || "Answer validation data could not be loaded."
          });
        }

        correctAnswer = (optionResult.data || [])
          .filter((option) => option.is_correct_c === true)
          .map((option) => clean(option.option_key_c, 4).toUpperCase())
          .sort()
          .join(",");
      }

      const answerCorrect = isCorrectAnswer(
        selected,
        isNumeric ? question.answer_key_c : correctAnswer,
        question.question_type_c
      );
      const maximumMarks = Number(question.maximum_marks_c || 0);
      const negativeMarks = Number(question.negative_marks_c || 0);
      const scoreAwarded = answerCorrect ? maximumMarks : -negativeMarks;
      const evaluatedAt = new Date().toISOString();

      const attemptResult = await sdk.table("student_attempts_c").create({
        Name: "Practice · " + question.Name + " · " + evaluatedAt,
        selected_answer_c: isNumeric ? "" : selected,
        numerical_response_c: isNumeric ? selected : "",
        is_correct_c: answerCorrect,
        score_awarded_c: scoreAwarded,
        time_seconds_c: timeSeconds,
        confidence_c: confidence,
        attempt_source_c: "Practice",
        attempted_at_c: evaluatedAt,
        student_user_c: studentUserId,
        question_c: questionId
      });

      if (!attemptResult.data?.length) {
        return send(400, {
          success: false,
          message: attemptResult.messages?.join("; ") || attemptResult.message || "Your answer could not be saved. Check student access and retry."
        });
      }

      let mastery = null;
      let masteryWarning = null;
      const conceptId = lookupId(question.curriculum_node_c);

      if (conceptId) {
        const existingResult = await sdk.table("student_concept_mastery_c")
          .select(["Id", "mastery_score_c", "attempt_count_c", "correct_count_c", "confidence_score_c", "evidence_count_c"])
          .where(eq("student_user_c", studentUserId))
          .where(eq("curriculum_node_c", conceptId))
          .limit(1, 0)
          .fetch();

        if (!existingResult.success) {
          masteryWarning = "Your answer was saved, but concept mastery could not be read.";
        } else {
          const previous = existingResult.data?.[0] || null;
          const previousAttempts = Number(previous?.attempt_count_c || 0);
          const totalAttempts = previousAttempts + 1;
          const totalCorrect = Number(previous?.correct_count_c || 0) + (answerCorrect ? 1 : 0);
          const score = totalCorrect / totalAttempts;
          const confidenceScore = ((Number(previous?.confidence_score_c || 0) * previousAttempts) + confidenceValue(confidence)) / totalAttempts;
          const values = {
            mastery_score_c: score,
            mastery_status_c: masteryStatus(totalAttempts, score),
            attempt_count_c: totalAttempts,
            correct_count_c: totalCorrect,
            confidence_score_c: confidenceScore,
            evidence_count_c: Number(previous?.evidence_count_c || 0) + 1,
            last_assessed_at_c: evaluatedAt
          };

          const saved = previous
            ? await sdk.table("student_concept_mastery_c").update({ Id: previous.Id, ...values })
            : await sdk.table("student_concept_mastery_c").create({
              Name: question.Name + " · student mastery",
              student_user_c: studentUserId,
              curriculum_node_c: conceptId,
              ...values
            });

          if (!saved.data?.length) {
            masteryWarning = "Your answer was saved, but the concept mastery summary could not be updated.";
          } else {
            mastery = {
              percent: Math.round(score * 100),
              status: values.mastery_status_c,
              attemptCount: totalAttempts
            };
          }
        }
      }

      return send(200, {
        success: true,
        evaluatedAt,
        correct: answerCorrect,
        submittedAnswer: selected,
        correctAnswer,
        scoreAwarded,
        maximumMarks,
        solution: clean(question.solution_c, 3000),
        mastery,
        masteryWarning
      });
    }

    return send(400, {
      success: false,
      message: "Unsupported practice action."
    });
  } catch (error) {
    return send(502, {
      success: false,
      code: "ADAPTIVE_PRACTICE_FAILED",
      message: String(error?.message || error).slice(0, 600)
    });
  }
});