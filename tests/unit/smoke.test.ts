import { describe, expect, it } from "vitest";

const MIN_NODE = [22, 13, 0] as const;

function isAtLeast(version: string, min: readonly number[]): boolean {
  const parts = version.split(".").map(Number);
  for (let i = 0; i < min.length; i++) {
    const current = parts[i] ?? 0;
    if (current !== min[i]) {
      return current > min[i]!;
    }
  }
  return true;
}

describe("entorno de ejecución", () => {
  it("usa Node >= 22.13 (requisito de node:sqlite)", () => {
    expect(isAtLeast(process.versions.node, MIN_NODE)).toBe(true);
  });
});
