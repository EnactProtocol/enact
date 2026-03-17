import { describe, expect, test } from "bun:test";
import { parseWorkflow, validateWorkflowLogic } from "../src/schema";
import { WorkflowValidationError } from "../src/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MINIMAL_YAML = `
name: My Workflow
on:
  manual: {}
jobs:
  pipeline:
    steps:
      - id: fetch
        uses: enact/web-scrape@1.0
        with:
          url: https://example.com
`;

const FULL_YAML = `
name: Research Pipeline
on:
  manual:
    inputs:
      url:
        description: URL to scrape
        required: true
      max_words:
        description: Max words
        required: false
        default: "200"

env:
  NODE_ENV: production

jobs:
  pipeline:
    steps:
      - id: fetch
        name: Fetch content
        uses: enact/web-scrape@1.0
        with:
          url: \${{ inputs.url }}
        timeout: 30s

      - id: summarize
        name: Summarize
        uses: enact/summarize@1.0
        needs: [fetch]
        with:
          content: \${{ steps.fetch.outputs.text }}
          max_words: \${{ inputs.max_words }}
        if: \${{ steps.fetch.outputs.status == 'ok' }}
        continueOnError: false

      - id: notify
        name: Notify
        uses: enact/slack-send@1.0
        needs: [summarize]
        with:
          message: \${{ steps.summarize.outputs.summary }}
        env:
          SLACK_TOKEN: \${{ secrets.SLACK_TOKEN }}
        continueOnError: true
`;

// ─── parseWorkflow ────────────────────────────────────────────────────────────

describe("parseWorkflow", () => {
  describe("valid YAML", () => {
    test("parses a minimal valid workflow", () => {
      const wf = parseWorkflow(MINIMAL_YAML);
      expect(wf.name).toBe("My Workflow");
      expect(wf.jobs).toBeDefined();
      expect(Object.keys(wf.jobs)).toContain("pipeline");
    });

    test("parses workflow name", () => {
      const wf = parseWorkflow(FULL_YAML);
      expect(wf.name).toBe("Research Pipeline");
    });

    test("parses on.manual.inputs", () => {
      const wf = parseWorkflow(FULL_YAML);
      const inputs = wf.on.manual?.inputs;
      expect(inputs).toBeDefined();
      expect(inputs?.url?.required).toBe(true);
      expect(inputs?.url?.description).toBe("URL to scrape");
      expect(inputs?.max_words?.default).toBe("200");
    });

    test("parses workflow-level env", () => {
      const wf = parseWorkflow(FULL_YAML);
      expect(wf.env?.NODE_ENV).toBe("production");
    });

    test("parses all steps in a job", () => {
      const wf = parseWorkflow(FULL_YAML);
      const steps = wf.jobs.pipeline?.steps;
      expect(steps).toHaveLength(3);
    });

    test("parses step id and uses", () => {
      const wf = parseWorkflow(FULL_YAML);
      const fetchStep = wf.jobs.pipeline?.steps[0];
      expect(fetchStep?.id).toBe("fetch");
      expect(fetchStep?.uses).toBe("enact/web-scrape@1.0");
    });

    test("parses step name", () => {
      const wf = parseWorkflow(FULL_YAML);
      expect(wf.jobs.pipeline?.steps[0]?.name).toBe("Fetch content");
    });

    test("parses step with", () => {
      const wf = parseWorkflow(FULL_YAML);
      const fetchStep = wf.jobs.pipeline?.steps[0];
      expect(fetchStep?.with?.url).toBe("${{ inputs.url }}");
    });

    test("parses step needs", () => {
      const wf = parseWorkflow(FULL_YAML);
      const summarizeStep = wf.jobs.pipeline?.steps[1];
      expect(summarizeStep?.needs).toEqual(["fetch"]);
    });

    test("parses step if condition", () => {
      const wf = parseWorkflow(FULL_YAML);
      const summarizeStep = wf.jobs.pipeline?.steps[1];
      expect(summarizeStep?.if).toBe("${{ steps.fetch.outputs.status == 'ok' }}");
    });

    test("parses step continueOnError", () => {
      const wf = parseWorkflow(FULL_YAML);
      const steps = wf.jobs.pipeline?.steps;
      expect(steps?.[1]?.continueOnError).toBe(false);
      expect(steps?.[2]?.continueOnError).toBe(true);
    });

    test("parses step env", () => {
      const wf = parseWorkflow(FULL_YAML);
      const notifyStep = wf.jobs.pipeline?.steps[2];
      expect(notifyStep?.env?.SLACK_TOKEN).toBe("${{ secrets.SLACK_TOKEN }}");
    });

    test("parses step timeout", () => {
      const wf = parseWorkflow(FULL_YAML);
      expect(wf.jobs.pipeline?.steps[0]?.timeout).toBe("30s");
    });

    test("parses multiple jobs", () => {
      const yaml = `
