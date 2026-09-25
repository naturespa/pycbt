"use strict";

// C:\cbt にこのファイルと admin.html を置いて実行する。
const express = require("express");
const Database = require("better-sqlite3");
const cors = require("cors");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");
const { TextDecoder } = require("util");
const { scoreExam, poolVersion } = require("./scoring");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PAGE_ORIGIN = "https://naturespa.github.io";
const ACTIVE_EXAM_ID = "practice-2026-09-25";
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
  CREATE TABLE IF NOT EXISTS student_roster (
    academic_year TEXT NOT NULL,
    grade INTEGER NOT NULL,
    student_code TEXT NOT NULL,
    student_name TEXT NOT NULL,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (academic_year, student_code)
  );
  CREATE INDEX IF NOT EXISTS idx_roster_year_grade
    ON student_roster(academic_year, grade);
`);
// 旧表を破棄しない移行。以前の記録は「従来記録／未検証」として残る。
const existingColumns = new Set(db.pragma("table_info(exam_results)").map(column => column.name));
const additions = {
  exam_id: "TEXT NOT NULL DEFAULT 'legacy'",
  pool_version: "TEXT",
  verification_status: "TEXT NOT NULL DEFAULT 'legacy_unverified'",
  client_score: "INTEGER",
  score_mismatch: "INTEGER"
};
for (const [name, definition] of Object.entries(additions)) {
  if (!existingColumns.has(name)) db.exec(`ALTER TABLE exam_results ADD COLUMN ${name} ${definition}`);
}

const insertResult = db.prepare(`
  INSERT INTO exam_results
    (student_code, student_name, class_name, score, knowledge_score,
     thinking_score, answers, started_at, submitted_at, exam_id,
     pool_version, verification_status, client_score, score_mismatch)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const findSubmission = db.prepare(`
  SELECT id, answers, verification_status FROM exam_results
  WHERE exam_id = ? AND student_code = ? AND started_at = ? LIMIT 1
`);
const allResults = db.prepare(`
  SELECT id, student_code, student_name, class_name, score,
         knowledge_score, thinking_score, answers, started_at, submitted_at,
         exam_id, pool_version, verification_status, client_score, score_mismatch
  FROM exam_results ORDER BY id DESC
`);
const rosterForGrade = db.prepare(`
  SELECT student_code, student_name, imported_at FROM student_roster
  WHERE academic_year = ? AND grade = ? ORDER BY student_code
`);
const deleteRosterForGrade = db.prepare(`
  DELETE FROM student_roster WHERE academic_year = ? AND grade = ?
`);
const insertRoster = db.prepare(`
  INSERT INTO student_roster (academic_year, grade, student_code, student_name)
  VALUES (?, ?, ?, ?)
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
  res.json({ success: true, message: "pycbt server is running",
    protocolVersion: 2, activeExamId: ACTIVE_EXAM_ID, poolVersion,
    time: new Date().toISOString() });
});
app.options("/api/results", allowedPage, pageCors);
app.post("/api/results", allowedPage, pageCors, (req, res) => {
  try {
    const { studentCode, studentName, score, knowledgeScore,
      thinkingScore, answers, startedAt, examId, poolVersion: submittedPoolVersion } = req.body || {};
    const code = String(studentCode || "").trim();
    const name = String(studentName || "").trim();
    if (!/^[1-3][1-9]\d{2}$/.test(code) || !name || name.length > 60 ||
        !Array.isArray(answers) || answers.length !== 45 ||
        !startedAt || Number.isNaN(Date.parse(startedAt))) {
      return res.status(400).json({ success: false, message: "受験データの形式を確認してください" });
    }
    const validScore = n => Number.isInteger(n) && n >= 0 && n <= 100;
    if (![score, knowledgeScore, thinkingScore].every(validScore)) {
      return res.status(400).json({ success: false, message: "得点の形式を確認してください" });
    }
    if (examId !== ACTIVE_EXAM_ID) {
      return res.status(409).json({ success: false, message: "試験IDがサーバと異なります。先生へ知らせてください" });
    }
    let verified;
    try { verified = scoreExam(code, answers, submittedPoolVersion); }
    catch (error) { return res.status(422).json({ success: false, message: error.message }); }
    const existing = findSubmission.get(examId, code, startedAt);
    if (existing) {
      const previous = scoreExam(code, JSON.parse(existing.answers), submittedPoolVersion);
      return res.json({ success: true, verified: true, resultId: existing.id,
        duplicate: true, scores: previous.scores,
        questionResults: previous.questions.map(q => ({ question_id: q.question_id, correct: q.correct, points: q.points, earned: q.earned })) });
    }
    const trustedScore = verified.scores;
    const mismatch = score !== trustedScore.total.earned ||
      knowledgeScore !== trustedScore.knowledge.earned ||
      thinkingScore !== trustedScore.thinking.earned;
    const result = insertResult.run(code, name, `${code[0]}年${code[1]}組`,
      trustedScore.total.earned, trustedScore.knowledge.earned,
      trustedScore.thinking.earned, JSON.stringify(verified.questions),
      startedAt, new Date().toISOString(), examId, poolVersion,
      "server_scored", score, mismatch ? 1 : 0);
    console.log(`[SAVE] ${examId} ${code} ${name} ${trustedScore.total.earned}点${mismatch ? "（端末表示との差あり）" : ""}`);
    res.json({ success: true, verified: true, resultId: Number(result.lastInsertRowid),
      scores: trustedScore,
      questionResults: verified.questions.map(q => ({ question_id: q.question_id, correct: q.correct, points: q.points, earned: q.earned })) });
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
  return { id: row.id, exam_id: row.exam_id || "legacy",
    verification_status: row.verification_status || "legacy_unverified",
    client_score: row.client_score, score_mismatch: Boolean(row.score_mismatch),
    student_code: row.student_code, student_name: row.student_name,
    class_name: row.class_name, grade: classMatch ? Number(classMatch[1]) : Number(row.student_code[0]),
    class_number: classMatch ? Number(classMatch[2]) : Number(row.student_code[1]),
    attendance: Number(row.student_code.slice(2)), score: row.score,
    knowledge_score: row.knowledge_score, thinking_score: row.thinking_score,
    domains, started_at: row.started_at, submitted_at: row.submitted_at };
}
function selectedRows(req) {
  let rows = allResults.all().map(toAdminRow);
  if (req.query.exam) rows = rows.filter(row => row.exam_id === req.query.exam);
  if (req.query.latest !== "0") {
    const seen = new Set();
    rows = rows.filter(row => {
      const key = `${row.exam_id}:${row.student_code}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if (req.query.class) rows = rows.filter(row => row.class_name === req.query.class);
  return rows.sort((a, b) => a.student_code.localeCompare(b.student_code, "ja") || b.id - a.id);
}

