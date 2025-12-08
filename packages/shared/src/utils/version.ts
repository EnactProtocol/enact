/**
 * @enactprotocol/shared - Version utilities
 *
 * Provides semver parsing, comparison, and range checking.
 */

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string | undefined;
  build?: string | undefined;
  raw: string;
}

export interface VersionRange {
  operator: "=" | ">" | ">=" | "<" | "<=" | "^" | "~";
  version: ParsedVersion;
  raw: string;
}

/**
 * Parse a semver version string
 * Supports: 1.0.0, 1.0, 1, 1.0.0-alpha, 1.0.0+build, 1.0.0-alpha+build
 */
export function parseVersion(version: string): ParsedVersion | null {
  const trimmed = version.trim();

  // Remove leading 'v' if present (common in tags)
  const normalized = trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;

  // Full semver regex with prerelease and build metadata
  const semverRegex =
    /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/;
  const match = normalized.match(semverRegex);

  if (!match) {
    return null;
  }

  const major = Number.parseInt(match[1] ?? "0", 10);
  const minor = Number.parseInt(match[2] ?? "0", 10);
  const patch = Number.parseInt(match[3] ?? "0", 10);

  return {
    major,
    minor,
    patch,
    prerelease: match[4],
    build: match[5],
    raw: trimmed,
  };
}

/**
 * Check if a string is a valid semver version
 */
export function isValidVersion(version: string): boolean {
  return parseVersion(version) !== null;
}

/**
 * Compare two version strings
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);

  // Invalid versions sort last
  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return 1;
  if (!parsedB) return -1;

  // Compare major.minor.patch
  if (parsedA.major !== parsedB.major) {
    return parsedA.major < parsedB.major ? -1 : 1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor < parsedB.minor ? -1 : 1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch < parsedB.patch ? -1 : 1;
  }

  // Prerelease comparison
  // A version without prerelease is greater than one with
  if (!parsedA.prerelease && parsedB.prerelease) return 1;
  if (parsedA.prerelease && !parsedB.prerelease) return -1;

  // Both have prereleases - compare lexically
  if (parsedA.prerelease && parsedB.prerelease) {
    const prereleaseCompare = comparePrerelease(parsedA.prerelease, parsedB.prerelease);
    if (prereleaseCompare !== 0) return prereleaseCompare;
  }

  return 0;
}

/**
 * Compare prerelease strings according to semver rules
 */
function comparePrerelease(a: string, b: string): -1 | 0 | 1 {
  const partsA = a.split(".");
  const partsB = b.split(".");

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i];
    const partB = partsB[i];

    // Shorter prerelease is less than longer
    if (partA === undefined) return -1;
    if (partB === undefined) return 1;

    const numA = Number.parseInt(partA, 10);
    const numB = Number.parseInt(partB, 10);

    const isNumA = !Number.isNaN(numA) && String(numA) === partA;
    const isNumB = !Number.isNaN(numB) && String(numB) === partB;

    // Numeric identifiers are less than alphanumeric
    if (isNumA && !isNumB) return -1;
    if (!isNumA && isNumB) return 1;

    // Both numeric - compare as numbers
    if (isNumA && isNumB) {
      if (numA < numB) return -1;
      if (numA > numB) return 1;
      continue;
    }

    // Both alphanumeric - compare lexically
    if (partA < partB) return -1;
    if (partA > partB) return 1;
  }

  return 0;
}

/**
 * Parse a version range string
 * Supports: =1.0.0, >1.0.0, >=1.0.0, <1.0.0, <=1.0.0, ^1.0.0, ~1.0.0
 */
export function parseRange(range: string): VersionRange | null {
  const trimmed = range.trim();

  // Match operator at start
  const rangeRegex = /^([=><^~]+)?\s*(.+)$/;
  const match = trimmed.match(rangeRegex);

  if (!match || !match[2]) {
    return null;
  }

  const operator = (match[1] ?? "=") as VersionRange["operator"];
  const versionStr = match[2];

  // Validate operator
  if (!["=", ">", ">=", "<", "<=", "^", "~"].includes(operator)) {
    return null;
  }

  const version = parseVersion(versionStr);
  if (!version) {
    return null;
  }

  return {
    operator,
    version,
    raw: trimmed,
  };
}

/**
 * Check if a version satisfies a range
 */
export function satisfiesRange(version: string, range: string): boolean {
  const parsedVersion = parseVersion(version);
  const parsedRange = parseRange(range);

  if (!parsedVersion || !parsedRange) {
    return false;
  }

  const comparison = compareVersions(version, parsedRange.version.raw);

  switch (parsedRange.operator) {
    case "=":
      return comparison === 0;
    case ">":
      return comparison === 1;
    case ">=":
      return comparison >= 0;
    case "<":
      return comparison === -1;
    case "<=":
      return comparison <= 0;
    case "^":
      // Caret range: compatible changes (same major, >= version)
      // ^1.2.3 := >=1.2.3 <2.0.0
      // ^0.2.3 := >=0.2.3 <0.3.0
      // ^0.0.3 := >=0.0.3 <0.0.4
      if (comparison === -1) return false;
      if (parsedRange.version.major === 0) {
        if (parsedRange.version.minor === 0) {
          // ^0.0.x - must be exact patch
          return parsedVersion.patch === parsedRange.version.patch;
        }
        // ^0.x - must be same minor
        return parsedVersion.minor === parsedRange.version.minor;
      }
      // ^x - must be same major
      return parsedVersion.major === parsedRange.version.major;
    case "~":
      // Tilde range: patch-level changes (same major.minor, >= version)
      // ~1.2.3 := >=1.2.3 <1.3.0
      if (comparison === -1) return false;
      return (
        parsedVersion.major === parsedRange.version.major &&
        parsedVersion.minor === parsedRange.version.minor
      );
    default:
      return false;
  }
}

/**
 * Sort versions in ascending order
 */
export function sortVersions(versions: string[]): string[] {
  return [...versions].sort(compareVersions);
}

/**
 * Get the highest version from a list
 */
export function getHighestVersion(versions: string[]): string | null {
  const valid = versions.filter(isValidVersion);
  if (valid.length === 0) return null;

  const sorted = sortVersions(valid);
  const last = sorted[sorted.length - 1];
  return last ?? null;
}

/**
 * Increment a version by bump type
 */
export function incrementVersion(
  version: string,
  bump: "major" | "minor" | "patch"
): string | null {
  const parsed = parseVersion(version);
  if (!parsed) return null;

  switch (bump) {
    case "major":
      return `${parsed.major + 1}.0.0`;
    case "minor":
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case "patch":
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }
}

/**
 * Coerce a string to a valid semver, filling in missing parts
 */
export function coerceVersion(version: string): string | null {
  const trimmed = version.trim();
  const normalized = trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;

  // Try parsing as-is first
  const parsed = parseVersion(normalized);
  if (parsed) {
    return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  }

  // Try extracting numbers
  const numbers = normalized.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!numbers) {
    return null;
  }

  const major = Number.parseInt(numbers[1] ?? "0", 10);
  const minor = Number.parseInt(numbers[2] ?? "0", 10);
  const patch = Number.parseInt(numbers[3] ?? "0", 10);

  return `${major}.${minor}.${patch}`;
}

/**
 * Format a parsed version back to string
 */
export function formatVersion(version: ParsedVersion): string {
  let result = `${version.major}.${version.minor}.${version.patch}`;
  if (version.prerelease) {
    result += `-${version.prerelease}`;
  }
  if (version.build) {
    result += `+${version.build}`;
  }
  return result;
}
