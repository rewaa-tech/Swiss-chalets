// Runs the standalone build (what production uses). Copies static assets next to server.js first.
import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
const port = process.argv[2] ?? process.env.PORT ?? "3000";
const root = ".next/standalone";
if (!existsSync(`${root}/server.js`)) { console.error("Run `npm run build` first"); process.exit(1); }
cpSync(".next/static", `${root}/.next/static`, { recursive: true });
cpSync("public", `${root}/public`, { recursive: true });
spawn(process.execPath, ["server.js"], { cwd: root, stdio: "inherit", env: { ...process.env, PORT: port, HOSTNAME: process.env.HOSTNAME ?? "127.0.0.1" } })
  .on("exit", (c) => process.exit(c ?? 0));
