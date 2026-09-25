"use strict";
// 依存パッケージなしで、旧DBの読み取り・提出・管理制限・CSVを検証する。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const routes = new Map();
const saved = [{ id: 1, student_code: "1215", student_name: "旧データ", class_name: "1年2組",
  score: 80, knowledge_score: 30, thinking_score: 50,
  answers: JSON.stringify([{ domain: "A", earned: 8, points: 10 }]),
  started_at: "2026-09-25T00:00:00.000Z", submitted_at: "2026-09-25 01:00:00" }];
const app = { disable() {}, use() {}, listen(_port, _host, callback) { callback(); } };
for (const method of ["get", "post", "options"]) {
  app[method] = (route, ...handlers) => routes.set(`${method.toUpperCase()} ${route}`, handlers);
}
const express = () => app;
express.json = () => (_req, _res, next) => next();
class Database {
  pragma() {}
  exec() {}
  prepare(sql) {
    if (sql.includes("INSERT INTO")) return { run(code, name, className, score, knowledge,
      thinking, answers, started, submitted) {
      const id = saved.length + 1;
      saved.push({ id, student_code: code, student_name: name, class_name: className,
        score, knowledge_score: knowledge, thinking_score: thinking,
        answers, started_at: started, submitted_at: submitted });
      return { lastInsertRowid: id };
    } };
    if (sql.includes("WHERE student_code")) return { get(code, started) {
      return saved.find(row => row.student_code === code && row.started_at === started);
    } };
    return { all() { return [...saved].reverse(); } };
  }
}
function fakeRequire(name) {
  if (name === "express") return express;
  if (name === "better-sqlite3") return Database;
  if (name === "cors") return () => (_req, _res, next) => next();
  if (name === "os") return { networkInterfaces: () => ({}) };
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
assert.equal(request("GET", "/api/results", { address: "172.17.156.99" }).statusCode, 403);
assert.equal(request("GET", "/api/results.csv", { host: "evil.example:3000" }).statusCode, 403);
assert.equal(request("GET", "/admin", { address: "172.17.156.99" }).statusCode, 403);

const payload = { studentCode: "1215", studentName: "=SUM(1+1)", className: "1年2組",
  score: 90, knowledgeScore: 35, thinkingScore: 55,
  answers: [{ domain: "B", earned: 3, points: 5 }], startedAt: "2026-09-25T02:00:00.000Z" };
assert.equal(request("POST", "/api/results", {
  origin: "https://other.example", body: payload }).statusCode, 403);
const result = request("POST", "/api/results", {
  address: "172.17.156.99", origin: "https://naturespa.github.io", body: payload });
assert.equal(result.body.success, true);
assert.equal(saved.length, 2);
const duplicate = request("POST", "/api/results", { body: payload });
assert.equal(duplicate.body.duplicate, true);
assert.equal(saved.length, 2);
assert.equal(request("GET", "/api/results").body.count, 1);
assert.equal(request("GET", "/api/results", { query: { latest: "0" } }).body.count, 2);
const csv = request("GET", "/api/results.csv").body;
assert.ok(csv.startsWith("\uFEFF"));
assert.ok(csv.includes("\"'=SUM(1+1)\""));
assert.ok(csv.includes('"3","5"'));
console.log("server.test.js: OK");
