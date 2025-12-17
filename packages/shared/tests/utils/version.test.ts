import { describe, expect, test } from "bun:test";
import {
  coerceVersion,
  compareVersions,
  formatVersion,
  getHighestVersion,
  incrementVersion,
  isValidVersion,
  parseRange,
  parseVersion,
  satisfiesRange,
  sortVersions,
} from "../../src/utils/version";

describe("Version utilities", () => {
  describe("parseVersion", () => {
    test("parses simple version", () => {
      const result = parseVersion("1.2.3");
      expect(result).not.toBeNull();
      expect(result?.major).toBe(1);
      expect(result?.minor).toBe(2);
      expect(result?.patch).toBe(3);
    });

    test("parses version with v prefix", () => {
      const result = parseVersion("v1.2.3");
      expect(result).not.toBeNull();
      expect(result?.major).toBe(1);
    });

    test("parses major only", () => {
      const result = parseVersion("1");
      expect(result).not.toBeNull();
      expect(result?.major).toBe(1);
      expect(result?.minor).toBe(0);
      expect(result?.patch).toBe(0);
    });

    test("parses major.minor", () => {
      const result = parseVersion("1.2");
      expect(result).not.toBeNull();
      expect(result?.major).toBe(1);
      expect(result?.minor).toBe(2);
      expect(result?.patch).toBe(0);
    });

    test("parses version with prerelease", () => {
      const result = parseVersion("1.2.3-alpha.1");
      expect(result).not.toBeNull();
      expect(result?.prerelease).toBe("alpha.1");
    });

    test("parses version with build metadata", () => {
      const result = parseVersion("1.2.3+build.123");
      expect(result).not.toBeNull();
      expect(result?.build).toBe("build.123");
    });

    test("parses version with prerelease and build", () => {
      const result = parseVersion("1.2.3-beta.2+build.456");
      expect(result).not.toBeNull();
      expect(result?.prerelease).toBe("beta.2");
      expect(result?.build).toBe("build.456");
    });

    test("trims whitespace", () => {
      const result = parseVersion("  1.2.3  ");
      expect(result).not.toBeNull();
      expect(result?.major).toBe(1);
    });

    test("stores raw version", () => {
      const result = parseVersion("v1.2.3");
      expect(result?.raw).toBe("v1.2.3");
    });

    test("returns null for invalid version", () => {
      expect(parseVersion("invalid")).toBeNull();
      expect(parseVersion("")).toBeNull();
      expect(parseVersion("a.b.c")).toBeNull();
    });
  });

  describe("isValidVersion", () => {
    test("returns true for valid versions", () => {
      expect(isValidVersion("1.0.0")).toBe(true);
      expect(isValidVersion("0.0.1")).toBe(true);
      expect(isValidVersion("1.2.3-alpha")).toBe(true);
      expect(isValidVersion("v2.0.0")).toBe(true);
    });

    test("returns false for invalid versions", () => {
      expect(isValidVersion("invalid")).toBe(false);
      expect(isValidVersion("")).toBe(false);
      expect(isValidVersion("1.2.x")).toBe(false);
    });
  });

  describe("compareVersions", () => {
    test("compares major versions", () => {
      expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
      expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
    });

    test("compares minor versions", () => {
      expect(compareVersions("1.0.0", "1.1.0")).toBe(-1);
      expect(compareVersions("1.1.0", "1.0.0")).toBe(1);
    });

    test("compares patch versions", () => {
      expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
      expect(compareVersions("1.0.1", "1.0.0")).toBe(1);
    });

    test("returns 0 for equal versions", () => {
      expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
      expect(compareVersions("v1.0.0", "1.0.0")).toBe(0);
    });

    test("prerelease is less than release", () => {
      expect(compareVersions("1.0.0-alpha", "1.0.0")).toBe(-1);
      expect(compareVersions("1.0.0", "1.0.0-alpha")).toBe(1);
    });

    test("compares prereleases", () => {
      expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
      expect(compareVersions("1.0.0-alpha.1", "1.0.0-alpha.2")).toBe(-1);
      expect(compareVersions("1.0.0-1", "1.0.0-2")).toBe(-1);
    });

    test("handles invalid versions", () => {
      expect(compareVersions("invalid", "1.0.0")).toBe(1);
      expect(compareVersions("1.0.0", "invalid")).toBe(-1);
      expect(compareVersions("invalid", "invalid")).toBe(0);
    });
  });

  describe("parseRange", () => {
    test("parses exact range", () => {
      const result = parseRange("=1.0.0");
      expect(result).not.toBeNull();
      expect(result?.operator).toBe("=");
      expect(result?.version.major).toBe(1);
    });

    test("parses greater than range", () => {
      const result = parseRange(">1.0.0");
      expect(result).not.toBeNull();
      expect(result?.operator).toBe(">");
    });

    test("parses greater or equal range", () => {
      const result = parseRange(">=1.0.0");
      expect(result).not.toBeNull();
      expect(result?.operator).toBe(">=");
    });

    test("parses less than range", () => {
      const result = parseRange("<2.0.0");
      expect(result).not.toBeNull();
      expect(result?.operator).toBe("<");
    });

    test("parses less or equal range", () => {
      const result = parseRange("<=2.0.0");
      expect(result).not.toBeNull();
      expect(result?.operator).toBe("<=");
    });

    test("parses caret range", () => {
      const result = parseRange("^1.0.0");
      expect(result).not.toBeNull();
      expect(result?.operator).toBe("^");
    });

    test("parses tilde range", () => {
      const result = parseRange("~1.0.0");
      expect(result).not.toBeNull();
      expect(result?.operator).toBe("~");
    });

    test("defaults to exact match without operator", () => {
      const result = parseRange("1.0.0");
      expect(result).not.toBeNull();
      expect(result?.operator).toBe("=");
    });

    test("returns null for invalid range", () => {
      expect(parseRange("")).toBeNull();
      expect(parseRange("invalid")).toBeNull();
    });
  });

  describe("satisfiesRange", () => {
    test("exact match", () => {
      expect(satisfiesRange("1.0.0", "=1.0.0")).toBe(true);
      expect(satisfiesRange("1.0.0", "1.0.0")).toBe(true);
      expect(satisfiesRange("1.0.1", "=1.0.0")).toBe(false);
    });

    test("greater than", () => {
      expect(satisfiesRange("1.0.1", ">1.0.0")).toBe(true);
      expect(satisfiesRange("1.0.0", ">1.0.0")).toBe(false);
      expect(satisfiesRange("0.9.0", ">1.0.0")).toBe(false);
    });

    test("greater or equal", () => {
      expect(satisfiesRange("1.0.1", ">=1.0.0")).toBe(true);
      expect(satisfiesRange("1.0.0", ">=1.0.0")).toBe(true);
      expect(satisfiesRange("0.9.0", ">=1.0.0")).toBe(false);
    });

    test("less than", () => {
      expect(satisfiesRange("0.9.0", "<1.0.0")).toBe(true);
      expect(satisfiesRange("1.0.0", "<1.0.0")).toBe(false);
      expect(satisfiesRange("1.0.1", "<1.0.0")).toBe(false);
    });

    test("less or equal", () => {
      expect(satisfiesRange("0.9.0", "<=1.0.0")).toBe(true);
      expect(satisfiesRange("1.0.0", "<=1.0.0")).toBe(true);
      expect(satisfiesRange("1.0.1", "<=1.0.0")).toBe(false);
    });

    test("caret range with major version", () => {
      // ^1.2.3 := >=1.2.3 <2.0.0
      expect(satisfiesRange("1.2.3", "^1.2.3")).toBe(true);
      expect(satisfiesRange("1.3.0", "^1.2.3")).toBe(true);
      expect(satisfiesRange("1.9.9", "^1.2.3")).toBe(true);
      expect(satisfiesRange("2.0.0", "^1.2.3")).toBe(false);
      expect(satisfiesRange("1.2.2", "^1.2.3")).toBe(false);
    });

    test("caret range with 0.x", () => {
      // ^0.2.3 := >=0.2.3 <0.3.0
      expect(satisfiesRange("0.2.3", "^0.2.3")).toBe(true);
      expect(satisfiesRange("0.2.9", "^0.2.3")).toBe(true);
      expect(satisfiesRange("0.3.0", "^0.2.3")).toBe(false);
    });

    test("caret range with 0.0.x", () => {
      // ^0.0.3 := >=0.0.3 <0.0.4
      expect(satisfiesRange("0.0.3", "^0.0.3")).toBe(true);
      expect(satisfiesRange("0.0.4", "^0.0.3")).toBe(false);
    });

    test("tilde range", () => {
      // ~1.2.3 := >=1.2.3 <1.3.0
      expect(satisfiesRange("1.2.3", "~1.2.3")).toBe(true);
      expect(satisfiesRange("1.2.9", "~1.2.3")).toBe(true);
      expect(satisfiesRange("1.3.0", "~1.2.3")).toBe(false);
      expect(satisfiesRange("1.2.2", "~1.2.3")).toBe(false);
    });

    test("returns false for invalid input", () => {
      expect(satisfiesRange("invalid", "1.0.0")).toBe(false);
      expect(satisfiesRange("1.0.0", "invalid")).toBe(false);
    });
  });

  describe("sortVersions", () => {
    test("sorts versions ascending", () => {
      const result = sortVersions(["2.0.0", "1.0.0", "1.1.0"]);
      expect(result).toEqual(["1.0.0", "1.1.0", "2.0.0"]);
    });

    test("handles prerelease versions", () => {
      const result = sortVersions(["1.0.0", "1.0.0-alpha", "1.0.0-beta"]);
      expect(result).toEqual(["1.0.0-alpha", "1.0.0-beta", "1.0.0"]);
    });

    test("does not modify original array", () => {
      const original = ["2.0.0", "1.0.0"];
      sortVersions(original);
      expect(original).toEqual(["2.0.0", "1.0.0"]);
    });
  });

  describe("getHighestVersion", () => {
    test("returns highest version", () => {
      expect(getHighestVersion(["1.0.0", "2.0.0", "1.5.0"])).toBe("2.0.0");
    });

    test("returns null for empty array", () => {
      expect(getHighestVersion([])).toBeNull();
    });

    test("filters invalid versions", () => {
      expect(getHighestVersion(["invalid", "1.0.0", "also-invalid"])).toBe("1.0.0");
    });

    test("returns null if all invalid", () => {
      expect(getHighestVersion(["invalid", "also-invalid"])).toBeNull();
    });

    test("handles versions published out of order", () => {
      // This tests the scenario where 1.0.1 is published after 1.0.0
      // but array order doesn't reflect semver order
      expect(getHighestVersion(["1.0.0", "1.0.1"])).toBe("1.0.1");
      expect(getHighestVersion(["1.0.1", "1.0.0"])).toBe("1.0.1");
    });

    test("handles mixed major/minor/patch versions", () => {
      expect(getHighestVersion(["1.0.0", "1.0.1", "1.1.0", "2.0.0", "0.9.0"])).toBe("2.0.0");
    });
  });

  describe("getHighestNonYankedVersion (registry use case)", () => {
    // Simulates the server-side logic for finding latest version
    const getHighestNonYanked = (
      versions: Array<{ version: string; yanked: boolean }>
    ): string | null => {
      const sorted = [...versions].sort((a, b) => -compareVersions(a.version, b.version));
      const latest = sorted.find((v) => !v.yanked) ?? sorted[0];
      return latest?.version ?? null;
    };

    test("returns highest non-yanked version", () => {
      const versions = [
        { version: "1.0.0", yanked: false },
        { version: "1.0.1", yanked: true },
        { version: "1.0.2", yanked: false },
      ];
      expect(getHighestNonYanked(versions)).toBe("1.0.2");
    });

    test("skips yanked highest version", () => {
      const versions = [
        { version: "1.0.0", yanked: false },
        { version: "2.0.0", yanked: true },
      ];
      expect(getHighestNonYanked(versions)).toBe("1.0.0");
    });

    test("falls back to highest if all yanked", () => {
      const versions = [
        { version: "1.0.0", yanked: true },
        { version: "2.0.0", yanked: true },
      ];
      expect(getHighestNonYanked(versions)).toBe("2.0.0");
    });

    test("handles unsorted input (bug fix scenario)", () => {
      // This is the exact bug we fixed - versions not sorted by semver
      const versions = [
        { version: "1.0.0", yanked: false }, // published first
        { version: "1.0.1", yanked: false }, // published second
      ];
      expect(getHighestNonYanked(versions)).toBe("1.0.1");

      // Even if array order is reversed
      const versionsReversed = [
        { version: "1.0.1", yanked: false },
        { version: "1.0.0", yanked: false },
      ];
      expect(getHighestNonYanked(versionsReversed)).toBe("1.0.1");
    });

    test("returns null for empty array", () => {
      expect(getHighestNonYanked([])).toBeNull();
    });
  });

  describe("incrementVersion", () => {
    test("increments major", () => {
      expect(incrementVersion("1.2.3", "major")).toBe("2.0.0");
    });

    test("increments minor", () => {
      expect(incrementVersion("1.2.3", "minor")).toBe("1.3.0");
    });

    test("increments patch", () => {
      expect(incrementVersion("1.2.3", "patch")).toBe("1.2.4");
    });

    test("returns null for invalid version", () => {
      expect(incrementVersion("invalid", "patch")).toBeNull();
    });
  });

  describe("coerceVersion", () => {
    test("coerces complete version", () => {
      expect(coerceVersion("1.2.3")).toBe("1.2.3");
    });

    test("fills in missing minor and patch", () => {
      expect(coerceVersion("1")).toBe("1.0.0");
    });

    test("fills in missing patch", () => {
      expect(coerceVersion("1.2")).toBe("1.2.0");
    });

    test("strips prerelease and build", () => {
      expect(coerceVersion("1.2.3-alpha")).toBe("1.2.3");
    });

    test("handles v prefix", () => {
      expect(coerceVersion("v1.2.3")).toBe("1.2.3");
    });

    test("returns null for non-version", () => {
      expect(coerceVersion("invalid")).toBeNull();
    });
  });

  describe("formatVersion", () => {
    test("formats simple version", () => {
      expect(
        formatVersion({
          major: 1,
          minor: 2,
          patch: 3,
          raw: "1.2.3",
        })
      ).toBe("1.2.3");
    });

    test("formats version with prerelease", () => {
      expect(
        formatVersion({
          major: 1,
          minor: 0,
          patch: 0,
          prerelease: "alpha.1",
          raw: "1.0.0-alpha.1",
        })
      ).toBe("1.0.0-alpha.1");
    });

    test("formats version with build", () => {
      expect(
        formatVersion({
          major: 1,
          minor: 0,
          patch: 0,
          build: "build.123",
          raw: "1.0.0+build.123",
        })
      ).toBe("1.0.0+build.123");
    });

    test("formats version with prerelease and build", () => {
      expect(
        formatVersion({
          major: 1,
          minor: 0,
          patch: 0,
          prerelease: "beta.2",
          build: "build.456",
          raw: "1.0.0-beta.2+build.456",
        })
      ).toBe("1.0.0-beta.2+build.456");
    });
  });
});
