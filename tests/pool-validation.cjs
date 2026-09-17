const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const files = [
  "question-bank.js",
  "pool/pool-ab.js",
  "pool/pool-cd.js",
  "pool/pool-e.js",
  "pool/pool-f.js",
  "pool/pool-extra.js",
  "pool/pool-paiza.js",
  "pool/pool-diagrams.js",
  "pool/pool-actual.js",
  "pool/pool-engine.js"
];

const context = vm.createContext({
  console,
  document: { getElementById: () => null },
  window: {}
});
context.window = context;
for (const file of files) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

assert.equal(context.PYCBT_POOL_SIZE, 240);
assert.deepEqual(Array.from(context.validateQuestionPool()), []);

const allQuestionIds = new Set();
for (let grade = 1; grade <= 3; grade += 1) {
  for (let classNo = 1; classNo <= 7; classNo += 1) {
    for (let attendance = 1; attendance <= 40; attendance += 1) {
      const studentId = `${grade}${classNo}${String(attendance).padStart(2, "0")}`;
      const questions = Array.from(context.generateExamForStudent(studentId));
      const errors = Array.from(context.validateBlueprint(questions));
      assert.deepEqual(errors, [], `${studentId}: ${errors.join(" / ")}`);
      assert.equal(questions.reduce((sum, q) => sum + q.points, 0), 100);
      assert.equal(questions.filter(q => q.viewpoint === "knowledge").reduce((sum, q) => sum + q.points, 0), 40);
      assert.equal(questions.filter(q => q.viewpoint === "thinking").reduce((sum, q) => sum + q.points, 0), 60);
      assert.equal(questions.filter(q => q.format === "choice").length, 35);
      assert.equal(questions.filter(q => q.format === "input").length, 10);
      assert.equal(questions.filter(q => q.it_passport).length, 10);
      assert.equal(questions.filter(q => q.visual_type !== "none").length, 6);
      const actualQuestions = questions.filter(q => q.source_type === "it_passport_actual");
      assert.ok(questions.every(q => ["it_passport_actual", "it_passport_similar", "original"].includes(q.source_type)));
      assert.ok(actualQuestions.every(q => q.source_year === "令和6年度" && q.source_period === "公開問題" && q.source_question_no && q.source_label && q.source_url && q.source_answer_url));
      assert.ok(actualQuestions.every(q => q.source_modified === false && q.source_supplemental_visual === true));
      assert.ok(questions.every(q => q.source_type === "it_passport_actual" || (!q.source_year && !q.source_period && !q.source_question_no && !q.source_label && !q.source_url && !q.source_answer_url)));

      const chapters = questions.filter(q => q.paiza_chapter).map(q => q.paiza_chapter).sort((a, b) => a - b);
      assert.deepEqual(chapters, Array.from({ length: 15 }, (_, i) => i + 1));
      for (const question of questions) {
        allQuestionIds.add(question.id);
        if (question.format === "choice") {
          assert.equal(question.choices.length, 4, question.id);
          assert.equal(new Set(question.choices).size, 4, question.id);
          assert.ok(question.choices.includes(question.answer), question.id);
        } else {
          assert.ok(question.acceptable_answers.includes(question.answer), question.id);
        }
      }
    }
  }
}

assert.equal(allQuestionIds.size, 240, `到達できた問題は${allQuestionIds.size}問です。`);
assert.equal(context.PYCBT_ACTUAL_SOURCE_COUNT, 10);
assert.equal(JSON.stringify(context.auditSourceTypes("1221")), JSON.stringify({ it_passport_actual: 5, it_passport_similar: 0, original: 40 }));
assert.equal(JSON.stringify(context.auditSourceTypes("1222")), JSON.stringify({ it_passport_actual: 5, it_passport_similar: 0, original: 40 }));
assert.equal(JSON.stringify(Array.from(context.generateExamForStudent("1221")).filter(q => q.source_type === "it_passport_actual").map(q => q.source_question_no).sort((a,b) => a-b)), JSON.stringify([68,69,71,72,73]));
assert.equal(JSON.stringify(Array.from(context.generateExamForStudent("1222")).filter(q => q.source_type === "it_passport_actual").map(q => q.source_question_no).sort((a,b) => a-b)), JSON.stringify([70,74,75,76,78]));
console.log("OK: 840受験セット、45問・100点・観点40/60・4択35/入力10・IT関連10・図表6・Chap.1〜15・問題プール240問・IPA実問題10問・出典分類");
