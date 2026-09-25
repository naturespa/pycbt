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
const archives = [];
const settings = new Map();
let backupFails = false;
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
  backup() { return backupFails ? Promise.reject(Error("backup failed")) : Promise.resolve(); }
  transaction(fn) { return (...args) => fn(...args); }
  prepare(sql) {
    if (sql.includes("SELECT setting_value FROM app_settings")) return { get(key) {
      return settings.has(key) ? { setting_value: settings.get(key) } : undefined;
    } };
    if (sql.includes("INSERT OR IGNORE INTO app_settings")) return { run(key, value) {
      if (!settings.has(key)) settings.set(key, value);
    } };
    if (sql.includes("INSERT INTO app_settings")) return { run(key, value) {
      settings.set(key, value);
    } };
    if (sql.includes("INSERT INTO deleted_results")) return { run(id, examId, code, name, submitted, recordJson, backupFile) {
      const archive_id = archives.length + 1;
      archives.push({ archive_id, result_id: id, exam_id: examId, student_code: code,
        student_name: name, submitted_at: submitted, record_json: recordJson,
        delete_backup_file: backupFile, deleted_at: "2026-09-25 03:00:00", restored_at: null });
      return { lastInsertRowid: archive_id };
    } };
    if (sql.includes("FROM deleted_results ORDER BY")) return { all() {
      return archives.slice().reverse().map(({ record_json, ...visible }) => visible);
    } };
    if (sql.includes("FROM deleted_results WHERE archive_id")) return { get(id) {
      return archives.find(row => row.archive_id === id);
    } };
    if (sql.includes("started_at IS ?")) return { get(examId, code, started) {
      return saved.find(row => row.exam_id === examId && row.student_code === code &&
        row.started_at === started);
    } };
    if (sql.includes("UPDATE deleted_results SET restored_at")) return { run(backupFile, id) {
      const entry = archives.find(row => row.archive_id === id && !row.restored_at);
      if (entry) { entry.restore_backup_file = backupFile; entry.restored_at = "2026-09-25 04:00:00"; }
      return { changes: entry ? 1 : 0 };
    } };
    if (sql.includes("INSERT INTO exam_results") && sql.includes("(id, student_code")) return { run(id, code, name,
      className, score, knowledge, thinking, answers, started, submitted, examId, version,
      status, clientScore, mismatch) {
      saved.push({ id, student_code: code, student_name: name, class_name: className,
        score, knowledge_score: knowledge, thinking_score: thinking, answers,
        started_at: started, submitted_at: submitted, exam_id: examId,
        pool_version: version, verification_status: status,
        client_score: clientScore, score_mismatch: mismatch });
      return { changes: 1 };
    } };
    if (sql.includes("DELETE FROM exam_results")) return { run(id, examId, code, submitted) {
      const index = saved.findIndex(row => row.id === id && row.exam_id === examId &&
        row.student_code === code && row.submitted_at === submitted);
      if (index >= 0) saved.splice(index, 1);
      return { changes: index >= 0 ? 1 : 0 };
    } };
    if (sql.includes("FROM exam_results WHERE id = ?")) return { get(id) {
      return saved.find(row => row.id === id);
    } };
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
  require: fakeRequire, __dirname, process, console: { log() {}, error() {} },
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
  examId: "Practice-2026-09-25test", poolVersion,
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
      query: { year: "2026", grade: "1", exam: payload.examId } }).body;
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
    const target = saved.find(row => row.id === 2);
    const deleteBody = { id: target.id, examId: target.exam_id,
      studentCode: target.student_code, submittedAt: target.submitted_at };
    assert.equal(request("POST", "/api/results/delete", {
      address: "192.0.2.10", origin: "http://localhost:3000", body: deleteBody }).statusCode, 403);
    assert.equal(request("POST", "/api/results/delete", {
      origin: "https://other.example", body: deleteBody }).statusCode, 403);
    assert.equal(request("POST", "/api/results/delete", {
      origin: "http://localhost:3000", body: { ...deleteBody, studentCode: "9999" } }).statusCode, 409);
    assert.equal(saved.length, 2);
    const deletion = request("POST", "/api/results/delete", {
      origin: "http://localhost:3000", body: deleteBody });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(deletion.body.success, true);
    assert.equal(deletion.body.archiveId, 1);
    assert.ok(deletion.body.backupFile.endsWith(".db"));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, 1);
    assert.equal(roster.length, 3);
    const history = request("GET", "/api/results/deletions").body.history;
    assert.equal(history.length, 1);
    assert.equal(history[0].result_id, 2);
    assert.equal(history[0].record_json, undefined, "解答内容は履歴APIに出さない");
    assert.equal(request("GET", "/api/results/deletions", { address: "192.0.2.10" }).statusCode, 403);
    assert.equal(request("POST", "/api/results/delete", {
      origin: "http://localhost:3000", body: deleteBody }).statusCode, 409);
    saved.push({ ...target, id: 3, student_code: "1218", student_name: "削除後の新しい提出" });
    const restoreBody = { archiveId: deletion.body.archiveId, resultId: 2 };
    assert.equal(request("POST", "/api/results/restore", {
      origin: "https://other.example", body: restoreBody }).statusCode, 403);
    assert.equal(request("POST", "/api/results/restore", {
      origin: "http://localhost:3000", body: { ...restoreBody, resultId: 3 } }).statusCode, 409);
    assert.equal(saved.length, 2);
    saved.push({ ...target, id: 4 });
    assert.equal(request("POST", "/api/results/restore", {
      origin: "http://localhost:3000", body: restoreBody }).statusCode, 409);
    saved.pop();
    backupFails = true;
    const failedRestore = request("POST", "/api/results/restore", {
      origin: "http://localhost:3000", body: restoreBody });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(failedRestore.statusCode, 500);
    assert.equal(saved.length, 2);
    assert.equal(archives[0].restored_at, null);
    backupFails = false;
    const restored = request("POST", "/api/results/restore", {
      origin: "http://localhost:3000", body: restoreBody });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(restored.body.success, true);
    assert.deepEqual(saved.map(row => row.id).sort(), [1, 2, 3]);
    assert.equal(saved.find(row => row.id === 2).score, 100);
    assert.equal(saved.find(row => row.id === 2).answers, target.answers);
    assert.ok(request("GET", "/api/results/deletions").body.history[0].restored_at);
    assert.equal(request("POST", "/api/results/restore", {
      origin: "http://localhost:3000", body: restoreBody }).statusCode, 409);
    backupFails = true;
    const failedDeletion = request("POST", "/api/results/delete", {
      origin: "http://localhost:3000", body: deleteBody });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(failedDeletion.statusCode, 500);
    assert.equal(saved.length, 3);
    assert.equal(archives.length, 1);
    backupFails = false;
    saved.find(row => row.id === 1).submitted_at = null;
    const legacyBody = { id: 1, examId: "legacy", studentCode: "1215", submittedAt: null };
    const legacyDeletion = request("POST", "/api/results/delete", {
      origin: "http://localhost:3000", body: legacyBody });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(legacyDeletion.body.success, true);
    const legacyRestore = request("POST", "/api/results/restore", {
      origin: "http://localhost:3000", body: { archiveId: legacyDeletion.body.archiveId, resultId: 1 } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(legacyRestore.body.success, true);
    assert.equal(saved.find(row => row.id === 1).submitted_at, null);
    const current = request("GET", "/api/settings/exam-id").body;
    assert.equal(current.examId, payload.examId);
    assert.ok(current.studentUrl.endsWith(`?exam=${payload.examId}`));
    assert.equal(request("POST", "/api/settings/exam-id", {
      origin: "https://other.example", body: { examId: "next-exam" } }).statusCode, 403);
    assert.equal(request("POST", "/api/settings/exam-id", {
      origin: "http://localhost:3000", body: { examId: "invalid exam" } }).statusCode, 400);
    assert.equal(request("POST", "/api/settings/exam-id", {
      origin: "http://localhost:3000", body: { examId: "next-exam" } }).body.examId, "next-exam");
    assert.equal(request("GET", "/api/health").body.activeExamId, "next-exam");
    assert.equal(request("POST", "/api/results", { body: payload }).statusCode, 409);
    console.log("server.test.js: OK");
  } finally {
    fs.unlinkSync(rosterFile);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
