"use strict";
// 依存パッケージなしで、旧DBの移行・サーバ再採点・管理制限・CSVを検証する。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { poolVersion } = require("./scoring");

const routes = new Map();
const saved = [{ id: 1, student_code: "1215", student_name: "旧データ", class_name: "1年2組",
  score: 80, knowledge_score: 30, thinking_score: 50,
  answers: JSON.stringify([{ domain: "A", earned: 8, points: 10 }]),
  started_at: "2026-09-25T00:00:00.000Z", submitted_at: "2026-09-25 01:00:00",
  exam_id: "legacy", verification_status: "legacy_unverified" }];
const migrations = [];
const roster = [];
const app = { disable() {}, use() {}, listen(_port, _host, callback) { callback(); } };
for (const method of ["get", "post", "options"]) {
  app[method] = (route, ...handlers) => routes.set(`${method.toUpperCase()} ${route}`, handlers);
}
const express = () => app;
express.json = () => (_req, _res, next) => next();
class Database {
  pragma(sql) { if (sql.startsWith("table_info")) return ["id", "student_code", "student_name",
    "class_name", "score", "knowledge_score", "thinking_score", "answers", "started_at",
    "submitted_at"].map(name => ({ name })); }
  exec(sql) { if (sql.startsWith("ALTER TABLE")) migrations.push(sql); }
  backup() { return Promise.resolve(); }
  transaction(fn) { return (...args) => fn(...args); }
  prepare(sql) {
    if (sql.includes("INSERT INTO student_roster")) return { run(year, grade, code, name) {
      roster.push({ academic_year: year, grade, student_code: code, student_name: name });
    } };
    if (sql.includes("DELETE FROM student_roster")) return { run(year, grade) {
      for (let i = roster.length - 1; i >= 0; i--) {
        if (roster[i].academic_year === year && roster[i].grade === grade) roster.splice(i, 1);
      }
    } };
    if (sql.includes("FROM student_roster")) return { all(year, grade) {
      return roster.filter(row => row.academic_year === year && row.grade === grade);
    } };
    if (sql.includes("INSERT INTO")) return { run(code, name, className, score, knowledge,
      thinking, answers, started, submitted, examId, version, status, clientScore, mismatch) {
      const id = saved.length + 1;
      saved.push({ id, student_code: code, student_name: name, class_name: className,
        score, knowledge_score: knowledge, thinking_score: thinking,
        answers, started_at: started, submitted_at: submitted, exam_id: examId,
        pool_version: version, verification_status: status,
        client_score: clientScore, score_mismatch: mismatch });
      return { lastInsertRowid: id };
    } };
    if (sql.includes("WHERE exam_id")) return { get(examId, code, started) {
      return saved.find(row => row.exam_id === examId && row.student_code === code && row.started_at === started);
    } };
    return { all() { return [...saved].reverse(); } };
  }
}
function fakeRequire(name) {
  if (name === "express") return express;
  if (name === "better-sqlite3") return Database;
  if (name === "cors") return () => (_req, _res, next) => next();
  if (name === "os") return { networkInterfaces: () => ({}) };
  if (name === "./scoring") return require("./scoring");
  return require(name);
}
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "server.js"), "utf8"), {
  require: fakeRequire, __dirname, process, console: { log() {}, error: console.error },
  Date, Number, String, JSON, Object, Set, Array, RegExp
});

function request(method, route, { address = "127.0.0.1", host = "localhost:3000",
  origin = "", query = {}, body = {} } = {}) {
  const handlers = routes.get(`${method} ${route}`);
  assert.ok(handlers, `missing route ${method} ${route}`);
  const req = { socket: { remoteAddress: address }, get(name) {
    return name === "Host" ? host : name === "Origin" ? origin : "";
  }, query, body };
  const res = { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; },
    set(key, value) { if (typeof key === "string") this.headers[key] = value;
      else Object.assign(this.headers, key); return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
    sendFile(value) { this.body = value; return this; } };
  let index = 0;
  function next() { const handler = handlers[index++]; if (handler) handler(req, res, next); }
  next();
  return res;
}

const old = request("GET", "/api/results");
assert.equal(old.body.results[0].student_name, "旧データ");
assert.equal(old.body.results[0].domains.A.earned, 8);
assert.equal(old.body.results[0].verification_status, "legacy_unverified");
assert.equal(migrations.length, 5);
assert.equal(request("GET", "/api/results", { address: "192.0.2.10" }).statusCode, 403);
assert.equal(request("GET", "/api/results.csv", { host: "evil.example:3000" }).statusCode, 403);
assert.equal(request("GET", "/admin", { address: "192.0.2.10" }).statusCode, 403);

// クライアントと同じ問題生成を使って45問を組み、送信点を偽装しても再採点する。
const browser = vm.createContext({ window: {}, document: { getElementById: () => ({ value: "1215" }) },
  console: { info() {}, error: (...args) => { throw Error(args.join(" ")); } } });
