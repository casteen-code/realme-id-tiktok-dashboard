import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const client = resolve(dist, "client");
const server = resolve(dist, "server");

const files = [
  "inventory-turnover.html",
  "inventory-turnover.js",
  "sku-core.js",
  "vendor/xlsx.full.min.js",
];

const dashboardFiles = [
  ["index.html", "index.html"],
  ["dashboard.enc.json", "dashboard.enc.json"],
];

const worker = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const target = url.pathname === "/" ? "/index.html" : url.pathname;
    return env.ASSETS.fetch(new Request(new URL(target, request.url), request));
  },
};
`;

const workerConfig = {
  name: "realme-id-inventory-turnover",
  compatibility_date: "2026-09-08",
  main: "index.js",
  rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }],
  no_bundle: true,
  assets: { directory: "../client" },
};

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(client, "vendor"), { recursive: true });
await mkdir(server, { recursive: true });
await mkdir(resolve(client, "tiktok-dashboard"), { recursive: true });

for (const file of files) {
  const target = file === "inventory-turnover.html" ? "index.html" : file;
  await cp(resolve(root, file), resolve(client, target));
}

// The inventory tool stays at the site root. The encrypted operating dashboard
// has its own stable URL, so publishing either project cannot replace the other.
for (const [source, target] of dashboardFiles) {
  await cp(resolve(root, source), resolve(client, "tiktok-dashboard", target));
}

await writeFile(resolve(server, "index.js"), worker);
await writeFile(resolve(server, "wrangler.json"), `${JSON.stringify(workerConfig)}\n`);
console.log("Built static inventory turnover site in dist/client.");
