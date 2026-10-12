import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temp = await mkdtemp(join(tmpdir(), "operating-site-regression-"));
const fixture = join(temp, "fixture");
const unrelated = join(temp, "unrelated-working-directory");
const viewer = '<!doctype html><title>TikTok 手机经营总看板</title><form id="unlock-form"></form><script>fetch("./dashboard.enc.json")</script>';
const payload = JSON.stringify({ synthetic: true, ciphertext: "fixture-not-operational-data" });
const routes = {
  "tiktok-dashboard/index.html": "https://casteen-code.github.io/realme-id-tiktok-dashboard/",
  "inventory-turnover.html": "https://casteen-code.github.io/realme-inventory-turnover/",
  "inventory-turnover/index.html": "https://casteen-code.github.io/realme-inventory-turnover/",
  "campaign-motion-studio/index.html": "https://casteen-code.github.io/campaign-motion-studio/",
};
const expected = [".nojekyll", "dashboard.enc.json", "index.html", ...Object.keys(routes)].sort();

async function put(file, content) {
  await mkdir(dirname(join(fixture, file)), { recursive: true });
  await writeFile(join(fixture, file), content);
}
async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(join(directory, entry.name), file + "/"));
    else files.push(file);
  }
  return files.sort();
}
function build() {
  return execFileSync(process.execPath, [join(fixture, "sites-build.mjs")], { cwd: unrelated, encoding: "utf8", stdio: "pipe" });
}

try {
  await mkdir(unrelated, { recursive: true });
  await mkdir(join(unrelated, "dist"));
  await writeFile(join(unrelated, "dist", "keep.txt"), "never remove the caller's files");
  await put("index.html", viewer);
  await put("dashboard.enc.json", payload);
  await cp(join(root, "sites-build.mjs"), join(fixture, "sites-build.mjs"));
  for (const file of ["sales.csv", "stock.xlsx", "docs/private.md", "tests/private.js", ".openai/hosting.json", "vendor/old.js", "inventory-turnover.html", "campaign-motion-studio/index.html", "dist/client/stale.csv"]) {
    await put(file, "synthetic excluded file");
  }
  build();
  const output = join(fixture, "dist", "client");
  assert.deepEqual(await listFiles(output), expected, "only the approved viewer, payload and compatibility pages can be published");
  assert.equal(await readFile(join(output, "index.html"), "utf8"), viewer, "root remains the encrypted viewer, not inventory");
  assert.equal(await readFile(join(output, "dashboard.enc.json"), "utf8"), payload, "viewer payload must be copied unchanged alongside it");
  assert.equal(await readFile(join(unrelated, "dist", "keep.txt"), "utf8"), "never remove the caller's files");
  for (const [file, target] of Object.entries(routes)) {
    const html = await readFile(join(output, file), "utf8");
    assert(html.includes(`href="${target}"`), "redirect must offer a usable no-JavaScript fallback");
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert(script, "redirect must have its own inline script and no missing asset dependency");
    assert(!/\b(?:src|href)=["'](?:\/|\.\.?\/)/.test(html), "redirect must not depend on old repository assets");
    for (const [search, hash] of [["", ""], ["?v=3.4.3&source=%E4%B8%AD", "#rules"], ["?next=https%3A%2F%2Fexample.org", "#%E5%BA%93%E5%AD%98"]]) {
      let replaced;
      const anchor = {};
      vm.runInNewContext(script, { URL, window: { location: { search, hash, replace(value) { replaced = value; } } }, document: { getElementById(id) { assert.equal(id, "destination"); return anchor; } } });
      assert.equal(replaced, target + search + hash, "query and hash survive migration without changing the trusted destination");
      assert.equal(anchor.href, replaced);
    }
  }
  build();
  assert.deepEqual(await listFiles(output), expected, "repeated builds must have the same manifest");
  await put("index.html", '<!doctype html><h1>库存周转管理</h1>');
  assert.throws(build, /Root index.html must be the encrypted operating dashboard viewer/);
  assert.equal(await readFile(join(output, "index.html"), "utf8"), viewer, "invalid input must not erase a previous build");
  await put("index.html", viewer);
  await put("dashboard.enc.json", "");
  assert.throws(build, /Source file must not be empty: dashboard.enc.json/);
  assert.equal(await readFile(join(output, "dashboard.enc.json"), "utf8"), payload, "missing payload cannot replace a complete previous build");
  await put("dashboard.enc.json", payload);
  await rm(join(fixture, "dist"), { recursive: true });
  await symlink(join(unrelated, "dist"), join(fixture, "dist"), "dir");
  assert.throws(build, /dist must be a real directory/);
  assert.equal(await readFile(join(unrelated, "dist", "keep.txt"), "utf8"), "never remove the caller's files", "refuse linked output without deleting target files");

  const workflowDirectory = join(root, ".github", "workflows");
  const workflows = await Promise.all((await readdir(workflowDirectory)).filter(x => /\.ya?ml$/.test(x)).map(async file => ({ file, text: await readFile(join(workflowDirectory, file), "utf8") })));
  const publishers = workflows.filter(x => /uses:\s*actions\/deploy-pages@/.test(x.text));
  assert.deepEqual(publishers.map(x => x.file), ["deploy-inventory-pages.yml"], "this repository must declare only one Pages publisher");
  const workflow = publishers[0].text;
  assert.match(workflow, /group:\s*github-pages/);
  assert.match(workflow, /node tests\/site-build-regression\.mjs/);
  assert.match(workflow, /node sites-build\.mjs/);
  assert.match(workflow, /path:\s*\.\/dist\/client/);
  assert.doesNotMatch(workflow, /sku-regression|inventory-turnover\.js|campaign-motion-studio\//, "the operating deployment must not build or test legacy tools");
  console.log("Site build regression passed: encrypted root, allowlist, complete resources, legacy redirects, query/hash, repeatability, safe output and single publisher manifest. GitHub Pages source setting must also be GitHub Actions.");
} finally {
  // Only this test-created, uniquely named temporary directory is removed.
  await rm(temp, { recursive: true, force: true });
}
