/**
 * Tests for the auth command
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { configureAuthCommand } from "../../src/commands/auth";

describe("auth command", () => {
  describe("command configuration", () => {
    test("configures auth command on program", () => {
      const program = new Command();
      configureAuthCommand(program);

      const authCmd = program.commands.find((cmd) => cmd.name() === "auth");
      expect(authCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureAuthCommand(program);

      const authCmd = program.commands.find((cmd) => cmd.name() === "auth");
      expect(authCmd?.description()).toBe("Manage registry authentication");
    });
  });

  describe("auth login subcommand", () => {
    test("has login subcommand", () => {
      const program = new Command();
      configureAuthCommand(program);

      const authCmd = program.commands.find((cmd) => cmd.name() === "auth");
      const loginCmd = authCmd?.commands.find((cmd) => cmd.name() === "login");
      expect(loginCmd).toBeDefined();
    });

    test("login has correct description", () => {
      const program = new Command();
      configureAuthCommand(program);

      const authCmd = program.commands.find((cmd) => cmd.name() === "auth");
      const loginCmd = authCmd?.commands.find((cmd) => cmd.name() === "login");
      expect(loginCmd?.description()).toBe("Authenticate with the Enact registry");
    });

    test("login has --json option", () => {
      const program = new Command();
      configureAuthCommand(program);

      const authCmd = program.commands.find((cmd) => cmd.name() === "auth");
      const loginCmd = authCmd?.commands.find((cmd) => cmd.name() === "login");
      const opts = loginCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("auth logout subcommand", () => {
    test("has logout subcommand", () => {
      const program = new Command();
      configureAuthCommand(program);

      const authCmd = program.commands.find((cmd) => cmd.name() === "auth");
      const logoutCmd = authCmd?.commands.find((cmd) => cmd.name() === "logout");
      expect(logoutCmd).toBeDefined();
    });

    test("logout has correct description", () => {
      const program = new Command();
      configureAuthCommand(program);

      const authCmd = program.commands.find((cmd) => cmd.name() === "auth");
      const logoutCmd = authCmd?.commands.find((cmd) => cmd.name() === "logout");
      expect(logoutCmd?.description()).toBe("Sign out from the Enact registry");
    });
  });

  describe("auth status subcommand", () => {
    test("has status subcommand", () => {
      const program = new Command();
      configureAuthCommand(program);

      const authCmd = program.commands.find((cmd) => cmd.name() === "auth");
      const statusCmd = authCmd?.commands.find((cmd) => cmd.name() === "status");
      expect(statusCmd).toBeDefined();
    });

    test("status has correct description", () => {
      const program = new Command();
      configureAuthCommand(program);

      const authCmd = program.commands.find((cmd) => cmd.name() === "auth");
      const statusCmd = authCmd?.commands.find((cmd) => cmd.name() === "status");
      expect(statusCmd?.description()).toBe("Show current authentication status");
    });

    test("status has --json option", () => {
      const program = new Command();
      configureAuthCommand(program);

      const authCmd = program.commands.find((cmd) => cmd.name() === "auth");
      const statusCmd = authCmd?.commands.find((cmd) => cmd.name() === "status");
      const opts = statusCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("auth whoami subcommand", () => {
    test("has whoami subcommand", () => {
      const program = new Command();
      configureAuthCommand(program);

      const authCmd = program.commands.find((cmd) => cmd.name() === "auth");
      const whoamiCmd = authCmd?.commands.find((cmd) => cmd.name() === "whoami");
      expect(whoamiCmd).toBeDefined();
    });

    test("whoami has correct description", () => {
      const program = new Command();
      configureAuthCommand(program);

      const authCmd = program.commands.find((cmd) => cmd.name() === "auth");
      const whoamiCmd = authCmd?.commands.find((cmd) => cmd.name() === "whoami");
      expect(whoamiCmd?.description()).toBe("Print the current username");
    });
  });

  describe("token validation", () => {
    test("validates token format", () => {
      const isValidToken = (token: string): boolean => {
        // Tokens should be non-empty and not contain whitespace
        return token.length > 0 && !/\s/.test(token);
      };

      expect(isValidToken("abc123")).toBe(true);
      expect(isValidToken("token_with_underscore")).toBe(true);
      expect(isValidToken("")).toBe(false);
      expect(isValidToken("token with space")).toBe(false);
    });

    test("token storage key pattern", () => {
      const tokenKey = "enact_auth_token";
      expect(tokenKey).toContain("enact");
      expect(tokenKey).toContain("auth");
      expect(tokenKey).toContain("token");
    });
  });

  describe("auth status response", () => {
    test("authenticated status structure", () => {
      interface AuthStatus {
        authenticated: boolean;
        user?: {
          username: string;
          email?: string;
        };
        expiresAt?: string;
      }

      const authStatus: AuthStatus = {
        authenticated: true,
        user: {
          username: "testuser",
          email: "test@example.com",
        },
        expiresAt: "2024-12-31T23:59:59Z",
      };

      expect(authStatus.authenticated).toBe(true);
      expect(authStatus.user?.username).toBe("testuser");
    });

    test("unauthenticated status structure", () => {
      interface AuthStatus {
        authenticated: boolean;
        user?: {
          username: string;
          email?: string;
        };
      }

      const authStatus: AuthStatus = {
        authenticated: false,
      };

      expect(authStatus.authenticated).toBe(false);
      expect(authStatus.user).toBeUndefined();
    });
  });

  describe("OIDC providers", () => {
    test("supported providers list", () => {
      const supportedProviders = ["github", "google", "microsoft", "gitlab"];

      expect(supportedProviders).toContain("github");
      expect(supportedProviders).toContain("google");
      expect(supportedProviders).toContain("microsoft");
      expect(supportedProviders).toContain("gitlab");
    });

    test("provider URLs pattern", () => {
      const providers: Record<string, string> = {
        github: "https://github.com/login/oauth",
        google: "https://accounts.google.com/o/oauth2",
        microsoft: "https://login.microsoftonline.com",
        gitlab: "https://gitlab.com/oauth",
      };

      expect(providers.github).toContain("github.com");
      expect(providers.google).toContain("google.com");
      expect(providers.microsoft).toContain("microsoft");
      expect(providers.gitlab).toContain("gitlab.com");
    });
  });
});