for (const file of ["question-bank.js", "pool/pool-ab.js", "pool/pool-cd.js", "pool/pool-e.js",
  "pool/pool-f.js", "pool/pool-extra.js", "pool/pool-paiza.js", "pool/pool-diagrams.js",
  "pool/pool-actual.js", "pool/pool-engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), browser, { filename: file });
}
const questions = browser.window.generateExamForStudent("1215");
const payload = { studentCode: "1215", studentName: "=SUM(1+1)", className: "9年9組",
  score: 0, knowledgeScore: 0, thinkingScore: 0,
  examId: "practice-2026-09-25", poolVersion,
  answers: questions.map(q => ({ question_id: q.id, response: q.answer,
    earned: 0, correct: false, points: 99 })), startedAt: "2026-09-25T02:00:00.000Z" };
assert.equal(request("POST", "/api/results", {
  origin: "https://other.example", body: payload }).statusCode, 403);
const result = request("POST", "/api/results", {
  address: "192.0.2.10", origin: "https://naturespa.github.io", body: payload });
assert.equal(result.body.success, true);
assert.equal(result.body.verified, true);
assert.equal(result.body.scores.total.earned, 100);
assert.equal(saved.length, 2);
assert.equal(saved[1].score, 100);
assert.equal(saved[1].class_name, "1年2組");
assert.equal(saved[1].score_mismatch, 1);
assert.equal(JSON.parse(saved[1].answers)[0].points !== 99, true);
const duplicate = request("POST", "/api/results", { body: payload });
assert.equal(duplicate.body.duplicate, true);
assert.equal(duplicate.body.scores.total.earned, 100);
assert.equal(saved.length, 2);
assert.equal(request("GET", "/api/results").body.count, 2);
assert.equal(request("GET", "/api/results", { query: { latest: "0" } }).body.count, 2);
assert.equal(request("GET", "/api/results", { query: { exam: "legacy" } }).body.count, 1);
assert.equal(request("POST", "/api/results", { body: { ...payload, examId: "unexpected" } }).statusCode, 409);
assert.equal(request("POST", "/api/results", { body: { ...payload, startedAt: "2026-09-25T03:00:00.000Z",
  answers: payload.answers.map((q, i) => i === 0 ? { ...q, question_id: "wrong" } : q) } }).statusCode, 422);
const csv = request("GET", "/api/results.csv").body;
assert.ok(csv.startsWith("\uFEFF"));
assert.ok(csv.includes("\"'=SUM(1+1)\""));
assert.ok(csv.includes('"server_scored"'));
assert.ok(csv.includes('"100","40","60"'));

// 学校側のCSVだけを読み、同じ年度・学年だけ入れ替え、成績を保持して照合する。
const rosterFile = path.join(__dirname, "meibo.csv");
assert.equal(fs.existsSync(rosterFile), false, "テスト先に実際の meibo.csv がある場合は実行しない");
fs.writeFileSync(rosterFile, "受験番号,氏名\n1215,テスト生徒\n1216,未提出者\n2215,他学年\n");
(async () => {
  try {
    const blocked = request("GET", "/api/roster/preview-file", {
      address: "192.0.2.10", query: { year: "2026", grade: "1" } });
    assert.equal(blocked.statusCode, 403);
    const preview = request("GET", "/api/roster/preview-file", {
      query: { year: "2026", grade: "1" } }).body;
    assert.equal(preview.success, true);
    assert.equal(preview.changes.incoming, 2);
    assert.equal(preview.otherGrades, 1);
    assert.equal(request("POST", "/api/roster/import-file", {
      body: { year: "2026", grade: "1", fileHash: "wrong", expectedExisting: 0 }
    }).statusCode, 409);
    roster.push({ academic_year: "2025", grade: 1, student_code: "1217", student_name: "前年" });
    const imported = request("POST", "/api/roster/import-file", {
      body: { year: "2026", grade: "1", fileHash: preview.fileHash, expectedExisting: 0 }
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(imported.body.success, true);
    assert.equal(roster.length, 3);
    assert.equal(saved.length, 2);
    const status = request("GET", "/api/roster/status", {
      query: { year: "2026", grade: "1", exam: "practice-2026-09-25" } }).body;
    assert.equal(status.registered, 2);
    assert.equal(status.submitted, 1);
    assert.equal(status.missing, 1);
    assert.equal(status.nameMismatches, 1);
    assert.equal(status.rows[0].status, "氏名不一致");
    assert.ok(request("GET", "/api/roster/status.csv", {
      query: { year: "2026", grade: "1" } }).body.includes("未提出"));
    fs.writeFileSync(rosterFile, "受験番号,氏名\n1215,別人\n");
    const newPreview = request("GET", "/api/roster/preview-file", {
      query: { year: "2026", grade: "1" } }).body;
    assert.equal(newPreview.changes.removed, 1);
    assert.equal(newPreview.changes.changed, 1);
    const outdated = request("POST", "/api/roster/import-file", {
      body: { year: "2026", grade: "1", fileHash: preview.fileHash, expectedExisting: 2 }
    });
    assert.equal(outdated.statusCode, 409);
    assert.equal(roster.length, 3);
    console.log("server.test.js: OK");
  } finally {
    fs.unlinkSync(rosterFile);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
