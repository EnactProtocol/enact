import { describe, expect, test } from "bun:test";
import {
  collectSecretRefs,
  evaluateCondition,
  evaluateExpression,
  expandObject,
} from "../src/expression";
import type { EvaluationContext } from "../src/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    inputs: { url: "https://example.com", count: 5, flag: true },
    steps: {
      fetch: {
        outputs: { text: "hello world", status: "ok", items: ["a", "b"] },
        status: "success",
      },
      process: {
        outputs: { result: { nested: "value" }, count: 42 },
        status: "success",
      },
    },
    secrets: { API_KEY: "secret-abc", DB_PASS: "hunter2" },
    env: { NODE_ENV: "test", PORT: "3000" },
    ...overrides,
  };
}

// ─── evaluateExpression ────────────────────────────────────────────────────────

describe("evaluateExpression", () => {
  describe("plain strings (no expressions)", () => {
    test("returns string unchanged when no ${{ }} present", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("hello world", ctx)).toBe("hello world");
    });

    test("returns empty string unchanged", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("", ctx)).toBe("");
    });

    test("returns numeric-looking string unchanged", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("42", ctx)).toBe("42");
    });
  });

  describe("single expression — full string", () => {
    test("resolves inputs path", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ inputs.url }}", ctx)).toBe("https://example.com");
    });

    test("resolves inputs numeric value as-is", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ inputs.count }}", ctx)).toBe(5);
    });

    test("resolves inputs boolean value as-is", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ inputs.flag }}", ctx)).toBe(true);
    });

    test("resolves steps.id.outputs.field", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ steps.fetch.outputs.text }}", ctx)).toBe("hello world");
    });

    test("resolves steps.id.outputs.field returning array", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ steps.fetch.outputs.items }}", ctx)).toEqual(["a", "b"]);
    });

    test("resolves steps.id.status", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ steps.fetch.status }}", ctx)).toBe("success");
    });

    test("resolves secrets.KEY", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ secrets.API_KEY }}", ctx)).toBe("secret-abc");
    });

    test("resolves env.VAR", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ env.NODE_ENV }}", ctx)).toBe("test");
    });

    test("returns undefined for unknown root namespace", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ other.value }}", ctx)).toBeUndefined();
    });

    test("returns undefined for missing key in inputs", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ inputs.missing }}", ctx)).toBeUndefined();
    });

    test("returns undefined for missing step id", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ steps.nonexistent.outputs.x }}", ctx)).toBeUndefined();
    });

    test("returns undefined for missing output field", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ steps.fetch.outputs.missing }}", ctx)).toBeUndefined();
    });

    test("handles whitespace inside ${{ }}", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{   inputs.url   }}", ctx)).toBe("https://example.com");
    });
  });

  describe("interpolation — expression mixed with text", () => {
    test("concatenates expression result with surrounding text", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("Value: ${{ inputs.url }}", ctx)).toBe(
        "Value: https://example.com"
      );
    });

    test("handles multiple expressions in one string", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ inputs.url }} (${{ env.NODE_ENV }})", ctx)).toBe(
        "https://example.com (test)"
      );
    });

    test("stringifies numeric values in mixed strings", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("count=${{ inputs.count }}", ctx)).toBe("count=5");
    });

    test("missing value in interpolation becomes empty string", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("prefix-${{ inputs.missing }}-suffix", ctx)).toBe("prefix--suffix");
    });
  });

  describe("comparison operators", () => {
    test("== returns true when values match", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ steps.fetch.outputs.status == 'ok' }}", ctx)).toBe(true);
    });

    test("== returns false when values differ", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ steps.fetch.outputs.status == 'error' }}", ctx)).toBe(false);
    });

    test("!= returns true when values differ", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ steps.fetch.outputs.status != 'error' }}", ctx)).toBe(true);
    });

    test("!= returns false when values match", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ steps.fetch.outputs.status != 'ok' }}", ctx)).toBe(false);
    });

    test("== with double-quoted string literal", () => {
      const ctx = makeCtx();
      expect(evaluateExpression('${{ steps.fetch.outputs.status == "ok" }}', ctx)).toBe(true);
    });

    test("== with numeric literal", () => {
      const ctx = makeCtx();
      expect(evaluateExpression("${{ steps.process.outputs.count == 42 }}", ctx)).toBe(true);
    });
  });
});

// ─── evaluateCondition ─────────────────────────────────────────────────────────

