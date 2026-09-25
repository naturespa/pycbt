"use strict";

// C:\cbt にこのファイルと admin.html を置いて実行する。
const express = require("express");
const Database = require("better-sqlite3");
const cors = require("cors");
const path = require("path");
const os = require("os");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PAGE_ORIGIN = "https://naturespa.github.io";
const db = new Database(path.join(__dirname, "pycbt.db"));
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

// 旧 server.js と同じ表を使う。既存の成績もそのまま表示できる。
db.exec(`
  CREATE TABLE IF NOT EXISTS exam_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_code TEXT NOT NULL,
    student_name TEXT NOT NULL,
    class_name TEXT,
    score INTEGER DEFAULT 0,
    knowledge_score INTEGER DEFAULT 0,
    thinking_score INTEGER DEFAULT 0,
    answers TEXT,
    started_at TEXT,
    submitted_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_student_code ON exam_results(student_code);
  CREATE INDEX IF NOT EXISTS idx_class_name ON exam_results(class_name);
`);

const insertResult = db.prepare(`
  INSERT INTO exam_results
    (student_code, student_name, class_name, score, knowledge_score,
     thinking_score, answers, started_at, submitted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const findSubmission = db.prepare(`
  SELECT id FROM exam_results WHERE student_code = ? AND started_at = ? LIMIT 1
`);
const allResults = db.prepare(`
  SELECT id, student_code, student_name, class_name, score,
         knowledge_score, thinking_score, answers, started_at, submitted_at
  FROM exam_results ORDER BY id DESC
`);

function requireTeacherPC(req, res, next) {
  const address = req.socket.remoteAddress;
  const host = req.get("Host");
  if ((address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1") &&
      (host === `localhost:${PORT}` || host === `127.0.0.1:${PORT}`)) {
    return next();
  }
  return res.status(403).json({ success: false, message: "管理画面は先生PCの localhost から開いてください" });
}

function allowedPage(req, res, next) {
  const origin = req.get("Origin");
  if (origin && origin !== PAGE_ORIGIN) {
    return res.status(403).json({ success: false, message: "許可されていないページからの送信です" });
  }
  next();
}

const pageCors = cors({ origin: PAGE_ORIGIN, methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] });
app.get("/api/health", pageCors, (_req, res) => {
  res.json({ success: true, message: "pycbt server is running", time: new Date().toISOString() });
});
app.options("/api/results", allowedPage, pageCors);
app.post("/api/results", allowedPage, pageCors, (req, res) => {
  try {
    const { studentCode, studentName, className, score, knowledgeScore,
      thinkingScore, answers, startedAt } = req.body || {};
    const code = String(studentCode || "").trim();
    const name = String(studentName || "").trim();
    if (!/^[1-3][1-9]\d{2}$/.test(code) || !name || name.length > 60 ||
        !Array.isArray(answers) || answers.length > 100 ||
        !startedAt || Number.isNaN(Date.parse(startedAt))) {
      return res.status(400).json({ success: false, message: "受験データの形式を確認してください" });
    }
    const validScore = n => Number.isInteger(n) && n >= 0 && n <= 100;
    if (![score, knowledgeScore, thinkingScore].every(validScore)) {
      return res.status(400).json({ success: false, message: "得点の形式を確認してください" });
    }
    const existing = findSubmission.get(code, startedAt);
    if (existing) return res.json({ success: true, resultId: existing.id, duplicate: true });
    const result = insertResult.run(code, name, String(className || "").slice(0, 30),
      score, knowledgeScore, thinkingScore, JSON.stringify(answers),
      startedAt, new Date().toISOString());
    console.log(`[SAVE] ${code} ${name} ${score}点`);
    res.json({ success: true, resultId: Number(result.lastInsertRowid) });
  } catch (error) {
    console.error("成績保存に失敗しました", error);
    res.status(500).json({ success: false, message: "成績を保存できませんでした" });
  }
});

// 管理用の画面とAPIはLAN上の生徒PCから開けない。
app.get("/admin", requireTeacherPC, (_req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});
function toAdminRow(row) {
  let questions = [];
  try { questions = JSON.parse(row.answers || "[]"); } catch { /* 旧レコードの破損には空欄で対応 */ }
  const domains = {};
  for (const q of Array.isArray(questions) ? questions : []) {
    if (!/^[A-F]$/.test(q.domain || "")) continue;
    const item = domains[q.domain] ||= { earned: 0, max: 0 };
    item.earned += Number(q.earned) || 0;
    item.max += Number(q.points) || 0;
  }
  const classMatch = /^([1-3])年([1-9])組$/.exec(row.class_name || "");
  return { id: row.id, student_code: row.student_code, student_name: row.student_name,
    class_name: row.class_name, grade: classMatch ? Number(classMatch[1]) : Number(row.student_code[0]),
    class_number: classMatch ? Number(classMatch[2]) : Number(row.student_code[1]),
    attendance: Number(row.student_code.slice(2)), score: row.score,
    knowledge_score: row.knowledge_score, thinking_score: row.thinking_score,
    domains, started_at: row.started_at, submitted_at: row.submitted_at };
}
function selectedRows(req) {
  let rows = allResults.all().map(toAdminRow);
  if (req.query.latest !== "0") {
    const seen = new Set();
    rows = rows.filter(row => {
      if (seen.has(row.student_code)) return false;
      seen.add(row.student_code);
      return true;
    });
  }
  if (req.query.class) rows = rows.filter(row => row.class_name === req.query.class);
  return rows.sort((a, b) => a.student_code.localeCompare(b.student_code, "ja") || b.id - a.id);
}
app.get("/api/results", requireTeacherPC, (req, res) => {
  try {
    const rows = selectedRows(req);
    res.set("Cache-Control", "no-store");
    res.json({ success: true, count: rows.length, results: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "成績を取得できませんでした" });
  }
});

function csvCell(value) {
  let text = String(value ?? "");
  // Excelで氏名などが数式として実行されないようにする。
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
app.get("/api/results.csv", requireTeacherPC, (req, res) => {
  try {
    const rows = selectedRows(req);
    const headers = ["記録ID", "受験番号", "学年", "組", "出席番号", "氏名", "総合点", "知識・技能", "思考・判断・表現",
      ..."ABCDEF".split("").flatMap(d => [d + "得点", d + "満点"]), "開始時刻", "提出時刻"];
    const lines = [headers.map(csvCell).join(",")];
    for (const row of rows) {
      lines.push([row.id, row.student_code, row.grade, row.class_number, row.attendance,
        row.student_name, row.score, row.knowledge_score, row.thinking_score,
        ..."ABCDEF".split("").flatMap(d => [row.domains[d]?.earned ?? "", row.domains[d]?.max ?? ""]),
        row.started_at, row.submitted_at].map(csvCell).join(","));
    }
    const filename = `pycbt-results-${new Date().toISOString().slice(0, 10)}.csv`;
    res.set({ "Cache-Control": "no-store", "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"` });
    res.send("\uFEFF" + lines.join("\r\n") + "\r\n");
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "CSVを作成できませんでした" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`管理画面（先生PCのみ） http://localhost:${PORT}/admin`);
  console.log(`接続テスト（先生PC） http://localhost:${PORT}/api/health`);
  for (const networks of Object.values(os.networkInterfaces())) {
    for (const item of networks || []) {
      if (item.family === "IPv4" && !item.internal) console.log(`接続テスト（LAN） http://${item.address}:${PORT}/api/health`);
    }
  }
  console.log(`データベース ${path.join(__dirname, "pycbt.db")}`);
});
