"use strict";

// GitHub Pages の出題コードから、サーバ専用の正答データを生成する。
// 問題を変更したときは、このスクリプトを実行し、生成物を server.js と一緒に配布する。
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const sources = [
  "question-bank.js",
  "pool/pool-ab.js", "pool/pool-cd.js", "pool/pool-e.js", "pool/pool-f.js",
  "pool/pool-extra.js", "pool/pool-paiza.js", "pool/pool-diagrams.js",
  "pool/pool-actual.js", "pool/pool-engine.js"
];
const browser = { window: {}, document: { getElementById: () => ({ value: "1221" }) },
  console: { info() {}, error: (...args) => { throw Error(args.join(" ")); } } };
vm.createContext(browser);
const digest = crypto.createHash("sha256");
for (const file of sources) {
  const code = fs.readFileSync(path.join(root, file), "utf8");
  digest.update(file).update("\0").update(code).update("\0");
  vm.runInContext(code, browser, { filename: file, timeout: 3000 });
}
const slots = browser.window.PYCBT_POOL_SLOTS;
if (slots.length !== 45 || browser.window.PYCBT_POOL_SIZE !== 240) throw Error("問題プールが想定と異なります");
const key = {
  version: browser.window.PYCBT_POOL_VERSION,
  source_sha256: digest.digest("hex"),
  slots: slots.map(slot => ({
    id: slot.slot_id, domain: slot.domain, viewpoint: slot.viewpoint,
    format: slot.format, points: slot.points, it_passport: Boolean(slot.it_passport),
    variants: slot.variants.map(variant => ({
      answers: (variant.acceptable_answers?.length ? variant.acceptable_answers : [variant.answer]).map(String),
      it_passport: Boolean(variant.it_passport ?? slot.it_passport)
    }))
  }))
};
fs.writeFileSync(path.join(__dirname, "answer-key.json"), JSON.stringify(key, null, 2) + "\n");
console.log(`正答データを生成しました：${key.version}／${key.slots.length}枠`);