function rosterScope(input) {
  const year = String(input.year || "").trim();
  const grade = Number(input.grade);
  if (!/^20\d{2}$/.test(year) || ![1, 2, 3].includes(grade)) {
    throw new Error("年度（西暦4桁）と学年（1～3）を指定してください");
  }
  return { year, grade };
}
function normalizeName(name) {
  return String(name || "").normalize("NFKC").replace(/[\s\u3000]+/g, "");
}
function validateRoster(input) {
  const { year, grade } = rosterScope(input);
  const errors = [], seen = new Set(), rows = [];
  let otherGrades = 0;
  if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > 500) {
    throw new Error("名簿は1～500件のCSVを指定してください");
  }
  input.rows.forEach((row, index) => {
    const code = String(row?.code ?? "").normalize("NFKC").trim();
    const name = String(row?.name ?? "").trim();
    const line = Number(row?.line) || index + 2;
    if (/^[1-3][1-9]\d{2}$/.test(code) && Number(code[0]) !== grade) {
      otherGrades += 1;
      return;
    }
    if (!/^[1-3][1-9]\d{2}$/.test(code) || code.slice(2) === "00") {
      errors.push(`${line}行目：受験番号は4桁で入力してください`);
    } else if (seen.has(code)) {
      errors.push(`${line}行目：受験番号 ${code} が重複しています`);
    } else {
      seen.add(code);
    }
    if (!name || name.length > 60) errors.push(`${line}行目：氏名を1～60文字で入力してください`);
    if (errors.length < 100 && /^[1-3][1-9]\d{2}$/.test(code) && name) {
      rows.push({ code, name });
    }
  });
  if (!rows.length && !errors.length) errors.push("選択した学年の生徒がCSVにいません");
  return { year, grade, rows, errors: errors.slice(0, 30), otherGrades };
}
function rosterPreview(input) {
  const parsed = validateRoster(input);
  if (parsed.errors.length) return { ...parsed, changes: null };
  const old = rosterForGrade.all(parsed.year, parsed.grade);
  const oldByCode = new Map(old.map(row => [row.student_code, row.student_name]));
  const incoming = new Set(parsed.rows.map(row => row.code));
  const added = parsed.rows.filter(row => !oldByCode.has(row.code)).length;
  const changed = parsed.rows.filter(row => oldByCode.has(row.code) &&
    normalizeName(oldByCode.get(row.code)) !== normalizeName(row.name)).length;
  const removed = old.filter(row => !incoming.has(row.student_code));
  return { ...parsed, changes: { existing: old.length, incoming: parsed.rows.length,
    added, changed, removed: removed.length,
    removedCodes: removed.slice(0, 20).map(row => row.student_code) } };
}

