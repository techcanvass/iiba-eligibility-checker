// Builds a WordPress-installable zip: dist/iiba-eligibility-checker.zip
// containing a top-level iiba-eligibility-checker/ folder (what WP expects).
// Works on Windows (PowerShell) and macOS/Linux (zip).
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const slug = "iiba-eligibility-checker";
const stage = `dist/${slug}`;
rmSync("dist", { recursive: true, force: true });
mkdirSync(`${stage}/assets`, { recursive: true });
for (const f of [`${slug}.php`, "readme.txt", "uninstall.php"]) cpSync(f, `${stage}/${f}`);
cpSync("assets/build", `${stage}/assets/build`, { recursive: true });

if (process.platform === "win32") {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${slug}' -DestinationPath '${slug}.zip' -Force"`,
    { cwd: "dist", stdio: "inherit" },
  );
} else {
  execSync(`zip -qr ${slug}.zip ${slug}`, { cwd: "dist", stdio: "inherit" });
}
console.log(`Created apps/wordpress-plugin/dist/${slug}.zip`);
