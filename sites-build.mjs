import assert from "node:assert/strict";
import { cp, lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Legacy tool sources stay in Git for recovery, never in the website artifact.
const root = await realpath(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, "dist");
const client = join(dist, "client");
const redirects = new Map([
  ["tiktok-dashboard/index.html", "https://casteen-code.github.io/realme-id-tiktok-dashboard/"],
  ["inventory-turnover.html", "https://casteen-code.github.io/realme-inventory-turnover/"],
  ["inventory-turnover/index.html", "https://casteen-code.github.io/realme-inventory-turnover/"],
  ["campaign-motion-studio/index.html", "https://casteen-code.github.io/campaign-motion-studio/"],
]);
const allowed = ["index.html", "dashboard.enc.json", ".nojekyll", ...redirects.keys()].sort();

function redirectPage(target) {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>工具已迁移 · realme</title></head>
<body><main><h1>工具有了独立入口</h1><p>正在打开新地址。若没有自动跳转，请点击下面的链接。</p><a id="destination" href="${target}">打开工具</a><noscript><p>浏览器未启用 JavaScript，请点击链接继续。</p></noscript></main>
<script>
  const destination = new URL(${JSON.stringify(target)});
  destination.search = window.location.search;
  destination.hash = window.location.hash;
  document.getElementById("destination").href = destination.href;
  window.location.replace(destination.href);
</script></body></html>\n`;
}

async function filesIn(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), `Symlink is not allowed in published output: ${entry.name}`);
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await filesIn(join(directory, entry.name), name + "/"));
    else { assert(entry.isFile(), `Unsupported output entry: ${name}`); files.push(name); }
  }
  return files.sort();
}

// Resolve from the script, not cwd. Never clean a caller-selected directory or
// follow a dist symlink. Only the fixed, generated dist directory is replaced.
assert.equal(dirname(dist), root);
try {
  const previous = await lstat(dist);
  assert(!previous.isSymbolicLink() && previous.isDirectory(), "dist must be a real directory, not a symlink or file");
} catch (error) { if (error.code !== "ENOENT") throw error; }

for (const file of ["index.html", "dashboard.enc.json"]) {
  const source = await lstat(join(root, file));
  assert(source.isFile() && !source.isSymbolicLink(), `Source must be a regular file: ${file}`);
  assert(source.size > 0, `Source file must not be empty: ${file}`);
}
const viewer = await readFile(join(root, "index.html"), "utf8");
assert(viewer.includes('id="unlock-form"') && viewer.includes('./dashboard.enc.json'), "Root index.html must be the encrypted operating dashboard viewer");

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
for (const file of ["index.html", "dashboard.enc.json"]) await cp(join(root, file), join(client, file));
await writeFile(join(client, ".nojekyll"), "");
for (const [file, target] of redirects) {
  await mkdir(dirname(join(client, file)), { recursive: true });
  await writeFile(join(client, file), redirectPage(target));
}

assert.deepEqual(await filesIn(client), allowed, "Published files do not match the operating-dashboard allowlist");
assert.equal(await readFile(join(client, "index.html"), "utf8"), viewer, "The root viewer must not be replaced by another tool");
console.log(`Built operating dashboard and compatibility links: ${allowed.length} approved files in dist/client.`);
