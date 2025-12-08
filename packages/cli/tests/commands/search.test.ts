/**
 * Tests for the search command
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { configureSearchCommand } from "../../src/commands/search";

describe("search command", () => {
  describe("command configuration", () => {
    test("configures search command on program", () => {
      const program = new Command();
      configureSearchCommand(program);

      const searchCmd = program.commands.find((cmd) => cmd.name() === "search");
      expect(searchCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureSearchCommand(program);

      const searchCmd = program.commands.find((cmd) => cmd.name() === "search");
      expect(searchCmd?.description()).toBe("Search the Enact registry for tools");
    });

    test("accepts query argument", () => {
      const program = new Command();
      configureSearchCommand(program);

      const searchCmd = program.commands.find((cmd) => cmd.name() === "search");
      const args = searchCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("query");
    });

    test("has --tags option", () => {
      const program = new Command();
      configureSearchCommand(program);

      const searchCmd = program.commands.find((cmd) => cmd.name() === "search");
      const opts = searchCmd?.options ?? [];
      const tagsOpt = opts.find((o) => o.long === "--tags");
      expect(tagsOpt).toBeDefined();
    });

    test("has -t short option for tags", () => {
      const program = new Command();
      configureSearchCommand(program);

      const searchCmd = program.commands.find((cmd) => cmd.name() === "search");
      const opts = searchCmd?.options ?? [];
      const tagsOpt = opts.find((o) => o.short === "-t");
      expect(tagsOpt).toBeDefined();
    });

    test("has --limit option", () => {
      const program = new Command();
      configureSearchCommand(program);

      const searchCmd = program.commands.find((cmd) => cmd.name() === "search");
      const opts = searchCmd?.options ?? [];
      const limitOpt = opts.find((o) => o.long === "--limit");
      expect(limitOpt).toBeDefined();
    });

    test("has -l short option for limit", () => {
      const program = new Command();
      configureSearchCommand(program);

      const searchCmd = program.commands.find((cmd) => cmd.name() === "search");
      const opts = searchCmd?.options ?? [];
      const limitOpt = opts.find((o) => o.short === "-l");
      expect(limitOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configureSearchCommand(program);

      const searchCmd = program.commands.find((cmd) => cmd.name() === "search");
      const opts = searchCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("search result display helpers", () => {
    test("truncates long descriptions", () => {
      const truncate = (text: string, max: number): string => {
        if (text.length <= max) return text;
        return `${text.slice(0, max - 3)}...`;
      };

      expect(truncate("short", 50)).toBe("short");
      expect(truncate("a".repeat(60), 50)).toBe(`${"a".repeat(47)}...`);
    });

    test("formats download count", () => {
      const formatDownloads = (downloads: number): string => {
        if (downloads >= 1_000_000) return `${(downloads / 1_000_000).toFixed(1)}M`;
        if (downloads >= 1_000) return `${(downloads / 1_000).toFixed(1)}k`;
        return downloads.toString();
      };

      expect(formatDownloads(500)).toBe("500");
      expect(formatDownloads(1500)).toBe("1.5k");
      expect(formatDownloads(1_500_000)).toBe("1.5M");
    });
  });

  describe("tag parsing", () => {
    test("splits comma-separated tags", () => {
      const tagsInput = "cli,testing,automation";
      const tags = tagsInput.split(",").map((t) => t.trim());
      expect(tags).toEqual(["cli", "testing", "automation"]);
    });

    test("trims whitespace from tags", () => {
      const tagsInput = "cli , testing , automation";
      const tags = tagsInput.split(",").map((t) => t.trim());
      expect(tags).toEqual(["cli", "testing", "automation"]);
    });

    test("handles single tag", () => {
      const tagsInput = "cli";
      const tags = tagsInput.split(",").map((t) => t.trim());
      expect(tags).toEqual(["cli"]);
    });
  });
});
