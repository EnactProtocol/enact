/**
 * Tests for the serve command
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { configureServeCommand } from "../../src/commands/serve";

describe("serve command", () => {
  describe("command configuration", () => {
    test("configures serve command on program", () => {
      const program = new Command();
      configureServeCommand(program);

      const serveCmd = program.commands.find((cmd) => cmd.name() === "serve");
      expect(serveCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureServeCommand(program);

      const serveCmd = program.commands.find((cmd) => cmd.name() === "serve");
      expect(serveCmd?.description()).toBe("Start a self-hosted Enact registry server");
    });
  });

  describe("options", () => {
    test("has --port option with default 3000", () => {
      const program = new Command();
      configureServeCommand(program);

      const serveCmd = program.commands.find((cmd) => cmd.name() === "serve");
      const opts = serveCmd?.options ?? [];
      const portOpt = opts.find((o) => o.long === "--port");
      expect(portOpt).toBeDefined();
      expect(portOpt?.defaultValue).toBe("3000");
    });

    test("has -p short option for port", () => {
      const program = new Command();
      configureServeCommand(program);

      const serveCmd = program.commands.find((cmd) => cmd.name() === "serve");
      const opts = serveCmd?.options ?? [];
      const portOpt = opts.find((o) => o.short === "-p");
      expect(portOpt).toBeDefined();
    });

    test("has --data option with default ./registry-data", () => {
      const program = new Command();
      configureServeCommand(program);

      const serveCmd = program.commands.find((cmd) => cmd.name() === "serve");
      const opts = serveCmd?.options ?? [];
      const dataOpt = opts.find((o) => o.long === "--data");
      expect(dataOpt).toBeDefined();
      expect(dataOpt?.defaultValue).toBe("./registry-data");
    });

    test("has -d short option for data", () => {
      const program = new Command();
      configureServeCommand(program);

      const serveCmd = program.commands.find((cmd) => cmd.name() === "serve");
      const opts = serveCmd?.options ?? [];
      const dataOpt = opts.find((o) => o.short === "-d");
      expect(dataOpt).toBeDefined();
    });

    test("has --host option with default 0.0.0.0", () => {
      const program = new Command();
      configureServeCommand(program);

      const serveCmd = program.commands.find((cmd) => cmd.name() === "serve");
      const opts = serveCmd?.options ?? [];
      const hostOpt = opts.find((o) => o.long === "--host");
      expect(hostOpt).toBeDefined();
      expect(hostOpt?.defaultValue).toBe("0.0.0.0");
    });
  });
});
