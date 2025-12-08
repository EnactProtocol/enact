/**
 * Tests for exit codes
 */

import { describe, expect, test } from "bun:test";
import {
  EXIT_AUTH_ERROR,
  EXIT_CANTCREAT,
  EXIT_CONFIG,
  EXIT_CONTAINER_ERROR,
  EXIT_DATAERR,
  EXIT_EXECUTION_ERROR,
  EXIT_FAILURE,
  EXIT_IOERR,
  EXIT_MANIFEST_ERROR,
  EXIT_NETWORK_ERROR,
  EXIT_NOHOST,
  EXIT_NOINPUT,
  EXIT_NOPERM,
  EXIT_NOUSER,
  EXIT_OSERR,
  EXIT_OSFILE,
  EXIT_PROTOCOL,
  EXIT_REGISTRY_ERROR,
  EXIT_SOFTWARE,
  EXIT_SUCCESS,
  EXIT_TEMPFAIL,
  EXIT_TIMEOUT,
  EXIT_TOOL_NOT_FOUND,
  EXIT_TRUST_ERROR,
  EXIT_UNAVAILABLE,
  EXIT_USAGE,
  EXIT_VALIDATION_ERROR,
  getExitCodeDescription,
} from "../../src/utils";

describe("exit codes", () => {
  describe("standard exit codes", () => {
    test("EXIT_SUCCESS is 0", () => {
      expect(EXIT_SUCCESS).toBe(0);
    });

    test("EXIT_FAILURE is 1", () => {
      expect(EXIT_FAILURE).toBe(1);
    });

    test("EXIT_USAGE is 2", () => {
      expect(EXIT_USAGE).toBe(2);
    });
  });

  describe("sysexits.h compatible codes", () => {
    test("EXIT_DATAERR is 65", () => {
      expect(EXIT_DATAERR).toBe(65);
    });

    test("EXIT_NOINPUT is 66", () => {
      expect(EXIT_NOINPUT).toBe(66);
    });

    test("EXIT_NOUSER is 67", () => {
      expect(EXIT_NOUSER).toBe(67);
    });

    test("EXIT_NOHOST is 68", () => {
      expect(EXIT_NOHOST).toBe(68);
    });

    test("EXIT_UNAVAILABLE is 69", () => {
      expect(EXIT_UNAVAILABLE).toBe(69);
    });

    test("EXIT_SOFTWARE is 70", () => {
      expect(EXIT_SOFTWARE).toBe(70);
    });

    test("EXIT_OSERR is 71", () => {
      expect(EXIT_OSERR).toBe(71);
    });

    test("EXIT_OSFILE is 72", () => {
      expect(EXIT_OSFILE).toBe(72);
    });

    test("EXIT_CANTCREAT is 73", () => {
      expect(EXIT_CANTCREAT).toBe(73);
    });

    test("EXIT_IOERR is 74", () => {
      expect(EXIT_IOERR).toBe(74);
    });

    test("EXIT_TEMPFAIL is 75", () => {
      expect(EXIT_TEMPFAIL).toBe(75);
    });

    test("EXIT_PROTOCOL is 76", () => {
      expect(EXIT_PROTOCOL).toBe(76);
    });

    test("EXIT_NOPERM is 77", () => {
      expect(EXIT_NOPERM).toBe(77);
    });

    test("EXIT_CONFIG is 78", () => {
      expect(EXIT_CONFIG).toBe(78);
    });
  });

  describe("enact-specific codes", () => {
    test("EXIT_TOOL_NOT_FOUND is 100", () => {
      expect(EXIT_TOOL_NOT_FOUND).toBe(100);
    });

    test("EXIT_MANIFEST_ERROR is 101", () => {
      expect(EXIT_MANIFEST_ERROR).toBe(101);
    });

    test("EXIT_EXECUTION_ERROR is 102", () => {
      expect(EXIT_EXECUTION_ERROR).toBe(102);
    });

    test("EXIT_TIMEOUT is 103", () => {
      expect(EXIT_TIMEOUT).toBe(103);
    });

    test("EXIT_TRUST_ERROR is 104", () => {
      expect(EXIT_TRUST_ERROR).toBe(104);
    });

    test("EXIT_REGISTRY_ERROR is 105", () => {
      expect(EXIT_REGISTRY_ERROR).toBe(105);
    });

    test("EXIT_AUTH_ERROR is 106", () => {
      expect(EXIT_AUTH_ERROR).toBe(106);
    });

    test("EXIT_VALIDATION_ERROR is 107", () => {
      expect(EXIT_VALIDATION_ERROR).toBe(107);
    });

    test("EXIT_NETWORK_ERROR is 108", () => {
      expect(EXIT_NETWORK_ERROR).toBe(108);
    });

    test("EXIT_CONTAINER_ERROR is 109", () => {
      expect(EXIT_CONTAINER_ERROR).toBe(109);
    });
  });

  describe("getExitCodeDescription", () => {
    test("describes EXIT_SUCCESS", () => {
      expect(getExitCodeDescription(EXIT_SUCCESS)).toBe("Success");
    });

    test("describes EXIT_FAILURE", () => {
      expect(getExitCodeDescription(EXIT_FAILURE)).toBe("General error");
    });

    test("describes EXIT_USAGE", () => {
      expect(getExitCodeDescription(EXIT_USAGE)).toBe("Invalid command line arguments");
    });

    test("describes EXIT_TOOL_NOT_FOUND", () => {
      expect(getExitCodeDescription(EXIT_TOOL_NOT_FOUND)).toBe("Tool not found");
    });

    test("describes EXIT_MANIFEST_ERROR", () => {
      expect(getExitCodeDescription(EXIT_MANIFEST_ERROR)).toBe("Manifest error");
    });

    test("describes EXIT_TRUST_ERROR", () => {
      expect(getExitCodeDescription(EXIT_TRUST_ERROR)).toBe("Trust verification failed");
    });

    test("describes EXIT_AUTH_ERROR", () => {
      expect(getExitCodeDescription(EXIT_AUTH_ERROR)).toBe("Authentication error");
    });

    test("describes EXIT_REGISTRY_ERROR", () => {
      expect(getExitCodeDescription(EXIT_REGISTRY_ERROR)).toBe("Registry error");
    });

    test("returns unknown for unrecognized codes", () => {
      expect(getExitCodeDescription(999)).toBe("Unknown error (code 999)");
    });
  });
});
