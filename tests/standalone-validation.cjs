const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const removedPaths = ["admin.html", "admin.js", "supabase", "worker", "vendor"];
for (const relativePath of removedPaths) {
  assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} が残っています。`);
}

for (const htmlName of ["index.html", "audit.html"]) {
  const htmlPath = path.join(root, htmlName);
  const html = fs.readFileSync(htmlPath, "utf8");
  for (const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g)) {
    const reference = match[1];
    assert.equal(/^[a-z]+:/i.test(reference), false, `${htmlName} に外部URLがあります: ${reference}`);
    assert.equal(fs.existsSync(path.resolve(root, reference)), true, `${htmlName} の参照先がありません: ${reference}`);
  }
}

console.log("OK: 公開HTMLのローカル参照を確認（校内サーバへの通信は別途テスト）");