describe("evaluateCondition", () => {
  const ctx = makeCtx();

  test("'true' string returns true", () => {
    expect(evaluateCondition("true", ctx)).toBe(true);
  });

  test("'false' string returns false", () => {
    expect(evaluateCondition("false", ctx)).toBe(false);
  });

  test("resolved boolean true returns true", () => {
    expect(evaluateCondition("${{ inputs.flag }}", ctx)).toBe(true);
  });

  test("non-empty string value is truthy", () => {
    expect(evaluateCondition("${{ inputs.url }}", ctx)).toBe(true);
  });

  test("== comparison evaluating true returns true", () => {
    expect(evaluateCondition("${{ steps.fetch.outputs.status == 'ok' }}", ctx)).toBe(true);
  });

  test("== comparison evaluating false returns false", () => {
    expect(evaluateCondition("${{ steps.fetch.outputs.status == 'fail' }}", ctx)).toBe(false);
  });

  test("undefined resolved value is falsy", () => {
    expect(evaluateCondition("${{ inputs.nonexistent }}", ctx)).toBe(false);
  });

  test("empty string is falsy", () => {
    const ctxWithEmpty = makeCtx({ inputs: { val: "" } });
    expect(evaluateCondition("${{ inputs.val }}", ctxWithEmpty)).toBe(false);
  });

  test("'0' string is falsy", () => {
    const ctxWithZero = makeCtx({ inputs: { val: "0" } });
    expect(evaluateCondition("${{ inputs.val }}", ctxWithZero)).toBe(false);
  });
});

// ─── expandObject ──────────────────────────────────────────────────────────────

describe("expandObject", () => {
  const ctx = makeCtx();

  test("expands all values in an object", () => {
    const result = expandObject(
      {
        url: "${{ inputs.url }}",
        env: "${{ env.NODE_ENV }}",
      },
      ctx
    );
    expect(result).toEqual({
      url: "https://example.com",
      env: "test",
    });
  });

  test("leaves plain string values unchanged", () => {
    const result = expandObject({ key: "plain value" }, ctx);
    expect(result).toEqual({ key: "plain value" });
  });

  test("converts non-string resolved values to strings", () => {
    const result = expandObject({ count: "${{ inputs.count }}" }, ctx);
    expect(result).toEqual({ count: "5" });
  });

  test("converts undefined resolved values to empty string", () => {
    const result = expandObject({ x: "${{ inputs.missing }}" }, ctx);
    expect(result).toEqual({ x: "" });
  });

  test("handles empty object", () => {
    expect(expandObject({}, ctx)).toEqual({});
  });

  test("expands mixed interpolated values", () => {
    const result = expandObject({ label: "Status: ${{ steps.fetch.outputs.status }}" }, ctx);
    expect(result).toEqual({ label: "Status: ok" });
  });
});

// ─── collectSecretRefs ─────────────────────────────────────────────────────────

describe("collectSecretRefs", () => {
  test("collects secret names from env map", () => {
    const refs = collectSecretRefs([{ TOKEN: "${{ secrets.API_KEY }}", OTHER: "plain" }]);
    expect(refs).toEqual(["API_KEY"]);
  });

  test("collects multiple secrets from one map", () => {
    const refs = collectSecretRefs([
      {
        TOKEN: "${{ secrets.API_KEY }}",
        PASS: "${{ secrets.DB_PASS }}",
      },
    ]);
    expect(refs).toContain("API_KEY");
    expect(refs).toContain("DB_PASS");
    expect(refs).toHaveLength(2);
  });

  test("collects secrets across multiple env maps", () => {
    const refs = collectSecretRefs([
      { TOKEN: "${{ secrets.API_KEY }}" },
      { PASS: "${{ secrets.DB_PASS }}" },
    ]);
    expect(refs).toContain("API_KEY");
    expect(refs).toContain("DB_PASS");
  });

  test("deduplicates repeated secret references", () => {
    const refs = collectSecretRefs([{ A: "${{ secrets.API_KEY }}", B: "${{ secrets.API_KEY }}" }]);
    expect(refs).toEqual(["API_KEY"]);
  });

  test("returns empty array when no secrets referenced", () => {
    const refs = collectSecretRefs([{ TOKEN: "plain-value" }]);
    expect(refs).toEqual([]);
  });

  test("handles undefined maps gracefully", () => {
    const refs = collectSecretRefs([undefined, { TOKEN: "${{ secrets.API_KEY }}" }]);
    expect(refs).toEqual(["API_KEY"]);
  });

  test("handles empty array", () => {
    expect(collectSecretRefs([])).toEqual([]);
  });

  test("ignores non-secret expressions", () => {
    const refs = collectSecretRefs([{ URL: "${{ inputs.url }}", ENV: "${{ env.NODE_ENV }}" }]);
    expect(refs).toEqual([]);
  });
});
