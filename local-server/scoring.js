"use strict";

const key = require("./answer-key.json");
const DOMAIN_NAMES = { A: "アルゴリズム基礎・表現", B: "コンピュータ言語",
  C: "変数・データ型・演算", D: "条件分岐・反復",
  E: "配列・データ構造", F: "擬似言語・総合アルゴリズム" };
const FOUR_POINT_SLOTS = new Set(["A05", "C05", "D05", "E05", "F07"]);

function hashSeed(text) {
  let h = 2166136261 >>> 0;
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function variantSequence(classKey, slotId, length, variantCount) {
  const rng = seededRandom(hashSeed(`${key.version}:${classKey}:${slotId}:variant-sequence`));
  const sequence = [], counts = Array(variantCount).fill(0);
  for (let i = 0; i < length; i += 1) {
    const banned = new Set(sequence.slice(-2));
    const candidates = Array.from({ length: variantCount }, (_, v) => v).filter(v => !banned.has(v));
    const minCount = Math.min(...candidates.map(v => counts[v]));
    const balanced = candidates.filter(v => counts[v] === minCount);
    const selected = balanced[Math.floor(rng() * balanced.length)];
    sequence.push(selected); counts[selected] += 1;
  }
  return sequence;
}
function variantFor(studentCode, slot) {
  const attendance = Number(studentCode.slice(2));
  if (attendance < 1) throw Error("出席番号が不正です");
  return variantSequence(studentCode.slice(0, 2), slot.id, attendance, slot.variants.length)[attendance - 1];
}
function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, "").normalize("NFKC");
}
function scoreExam(studentCode, submitted, poolVersion) {
  if (poolVersion !== key.version) throw Error("問題プールの版がサーバと異なります。先生へ知らせてください");
  if (!Array.isArray(submitted) || submitted.length !== key.slots.length) throw Error("提出した問題数が一致しません");
  const byId = new Map();
  for (const item of submitted) {
    if (!item || typeof item.question_id !== "string" || byId.has(item.question_id) ||
        typeof item.response !== "string" || item.response.length > 200) throw Error("解答データが不正です");
    byId.set(item.question_id, item.response);
  }
  const questions = key.slots.map(slot => {
    const variantIndex = variantFor(studentCode, slot);
    const id = `${slot.id}-${variantIndex + 1}`;
    if (!byId.has(id)) throw Error(`出題内容が一致しません：${id}`);
    const variant = slot.variants[variantIndex];
    const response = byId.get(id);
    const correct = variant.answers.some(a => normalize(a) === normalize(response));
    const points = FOUR_POINT_SLOTS.has(slot.id) ? 4 : slot.points;
    return { question_id: id, base_question_id: slot.id, variant_id: `v${variantIndex + 1}`,
      domain: slot.domain, viewpoint: slot.viewpoint, format: slot.format,
      it_passport: variant.it_passport, response, correct, points,
      earned: correct ? points : 0 };
  });
  function group(label, items) {
    return { label, earned: items.reduce((n, q) => n + q.earned, 0),
      max: items.reduce((n, q) => n + q.points, 0),
      correct: items.filter(q => q.correct).length, count: items.length };
  }
  const scores = {
    total: group("総合", questions),
    knowledge: group("知識・技能", questions.filter(q => q.viewpoint === "knowledge")),
    thinking: group("思考・判断・表現", questions.filter(q => q.viewpoint === "thinking")),
    domains: Object.fromEntries(Object.entries(DOMAIN_NAMES).map(([d, label]) =>
      [d, group(`${d} ${label}`, questions.filter(q => q.domain === d))])),
    it_passport: group("ITパスポート関連", questions.filter(q => q.it_passport))
  };
  if (byId.size !== questions.length || scores.total.max !== 100 ||
      scores.knowledge.max !== 40 || scores.thinking.max !== 60) {
    throw Error("問題構成が正答データと一致しません");
  }
  return { scores, questions, poolVersion: key.version };
}

module.exports = { scoreExam, poolVersion: key.version, keySourceHash: key.source_sha256 };
