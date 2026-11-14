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

apper.serve(async (req) => {
  const { eq, and, or, isIn } = sdk.core;

  if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });
  if (req.method !== "POST") {
    return send(405, { success: false, message: "Use POST." });
  }

  try {
    const body = await req.json();
    const action = clean(body.action, 20);

    if (action === "start") {
      const examinationId = clean(body.examinationId, 80);
      if (!examinationId) {
        return send(400, { success: false, message: "Choose an examination first." });
      }

      const candidates = await sdk.table("questions_c")
        .select([
          "Id",
          "Name",
          "question_body_c",
          "examination_c",
          "question_type_c",
          "difficulty_c",
          "maximum_marks_c",
          "negative_marks_c",
          "curriculum_node_c"
        ])
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

      if (!candidates.success) {
        return send(400, {
          success: false,
          message: candidates.messages?.join("; ") || candidates.message || "Published diagnostic questions could not be loaded."
        });
      }

      const pool = candidates.data || [];
      if (pool.length < 5) {
        return send(409, {
          success: false,
          code: "DIAGNOSTIC_QUESTION_POOL_TOO_SMALL",
          available: pool.length,
          required: 5,
          message: "At least five published questions with verified answers and cleared rights are needed for a useful baseline. The available pool is too small."
        });
      }

      const shuffled = [...pool];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
      }

      const selected = shuffled.slice(0, Math.min(10, shuffled.length));
      const questionIds = selected.map((question) => String(question.Id));
      const optionResult = await sdk.table("question_options_c")
        .select([
          "Id",
          "question_c",
          "option_key_c",
          "option_text_c",
          "sequence_c"
        ])
        .where(and(
          isIn("question_c", questionIds),
          eq("status_c", "Published")
        ))
        .orderBy("sequence_c")
        .limit(400, 0)
        .fetch();

      if (!optionResult.success) {
        return send(400, {
          success: false,
          message: optionResult.messages?.join("; ") || optionResult.message || "Published answer options could not be loaded."
        });
      }

      const optionsByQuestion = new Map();
      for (const option of optionResult.data || []) {
        const questionId = lookupId(option.question_c);
        if (!optionsByQuestion.has(questionId)) optionsByQuestion.set(questionId, []);
        optionsByQuestion.get(questionId).push({
          label: clean(option.option_key_c, 4),
          text: clean(option.option_text_c, 1600)
        });
      }

      const nodeIds = [...new Set(selected
        .map((question) => lookupId(question.curriculum_node_c))
        .filter(Boolean))];
      let nodesById = new Map();

      if (nodeIds.length) {
        const nodeResult = await sdk.table("curriculum_nodes_c")
          .select(["Id", "Name", "subject_c", "node_path_c"])
          .where(isIn("Id", nodeIds))
          .limit(100, 0)
          .fetch();

        if (nodeResult.success) {
          nodesById = new Map((nodeResult.data || []).map((node) => [String(node.Id), node]));
        }
      }

      const questions = selected.map((question, index) => {
        const nodeId = lookupId(question.curriculum_node_c);
        const node = nodesById.get(nodeId) || null;
        return {
          id: String(question.Id),
          number: index + 1,
          title: clean(question.Name, 180),
          questionText: clean(question.question_body_c, 5000),
          questionType: question.question_type_c,
          difficulty: question.difficulty_c || "Moderate",
          maximumMarks: Number(question.maximum_marks_c || 0),
          negativeMarks: Number(question.negative_marks_c || 0),
          conceptId: nodeId || null,
          conceptName: node?.node_path_c || node?.Name || question.Name,
          subject: node?.subject_c || "",
          options: optionsByQuestion.get(String(question.Id)) || []
        };
      });

      return send(200, {
        success: true,
        examinationId,
        questionCount: questions.length,
        availableQuestionPool: pool.length,
        questions
      });
    }

    if (action === "submit") {
      const examinationId = clean(body.examinationId, 80);
      const studentUserId = clean(body.studentUserId, 80);
      const responses = Array.isArray(body.responses) ? body.responses.slice(0, 10) : [];

      if (!examinationId || !studentUserId || !responses.length) {
        return send(400, {
          success: false,
          message: "A student account, examination and at least one diagnostic response are required."
        });
      }

      const responseIds = responses.map((item) => clean(item.questionId, 80));
      if (responseIds.some((id) => !id) || new Set(responseIds).size !== responseIds.length) {
        return send(400, {
          success: false,
          message: "The response list contains a missing or duplicate question."
        });
      }

      const questionResult = await sdk.table("questions_c")
        .select([
          "Id",
          "Name",
          "question_body_c",
          "question_type_c",
          "answer_key_c",
          "solution_c",
          "maximum_marks_c",
          "negative_marks_c",
          "curriculum_node_c"
        ])
        .where(and(
          eq("examination_c", examinationId),
          isIn("Id", responseIds),
          eq("status_c", "Published"),
          eq("answer_validation_status_c", "Verified"),
          or(
            eq("rights_status_c", "Public"),
            eq("rights_status_c", "Licensed")
          )
        ))
        .limit(20, 0)
        .fetch();

      if (!questionResult.success) {
        return send(400, {
          success: false,
          message: questionResult.messages?.join("; ") || questionResult.message || "The diagnostic answer set could not be verified."
        });
      }

      const questions = questionResult.data || [];
      if (questions.length !== responseIds.length) {
        return send(409, {
          success: false,
          message: "One or more diagnostic questions are no longer eligible. Restart the diagnostic to refresh the question set."
        });
      }

      const questionsById = new Map(questions.map((question) => [String(question.Id), question]));
      const optionResult = await sdk.table("question_options_c")
        .select([
          "question_c",
          "option_key_c",
          "is_correct_c",
          "status_c"
        ])
        .where(and(
          isIn("question_c", responseIds),
          eq("status_c", "Published")
        ))
        .limit(400, 0)
        .fetch();

      if (!optionResult.success) {
        return send(400, {
          success: false,
          message: optionResult.messages?.join("; ") || optionResult.message || "Answer validation data could not be loaded."
        });
      }

      const correctOptionsByQuestion = new Map();
      for (const option of optionResult.data || []) {
        if (option.is_correct_c !== true) continue;
        const questionId = lookupId(option.question_c);
        if (!correctOptionsByQuestion.has(questionId)) correctOptionsByQuestion.set(questionId, []);
        correctOptionsByQuestion.get(questionId).push(clean(option.option_key_c, 4).toUpperCase());
      }

      const evaluatedAt = new Date().toISOString();
      const evaluation = responses.map((item) => {
        const question = questionsById.get(clean(item.questionId, 80));
        const submittedAnswer = Array.isArray(item.answer)
          ? item.answer.map((value) => clean(value, 8)).filter(Boolean).join(",")
          : clean(item.answer, 120);
        const selected = submittedAnswer.trim();
        const correctAnswer = question.question_type_c === "Numeric"
          ? clean(question.answer_key_c, 120)
          : (correctOptionsByQuestion.get(String(question.Id)) || []).sort().join(",");
        const answerCorrect = isCorrectAnswer(
          submittedAnswer,
          question.question_type_c === "Numeric" ? question.answer_key_c : correctAnswer,
          question.question_type_c
        );
        const confidence = ["Low", "Medium", "High"].includes(item.confidence)
          ? item.confidence
          : "Medium";
        const maximumMarks = Number(question.maximum_marks_c || 0);
        const negativeMarks = Number(question.negative_marks_c || 0);
        const scoreAwarded = !selected ? 0 : answerCorrect ? maximumMarks : -negativeMarks;

        return {
          question,
          questionId: String(question.Id),
          selected,
          answered: Boolean(selected),
          answerCorrect,
          correctAnswer,
          confidence,
          maximumMarks,
          negativeMarks,
          scoreAwarded
        };
      });

      const attempted = evaluation.filter((item) => item.answered);
      const attemptRecords = attempted.map((item) => ({
        Name: "Diagnostic · " + item.question.Name + " · " + evaluatedAt,
        selected_answer_c: item.question.question_type_c === "Numeric" ? "" : item.selected,
        numerical_response_c: item.question.question_type_c === "Numeric" ? item.selected : "",
        is_correct_c: item.answerCorrect,
        score_awarded_c: item.scoreAwarded,
        confidence_c: item.confidence,
        hints_used_c: 0,
        attempt_source_c: "Diagnostic",
        attempted_at_c: evaluatedAt,
        student_user_c: studentUserId,
        question_c: item.question.Id
      }));

      let savedAttempts = [];
      if (attemptRecords.length) {
        const saved = await sdk.table("student_attempts_c").create(attemptRecords);
        savedAttempts = saved.data || [];
        if (!savedAttempts.length) {
          return send(400, {
            success: false,
            message: saved.messages?.join("; ") || saved.message || "Diagnostic attempts could not be saved. Check student access and retry."
          });
        }
      }

      const savedQuestionIds = new Set(savedAttempts.map((record) => lookupId(record.question_c)).filter(Boolean));
      const savedEvaluation = attempted.filter((item) => savedQuestionIds.has(item.questionId));
      const conceptGroups = new Map();

      for (const item of savedEvaluation) {
        const conceptId = lookupId(item.question.curriculum_node_c);
        if (!conceptId) continue;
        if (!conceptGroups.has(conceptId)) {
          conceptGroups.set(conceptId, {
            conceptId,
            conceptName: item.question.Name,
            attempts: 0,
            correct: 0,
            confidenceTotal: 0
          });
        }
        const group = conceptGroups.get(conceptId);
        group.attempts += 1;
        if (item.answerCorrect) group.correct += 1;
        group.confidenceTotal += confidenceValue(item.confidence);
      }

      const masteryWarnings = [];
      const masteryResults = [];

      for (const group of conceptGroups.values()) {
        const existing = await sdk.table("student_concept_mastery_c")
          .select([
            "Id",
            "mastery_score_c",
            "mastery_status_c",
            "attempt_count_c",
            "correct_count_c",
            "confidence_score_c",
            "evidence_count_c"
          ])
          .where(eq("student_user_c", studentUserId))
          .where(eq("curriculum_node_c", group.conceptId))
          .limit(1, 0)
          .fetch();

        if (!existing.success) {
          masteryWarnings.push(group.conceptName + ": existing mastery could not be read.");
          continue;
        }

        const previous = existing.data?.[0] || null;
        const previousAttempts = Number(previous?.attempt_count_c || 0);
        const previousCorrect = Number(previous?.correct_count_c || 0);
        const previousEvidence = Number(previous?.evidence_count_c || 0);
        const totalAttempts = previousAttempts + group.attempts;
        const totalCorrect = previousCorrect + group.correct;
        const score = totalAttempts ? totalCorrect / totalAttempts : 0;
        const oldConfidence = Number(previous?.confidence_score_c || 0);
        const confidenceCount = previousAttempts;
        const newConfidence = group.confidenceTotal / group.attempts;
        const confidenceScore = totalAttempts
          ? ((oldConfidence * confidenceCount) + (newConfidence * group.attempts)) / totalAttempts
          : newConfidence;
        const updateValues = {
          mastery_score_c: score,
          mastery_status_c: masteryStatus(totalAttempts, score),
          attempt_count_c: totalAttempts,
          correct_count_c: totalCorrect,
          confidence_score_c: confidenceScore,
          evidence_count_c: previousEvidence + group.attempts,
          last_assessed_at_c: evaluatedAt
        };

        let savedMastery;
        if (previous) {
          savedMastery = await sdk.table("student_concept_mastery_c").update({
            Id: previous.Id,
            ...updateValues
          });
        } else {
          savedMastery = await sdk.table("student_concept_mastery_c").create({
            Name: group.conceptName + " · student mastery",
            student_user_c: studentUserId,
            curriculum_node_c: group.conceptId,
            ...updateValues
          });
        }

        if (!savedMastery.data?.length) {
          masteryWarnings.push(group.conceptName + ": mastery summary could not be saved.");
          continue;
        }

        masteryResults.push({
          conceptId: group.conceptId,
          conceptName: group.conceptName,
          attemptCount: totalAttempts,
          correctCount: totalCorrect,
          score,
          status: masteryStatus(totalAttempts, score)
        });
      }

      const correct = savedEvaluation.filter((item) => item.answerCorrect).length;
      const incorrect = savedEvaluation.length - correct;
      const unattempted = evaluation.length - attempted.length;
      const maximumScore = evaluation.reduce((sum, item) => sum + item.maximumMarks, 0);
      const score = savedEvaluation.reduce((sum, item) => sum + item.scoreAwarded, 0);
      const percentage = maximumScore > 0 ? Math.max(0, Math.min(100, (score / maximumScore) * 100)) : null;

      const feedback = evaluation.map((item) => ({
        questionId: item.questionId,
        questionName: item.question.Name,
        answered: item.answered,
        correct: item.answered ? item.answerCorrect : null,
        submittedAnswer: item.selected,
        correctAnswer: item.correctAnswer,
        solution: clean(item.question.solution_c, 3000)
      }));

      return send(200, {
        success: true,
        evaluatedAt,
        questionCount: evaluation.length,
        attemptedCount: savedEvaluation.length,
        correctCount: correct,
        incorrectCount: incorrect,
        unattemptedCount: unattempted + (attempted.length - savedEvaluation.length),
        score,
        maximumScore,
        percentage,
        mastery: masteryResults,
        masteryWarnings,
        feedback
      });
    }

    return send(400, {
      success: false,
      message: "Unsupported diagnostic action."
    });
  } catch (error) {
    return send(502, {
      success: false,
      code: "STUDENT_DIAGNOSTIC_FAILED",
      message: String(error?.message || error).slice(0, 600)
    });
  }
});