function csvRows(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw Error("CSVの引用符が閉じられていません");
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function readRosterFile() {
  const filename = path.join(__dirname, "meibo.csv");
  if (!fs.existsSync(filename)) throw Error("C:\\cbt\\meibo.csv が見つかりません");
  const buffer = fs.readFileSync(filename);
  if (buffer.length > 1024 * 1024) throw Error("名簿CSVが大きすぎます（上限1MB）");
  let contents;
  try { contents = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch { contents = new TextDecoder("shift_jis", { fatal: true }).decode(buffer); }
  const records = csvRows(contents.replace(/^\uFEFF/, ""));
  if (!records.length) throw Error("名簿CSVにデータがありません");
  const header = records[0].map(value => value.normalize("NFKC").trim().replace(/[\s\u3000]+/g, ""));
  let codeIndex = header.findIndex(value => /^(受験番号|生徒番号|4桁番号)$/.test(value));
  let nameIndex = header.findIndex(value => /^(氏名|名前|生徒氏名)$/.test(value));
  let startIndex = 1;
  if (codeIndex < 0 || nameIndex < 0) {
    if (/^[1-3][1-9]\d{2}$/.test(records[0][0]?.normalize("NFKC").trim()) && records[0].length >= 2) {
      codeIndex = 0; nameIndex = 1; startIndex = 0;
    } else throw Error("CSVの見出しは「受験番号,氏名」にしてください");
  }
  const rows = records.slice(startIndex).map((fields, index) => ({
    code: fields[codeIndex] ?? "", name: fields[nameIndex] ?? "",
    line: index + startIndex + 1
  }));
  return { rows, fileHash: crypto.createHash("sha256").update(buffer).digest("hex") };
}

app.get("/api/roster/preview-file", requireTeacherPC, (req, res) => {
  try {
    const file = readRosterFile();
    const preview = rosterPreview({ ...req.query, rows: file.rows });
    res.set("Cache-Control", "no-store");
    res.json({ success: !preview.errors.length, errors: preview.errors,
      changes: preview.changes, otherGrades: preview.otherGrades, fileHash: file.fileHash });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

const replaceRoster = db.transaction((year, grade, rows) => {
  deleteRosterForGrade.run(year, grade);
  for (const row of rows) insertRoster.run(year, grade, row.code, row.name);
});

async function createBackup() {
  const directory = path.join(__dirname, "backups");
  fs.mkdirSync(directory, { recursive: true });
  const filename = `pycbt-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
  await db.backup(path.join(directory, filename));
  return { directory, filename };
}

app.post("/api/roster/import-file", requireTeacherPC, async (req, res) => {
  try {
    const file = readRosterFile();
    const preview = rosterPreview({ ...req.body, rows: file.rows });
    if (preview.errors.length) return res.status(400).json({ success: false, errors: preview.errors });
    if (req.body.fileHash !== file.fileHash) {
      return res.status(409).json({ success: false, message: "プレビュー後に meibo.csv が変わりました。再確認してください" });
    }
    if (Number(req.body.expectedExisting) !== preview.changes.existing) {
      return res.status(409).json({ success: false, message: "プレビュー後に名簿が変わりました。再確認してください" });
    }
    const backup = await createBackup();
    replaceRoster(preview.year, preview.grade, preview.rows);
    res.json({ success: true, year: preview.year, grade: preview.grade,
      count: preview.rows.length, backupFile: backup.filename });
  } catch (error) {
    console.error("名簿の取込に失敗しました", error);
    res.status(500).json({ success: false, message: "名簿を取り込めませんでした" });
  }
});

function rosterStatus(scope, examId) {
  const roster = rosterForGrade.all(scope.year, scope.grade);
  const records = allResults.all().map(toAdminRow).filter(row =>
    row.exam_id === examId && row.grade === scope.grade);
  const submissions = new Map();
  for (const row of records) {
    const list = submissions.get(row.student_code) || [];
    list.push(row);
    submissions.set(row.student_code, list);
  }
  const rows = roster.map(person => {
    const attempts = submissions.get(person.student_code) || [];
    const latest = attempts[0] || null;
    const nameMismatch = latest ? normalizeName(latest.student_name) !== normalizeName(person.student_name) : false;
    return { student_code: person.student_code, roster_name: person.student_name,
      submitted_name: latest?.student_name || "", class_name: `${scope.grade}年${person.student_code[1]}組`,
      attendance: Number(person.student_code.slice(2)), status: !latest ? "未提出" : nameMismatch ? "氏名不一致" : "提出済み",
      attempts: attempts.length, score: latest?.score ?? null,
      verification_status: latest?.verification_status || "",
      submitted_at: latest?.submitted_at || "" };
  });
  const enrolled = new Set(roster.map(row => row.student_code));
  const unmatched = [...submissions.values()].filter(attempts => !enrolled.has(attempts[0].student_code))
    .map(attempts => ({ ...attempts[0], attempts: attempts.length }));
  return { year: scope.year, grade: scope.grade, examId, registered: roster.length,
    submitted: rows.filter(row => row.status !== "未提出").length,
    missing: rows.filter(row => row.status === "未提出").length,
    nameMismatches: rows.filter(row => row.status === "氏名不一致").length,
    duplicates: rows.filter(row => row.attempts > 1).length,
    unmatched, rows };
}

app.get("/api/roster/status", requireTeacherPC, (req, res) => {
  try {
    const scope = rosterScope(req.query);
    const examId = String(req.query.exam || ACTIVE_EXAM_ID);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(examId)) throw Error("試験IDが不正です");
    res.set("Cache-Control", "no-store");
    res.json({ success: true, ...rosterStatus(scope, examId) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
app.get("/api/results", requireTeacherPC, (req, res) => {
  try {
    const rows = selectedRows(req);
    res.set("Cache-Control", "no-store");
    res.json({ success: true, activeExamId: ACTIVE_EXAM_ID, count: rows.length, results: rows });
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
    const headers = ["記録ID", "試験ID", "採点", "受験番号", "学年", "組", "出席番号", "氏名", "総合点", "知識・技能", "思考・判断・表現", "端末側の得点", "得点差あり",
      ..."ABCDEF".split("").flatMap(d => [d + "得点", d + "満点"]), "開始時刻", "提出時刻"];
    const lines = [headers.map(csvCell).join(",")];
    for (const row of rows) {
      lines.push([row.id, row.exam_id, row.verification_status, row.student_code,
        row.grade, row.class_number, row.attendance, row.student_name,
        row.score, row.knowledge_score, row.thinking_score,
        row.client_score ?? "", row.score_mismatch ? "要確認" : "",
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

app.get("/api/roster/status.csv", requireTeacherPC, (req, res) => {
  try {
    const scope = rosterScope(req.query);
    const examId = String(req.query.exam || ACTIVE_EXAM_ID);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(examId)) throw Error("試験IDが不正です");
    const data = rosterStatus(scope, examId);
    const header = ["試験ID", "年度", "学年", "受験番号", "組", "出席番号", "名簿氏名",
      "入力氏名", "提出状況", "提出回数", "得点", "採点", "提出時刻"];
    const lines = [header.map(csvCell).join(",")];
    for (const row of data.rows) {
      lines.push([examId, scope.year, scope.grade, row.student_code, row.student_code[1],
        row.attendance, row.roster_name, row.submitted_name, row.status, row.attempts,
        row.score ?? "", row.verification_status, row.submitted_at].map(csvCell).join(","));
    }
    for (const row of data.unmatched) {
      lines.push([examId, scope.year, scope.grade, row.student_code, row.student_code[1],
        row.attendance, "", row.student_name, "名簿外の提出", row.attempts,
        row.score, row.verification_status, row.submitted_at].map(csvCell).join(","));
    }
    res.set({ "Cache-Control": "no-store", "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pycbt-roster-${scope.year}-grade${scope.grade}.csv"` });
    res.send("\uFEFF" + lines.join("\r\n") + "\r\n");
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// SQLiteのオンラインバックアップ。WALを含む一貫した .db を作成してダウンロードする。
app.get("/api/backup", requireTeacherPC, async (_req, res) => {
  try {
    const { directory, filename } = await createBackup();
    res.set("Cache-Control", "no-store");
    res.download(path.join(directory, filename), filename);
  } catch (error) {
    console.error("バックアップに失敗しました", error);
    res.status(500).json({ success: false, message: "DBのバックアップに失敗しました" });
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
  console.log(`試験ID ${ACTIVE_EXAM_ID}／採点マスタ ${poolVersion}`);
});