name: Multi-job
on:
  manual: {}
jobs:
  job1:
    steps:
      - id: a
        uses: enact/tool-a@1.0
  job2:
    steps:
      - id: b
        uses: enact/tool-b@1.0
`;
      const wf = parseWorkflow(yaml);
      expect(Object.keys(wf.jobs)).toHaveLength(2);
      expect(wf.jobs.job1).toBeDefined();
      expect(wf.jobs.job2).toBeDefined();
    });
  });

  describe("invalid YAML — throws WorkflowValidationError", () => {
    test("throws on non-YAML content", () => {
      expect(() => parseWorkflow("not: valid: yaml: :::")).toThrow(WorkflowValidationError);
    });

    test("throws on empty string", () => {
      expect(() => parseWorkflow("")).toThrow(WorkflowValidationError);
    });

    test("throws when name is missing", () => {
      const yaml = `
on:
  manual: {}
jobs:
  pipeline:
    steps:
      - id: a
        uses: enact/tool@1.0
`;
      expect(() => parseWorkflow(yaml)).toThrow(WorkflowValidationError);
    });

    test("throws when jobs is missing", () => {
      const yaml = `
name: My Workflow
on:
  manual: {}
`;
      expect(() => parseWorkflow(yaml)).toThrow(WorkflowValidationError);
    });

    test("throws when jobs is empty", () => {
      const yaml = `
name: My Workflow
on:
  manual: {}
jobs: {}
`;
      expect(() => parseWorkflow(yaml)).toThrow(WorkflowValidationError);
    });

    test("throws when a step is missing id", () => {
      const yaml = `
name: My Workflow
on:
  manual: {}
jobs:
  pipeline:
    steps:
      - uses: enact/tool@1.0
`;
      expect(() => parseWorkflow(yaml)).toThrow(WorkflowValidationError);
    });

    test("throws when a step is missing uses", () => {
      const yaml = `
name: My Workflow
on:
  manual: {}
jobs:
  pipeline:
    steps:
      - id: fetch
`;
      expect(() => parseWorkflow(yaml)).toThrow(WorkflowValidationError);
    });

    test("throws when steps array is empty", () => {
      const yaml = `
name: My Workflow
on:
  manual: {}
jobs:
  pipeline:
    steps: []
`;
      expect(() => parseWorkflow(yaml)).toThrow(WorkflowValidationError);
    });

    test("error message describes the problem", () => {
      try {
        parseWorkflow(`
name: My Workflow
on:
  manual: {}
jobs: {}
`);
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(WorkflowValidationError);
        expect((err as Error).message).toContain("Invalid workflow");
      }
    });
  });
});

// ─── validateWorkflowLogic ────────────────────────────────────────────────────

describe("validateWorkflowLogic", () => {
  test("accepts a valid workflow without throwing", () => {
    const wf = parseWorkflow(FULL_YAML);
    expect(() => validateWorkflowLogic(wf)).not.toThrow();
  });

  test("accepts workflow with no needs references", () => {
    const wf = parseWorkflow(MINIMAL_YAML);
    expect(() => validateWorkflowLogic(wf)).not.toThrow();
  });

  test("throws on duplicate step ids within a job", () => {
    const yaml = `
name: My Workflow
on:
  manual: {}
jobs:
  pipeline:
    steps:
      - id: fetch
        uses: enact/tool@1.0
      - id: fetch
        uses: enact/tool@1.0
`;
    const wf = parseWorkflow(yaml);
    expect(() => validateWorkflowLogic(wf)).toThrow(WorkflowValidationError);
  });

  test("throws when needs references unknown step id", () => {
    const yaml = `
name: My Workflow
on:
  manual: {}
jobs:
  pipeline:
    steps:
      - id: process
        uses: enact/tool@1.0
        needs: [nonexistent]
`;
    const wf = parseWorkflow(yaml);
    expect(() => validateWorkflowLogic(wf)).toThrow(WorkflowValidationError);
  });

  test("duplicate step ids allowed in different jobs", () => {
    const yaml = `
name: My Workflow
on:
  manual: {}
jobs:
  job1:
    steps:
      - id: fetch
        uses: enact/tool@1.0
  job2:
    steps:
      - id: fetch
        uses: enact/tool@1.0
`;
    const wf = parseWorkflow(yaml);
    expect(() => validateWorkflowLogic(wf)).not.toThrow();
  });

  test("error message includes step id for duplicate", () => {
    const yaml = `
name: My Workflow
on:
  manual: {}
jobs:
  pipeline:
    steps:
      - id: step-a
        uses: enact/tool@1.0
      - id: step-a
        uses: enact/other@1.0
`;
    const wf = parseWorkflow(yaml);
    try {
      validateWorkflowLogic(wf);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(WorkflowValidationError);
      expect((err as Error).message).toContain("step-a");
    }
  });
});
