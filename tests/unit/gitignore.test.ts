import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

function isIgnoredByGit(path: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", path], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe(".gitignore", () => {
  it.each(["node_modules/", "dist/", "coverage/"])("Git ignora %s", (path) => {
    expect(isIgnoredByGit(path)).toBe(true);
  });

  it.each(["src/", "tests/", "docs/", "package.json"])("Git NO ignora %s", (path) => {
    expect(isIgnoredByGit(path)).toBe(false);
  });
});
