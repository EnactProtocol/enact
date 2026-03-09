import type { Enact } from "./enact.js";
import type { PipelineContext, PipelineStep, RunOptions, RunResult } from "./types.js";

/**
 * Pipeline for chaining multiple skill executions
 *
 * Supports passing data between steps using $previous and $steps references.
 */
export class Pipeline {
  private steps: PipelineStep[] = [];
  private enact: Enact;

  constructor(enact: Enact) {
    this.enact = enact;
  }

  /**
   * Add a step to the pipeline
   *
   * @param skill - Skill to run (e.g., "enact/firecrawl:scrape")
   * @param params - Input parameters (can use $previous.stdout, $steps.name.stdout, etc.)
   * @param name - Optional name for this step (for referencing in later steps)
   * @returns This pipeline for chaining
   *
   * @example
   * ```typescript
   * pipeline
   *   .run('enact/firecrawl:scrape', { url: 'https://example.com' }, 'scrape')
   *   .run('enact/summarizer:summarize', { text: '$steps.scrape.stdout' })
   * ```
   */
  run(skill: string, params: Record<string, unknown> = {}, name?: string): this {
    this.steps.push({ skill, params, name });
    return this;
  }

  /**
   * Execute the pipeline
   *
   * @param input - Initial input data available to all steps as $input
   * @param options - Global run options applied to all steps
   * @returns Final step result
   *
   * @example
   * ```typescript
   * const result = await pipeline.execute({ url: 'https://example.com' })
   * console.log(result.stdout)
   * ```
   */
  async execute(input: Record<string, unknown> = {}, options: RunOptions = {}): Promise<RunResult> {
    const context: PipelineContext = {
      steps: {},
      input,
    };

    let lastResult: RunResult | undefined;

    for (const step of this.steps) {
      // Resolve parameter references
      const resolvedParams = this.resolveParams(step.params, context);

      // Execute step
      const result = await this.enact.run(step.skill, {
        ...options,
        params: resolvedParams,
      });

      // Update context
      lastResult = result;
      context.previous = result;

      if (step.name) {
        context.steps[step.name] = result;
      }

      // Stop on error
      if (!result.success) {
        break;
      }
    }

    if (!lastResult) {
      const now = new Date();
      return {
        success: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        error: {
          code: "UNKNOWN",
          message: "Pipeline has no steps",
        },
        raw: {
          success: false,
          output: { stdout: "", stderr: "", exitCode: 1 },
          error: {
            code: "UNKNOWN",
            message: "Pipeline has no steps",
          },
          metadata: {
            toolName: "pipeline",
            executionId: "",
            containerImage: "",
            startTime: now,
            endTime: now,
            durationMs: 0,
            cached: false,
          },
        },
      };
    }

    return lastResult;
  }

  /**
   * Resolve parameter references in step params
   *
   * Supports:
   * - $previous.stdout - Previous step's stdout
   * - $previous.exitCode - Previous step's exit code
   * - $steps.name.stdout - Named step's stdout
   * - $input.key - Initial pipeline input
   */
  private resolveParams(
    params: Record<string, unknown>,
    context: PipelineContext
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value.startsWith("$")) {
        resolved[key] = this.resolveReference(value, context);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Resolve a single reference like $previous.stdout
   */
  private resolveReference(ref: string, context: PipelineContext): unknown {
    const parts = ref.slice(1).split(".");

    if (parts[0] === "previous") {
      let value: unknown = context.previous;
      for (let i = 1; i < parts.length; i++) {
        value = (value as Record<string, unknown>)?.[parts[i] as string];
      }
      return value;
    }

    if (parts[0] === "steps" && parts[1]) {
      let value: unknown = context.steps[parts[1]];
      for (let i = 2; i < parts.length; i++) {
        value = (value as Record<string, unknown>)?.[parts[i] as string];
      }
      return value;
    }

    if (parts[0] === "input") {
      let value: unknown = context.input;
      for (let i = 1; i < parts.length; i++) {
        value = (value as Record<string, unknown>)?.[parts[i] as string];
      }
      return value;
    }

    // If not a valid reference, return as-is
    return ref;
  }
}
