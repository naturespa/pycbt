"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { scoreExam, poolVersion } = require("./scoring");

async function scenario({ networkFails = false, alteredClientPoint = false } = {}) {
  const elements = new Map(), storage = new Map([["pycbt:server-ip", "192.0.2.10"]]);
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, {
      hidden: false, open: false, textContent: "", innerHTML: "",
      addEventListener() {}, close() {}
    });
    return elements.get(id);
  } };
  const localStorage = { setItem(k, v) { storage.set(k, v); },
    getItem(k) { return storage.get(k) ?? null; }, removeItem(k) { storage.delete(k); } };
  const browser = vm.createContext({ window: { scrollTo() {} }, document, localStorage,
    AbortController, setTimeout, clearTimeout, clearInterval() {},
    console: { info() {}, error() {} } });
  for (const file of ["question-bank.js", "pool/pool-ab.js", "pool/pool-cd.js",
    "pool/pool-e.js", "pool/pool-f.js", "pool/pool-extra.js", "pool/pool-paiza.js",
    "pool/pool-diagrams.js", "pool/pool-actual.js", "pool/pool-engine.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), browser, { filename: file });
  }
  browser.fetch = async (url, options) => {
    assert.ok([...storage.keys()].some(k => k.includes("result:1215")), "通信前に端末へ保存する");
    assert.equal(url, "http://192.0.2.10:3000/api/results");
    if (networkFails) throw Error("通信できません");
    const body = JSON.parse(options.body);
    assert.equal(body.examId, "practice-2026-09-25");
    assert.equal(body.poolVersion, poolVersion);
    const verified = scoreExam(body.studentCode, body.answers, body.poolVersion);
    return { ok: true, json: async () => ({ success: true, verified: true,
      scores: verified.scores, questionResults: verified.questions }) };
  };
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8")
    .replace(/\}\)\(\);\s*$/, "window.__test = { state, submit };\n})();");
  vm.runInContext(app, browser, { filename: "app.js" });
  const { state, submit } = browser.window.__test;
  state.student = { id: "1215", grade: 1, classNo: 2, attendance: 15, name: "テスト太郎" };
  state.questions = browser.window.generateExamForStudent("1215");
  state.answers = Object.fromEntries(state.questions.map(q => [q.id, q.answer]));
  state.startedAt = new Date().toISOString();
  if (alteredClientPoint) state.questions[0].points = 0;
  await submit();
  const status = document.getElementById("server-save-status").textContent;
  const record = JSON.parse([...storage.entries()].find(([k]) => k.includes("result:1215"))[1]);
  if (networkFails) {
    assert.match(status, /送信できませんでした/);
    assert.equal(record.assessment.server_verified, undefined);
  } else {
    assert.match(status, alteredClientPoint ? /差がある/ : /再採点し/);
    assert.equal(record.assessment.server_verified, true);
    assert.equal(record.scores.total.earned, 100);
    assert.equal(record.questions.reduce((n, q) => n + q.points, 0), 100);
  }
}

(async () => {
  await scenario();
  await scenario({ alteredClientPoint: true });
  await scenario({ networkFails: true });
  console.log("client-flow.test.js: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
