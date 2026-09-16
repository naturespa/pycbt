const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const removedPaths = ["admin.html", "admin.js", "supabase", "worker", "vendor"];
for (const relativePath of removedPaths) {
  assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} が残っています。`);
}

const sourceFiles = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", ".github", "tests"].includes(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(fullPath);
    else if (/\.(?:html|js|css|md)$/i.test(entry.name)) sourceFiles.push(fullPath);
  }
}
collect(root);

const forbidden = /\b(?:fetch|XMLHttpRequest|WebSocket|MSAL|Supabase|Cloudflare|Power\s*Automate|Bearer|JWT)\b|Microsoft\s*365|外部認証|教員ログイン|受験台帳/iu;
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  assert.equal(forbidden.test(content), false, `${path.relative(root, file)} に外部接続・認証関連の記述があります。`);
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

console.log(`OK: 外部接続・認証依存なし、ローカル参照${sourceFiles.length}ファイルを確認`);
