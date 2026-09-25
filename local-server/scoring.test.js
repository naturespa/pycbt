"use strict";

// 公開画面が生成する280人分の問題と、校内サーバの正答データを照合する。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { scoreExam, poolVersion } = require("./scoring");

const context = vm.createContext({ window: {}, document: { getElementById: () => ({ value: "1221" }) },
  console: { info() {}, error: (...args) => { throw Error(args.join(" ")); } } });
for (const file of ["question-bank.js", "pool/pool-ab.js", "pool/pool-cd.js", "pool/pool-e.js",
  "pool/pool-f.js", "pool/pool-extra.js", "pool/pool-paiza.js", "pool/pool-diagrams.js",
  "pool/pool-actual.js", "pool/pool-engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
}
assert.equal(context.window.PYCBT_POOL_VERSION, poolVersion);
let checked = 0;
for (let classNo = 1; classNo <= 7; classNo += 1) {
  for (let attendance = 1; attendance <= 40; attendance += 1) {
    const code = `1${classNo}${String(attendance).padStart(2, "0")}`;
    const questions = context.window.generateExamForStudent(code);
    const submitted = questions.map(q => ({ question_id: q.id, response: q.answer }));
    const result = scoreExam(code, submitted, poolVersion);
    assert.equal(result.scores.total.earned, 100, code);
    assert.equal(result.scores.knowledge.earned, 40, code);
    assert.equal(result.scores.thinking.earned, 60, code);
    checked += 1;
  }
}
assert.equal(checked, 280);
console.log(`scoring.test.js: ${checked}人分の正答を照合`);
