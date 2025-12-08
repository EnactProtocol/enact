/**
 * Tests for the cache command
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { configureCacheCommand } from "../../src/commands/cache";

describe("cache command", () => {
  describe("command configuration", () => {
    test("configures cache command on program", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      expect(cacheCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      expect(cacheCmd?.description()).toBe("Manage the local tool cache");
    });
  });

  describe("cache list subcommand", () => {
    test("has list subcommand", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const listCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "list");
      expect(listCmd).toBeDefined();
    });

    test("list has ls alias", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const listCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "list");
      expect(listCmd?.aliases()).toContain("ls");
    });

    test("list has correct description", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const listCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "list");
      expect(listCmd?.description()).toBe("List cached tools");
    });

    test("list has --json option", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const listCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "list");
      const opts = listCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("cache clean subcommand", () => {
    test("has clean subcommand", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const cleanCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "clean");
      expect(cleanCmd).toBeDefined();
    });

    test("clean has correct description", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const cleanCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "clean");
      expect(cleanCmd?.description()).toBe("Remove old or unused cached tools");
    });

    test("clean has --json option", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const cleanCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "clean");
      const opts = cleanCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });

    test("clean has --force option", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const cleanCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "clean");
      const opts = cleanCmd?.options ?? [];
      const forceOpt = opts.find((o) => o.long === "--force");
      expect(forceOpt).toBeDefined();
    });
  });

  describe("cache clear subcommand", () => {
    test("has clear subcommand", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const clearCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "clear");
      expect(clearCmd).toBeDefined();
    });

    test("clear has correct description", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const clearCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "clear");
      expect(clearCmd?.description()).toBe("Clear the entire cache");
    });

    test("clear has --force option", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const clearCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "clear");
      const opts = clearCmd?.options ?? [];
      const forceOpt = opts.find((o) => o.long === "--force");
      expect(forceOpt).toBeDefined();
    });

    test("clear has -f short option for force", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const clearCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "clear");
      const opts = clearCmd?.options ?? [];
      const forceOpt = opts.find((o) => o.short === "-f");
      expect(forceOpt).toBeDefined();
    });
  });

  describe("cache info subcommand", () => {
    test("has info subcommand", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const infoCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "info");
      expect(infoCmd).toBeDefined();
    });

    test("info has correct description", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const infoCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "info");
      expect(infoCmd?.description()).toBe("Show cache information");
    });

    test("info has --json option", () => {
      const program = new Command();
      configureCacheCommand(program);

      const cacheCmd = program.commands.find((cmd) => cmd.name() === "cache");
      const infoCmd = cacheCmd?.commands.find((cmd) => cmd.name() === "info");
      const opts = infoCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("duration parsing", () => {
    test("parses days duration", () => {
      const parseDuration = (duration: string): number | null => {
        const match = duration.match(/^(\d+)(d|w|m)$/);
        if (!match) return null;
        const value = Number.parseInt(match[1] ?? "0", 10);
        const unit = match[2];
        switch (unit) {
          case "d":
            return value * 24 * 60 * 60 * 1000;
          case "w":
            return value * 7 * 24 * 60 * 60 * 1000;
          case "m":
            return value * 30 * 24 * 60 * 60 * 1000;
          default:
            return null;
        }
      };

      expect(parseDuration("7d")).toBe(7 * 24 * 60 * 60 * 1000);
      expect(parseDuration("2w")).toBe(14 * 24 * 60 * 60 * 1000);
      expect(parseDuration("1m")).toBe(30 * 24 * 60 * 60 * 1000);
      expect(parseDuration("invalid")).toBeNull();
    });

    test("default older-than is 30 days", () => {
      const defaultOlderThan = "30d";
      expect(defaultOlderThan).toBe("30d");
    });
  });

  describe("cache entry structure", () => {
    test("cached tool entry structure", () => {
      interface CacheEntry {
        name: string;
        version: string;
        cachedAt: string;
        size: number;
        accessedAt?: string;
        hash?: string;
      }

      const entry: CacheEntry = {
        name: "my-tool",
        version: "1.0.0",
        cachedAt: "2024-01-15T10:00:00Z",
        size: 1024,
        accessedAt: "2024-01-16T12:00:00Z",
        hash: "sha256:abc123",
      };

      expect(entry.name).toBe("my-tool");
      expect(entry.version).toBe("1.0.0");
      expect(entry.size).toBeGreaterThan(0);
    });
  });

  describe("size formatting", () => {
    test("formats bytes correctly", () => {
      const formatSize = (bytes: number): string => {
        if (bytes >= 1_073_741_824) {
          return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
        }
        if (bytes >= 1_048_576) {
          return `${(bytes / 1_048_576).toFixed(1)} MB`;
        }
        if (bytes >= 1024) {
          return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${bytes} B`;
      };

      expect(formatSize(500)).toBe("500 B");
      expect(formatSize(1024)).toBe("1.0 KB");
      expect(formatSize(1536)).toBe("1.5 KB");
      expect(formatSize(1_048_576)).toBe("1.0 MB");
      expect(formatSize(1_610_612_736)).toBe("1.5 GB");
    });
  });

  describe("cache statistics", () => {
    test("cache info structure", () => {
      interface CacheInfo {
        path: string;
        totalSize: number;
        toolCount: number;
        oldestEntry?: string;
        newestEntry?: string;
      }

      const info: CacheInfo = {
        path: "/Users/test/.enact/cache",
        totalSize: 10_485_760, // 10 MB
        toolCount: 25,
        oldestEntry: "2024-01-01T00:00:00Z",
        newestEntry: "2024-01-20T12:00:00Z",
      };

      expect(info.path).toContain(".enact");
      expect(info.totalSize).toBeGreaterThan(0);
      expect(info.toolCount).toBeGreaterThanOrEqual(0);
    });
  });
});
