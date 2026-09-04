import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const projectDir = path.resolve(import.meta.dirname, "..");
const identityResult = spawnSync(
  "security",
  ["find-identity", "-v", "-p", "codesigning"],
  { cwd: projectDir, encoding: "utf8" },
);

if (identityResult.status !== 0) {
  process.stderr.write(identityResult.stderr || identityResult.stdout);
  process.exit(identityResult.status ?? 1);
}

const identities = identityResult.stdout.matchAll(/^\s*\d+\)\s+[A-F0-9]+\s+"([^"]+)"/gm);
const identity = [...identities]
  .map((match) => match[1])
  .find((name) => name.startsWith("Apple Development:"));

if (!identity) {
  console.error(
    "No valid Apple Development signing identity was found. Create one in Xcode, then run `security find-identity -v -p codesigning`.",
  );
  process.exit(1);
}

console.log(`Signing Mote with ${identity}`);

const tauriConfig = JSON.stringify({
  bundle: {
    createUpdaterArtifacts: false,
    macOS: { signingIdentity: identity },
  },
});
const build = spawnSync(
  "npm",
  ["run", "tauri", "--", "build", "--debug", "--bundles", "app", "--config", tauriConfig],
  { cwd: projectDir, env: { ...process.env, APPLE_SIGNING_IDENTITY: identity }, stdio: "inherit" },
);

if (build.status !== 0) process.exit(build.status ?? 1);

const appExecutable = path.join(
  projectDir,
  "src-tauri/target/debug/bundle/macos/Mote.app/Contents/MacOS/mote",
);
if (!existsSync(appExecutable)) {
  console.error(`Signed app executable not found: ${appExecutable}`);
  process.exit(1);
}

const app = spawnSync(appExecutable, [], {
  cwd: projectDir,
  env: process.env,
  stdio: "inherit",
});
process.exit(app.status ?? (app.signal ? 1 : 0));
