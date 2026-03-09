/**
 * @enactprotocol/sdk
 *
 * Programmatic SDK for running and composing Enact skills in code.
 *
 * @example
 * ```typescript
 * import { Enact } from '@enactprotocol/sdk'
 *
 * const enact = new Enact()
 *
 * // Run a skill
 * const result = await enact.run('enact/firecrawl:scrape', {
 *   url: 'https://example.com'
 * })
 *
 * // Build a pipeline
 * const output = await enact
 *   .pipeline()
 *   .run('enact/firecrawl:scrape', { url: input.url })
 *   .run('enact/summarizer:summarize', { text: '$previous.output' })
 *   .execute()
 * ```
 */

export { Enact, type EnactOptions } from "./enact.js";
export { Pipeline } from "./pipeline.js";
export type {
  RunOptions,
  RunResult,
  PipelineStep,
  PipelineContext,
} from "./types.js";
