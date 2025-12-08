/**
 * Spinner utility using @clack/prompts
 *
 * Provides loading spinners for long-running operations
 */

import * as p from "@clack/prompts";

export interface SpinnerInstance {
  start: (message?: string) => void;
  stop: (message?: string, code?: number) => void;
  message: (message: string) => void;
}

/**
 * Create a spinner for long-running operations
 */
export function createSpinner(): SpinnerInstance {
  const spinner = p.spinner();

  return {
    start(message = "Loading...") {
      spinner.start(message);
    },
    stop(message?: string, code = 0) {
      spinner.stop(message, code);
    },
    message(message: string) {
      spinner.message(message);
    },
  };
}

/**
 * Run an async operation with a spinner
 */
export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>,
  successMessage?: string
): Promise<T> {
  const spinner = createSpinner();
  spinner.start(message);

  try {
    const result = await fn();
    spinner.stop(successMessage ?? message);
    return result;
  } catch (error) {
    spinner.stop(`Failed: ${message}`, 1);
    throw error;
  }
}

/**
 * Show a simple intro banner
 */
export function intro(message: string): void {
  p.intro(message);
}

/**
 * Show an outro message
 */
export function outro(message: string): void {
  p.outro(message);
}

/**
 * Prompt for confirmation
 */
export async function confirm(message: string, initialValue = false): Promise<boolean> {
  const result = await p.confirm({
    message,
    initialValue,
  });

  if (p.isCancel(result)) {
    return false;
  }

  return result;
}

/**
 * Prompt for text input
 */
export async function text(
  message: string,
  options?: {
    placeholder?: string;
    defaultValue?: string;
    validate?: (value: string) => string | undefined;
  }
): Promise<string | null> {
  const textOptions: {
    message: string;
    placeholder?: string;
    defaultValue?: string;
    validate?: (value: string) => string | undefined;
  } = {
    message,
  };

  if (options?.placeholder) {
    textOptions.placeholder = options.placeholder;
  }
  if (options?.defaultValue) {
    textOptions.defaultValue = options.defaultValue;
  }
  if (options?.validate) {
    textOptions.validate = options.validate;
  }

  const result = await p.text(textOptions);

  if (p.isCancel(result)) {
    return null;
  }

  return result;
}

/**
 * Prompt for password input (masked)
 */
export async function password(message: string): Promise<string | null> {
  const result = await p.password({
    message,
  });

  if (p.isCancel(result)) {
    return null;
  }

  return result;
}

/**
 * Prompt for selection from options
 */
export async function select<T extends string>(
  message: string,
  options: Array<{ value: T; label: string; hint?: string }>
): Promise<T | null> {
  const result = await p.select({
    message,
    // biome-ignore lint/suspicious/noExplicitAny: clack types are strict about optional props
    options: options as any,
  });

  if (p.isCancel(result)) {
    return null;
  }

  return result as T;
}

/**
 * Check if user cancelled
 */
export function isCancel(value: unknown): boolean {
  return p.isCancel(value);
}

/**
 * Cancel and exit
 */
export function cancel(message = "Operation cancelled"): never {
  p.cancel(message);
  process.exit(0);
}

/**
 * Log a message (respects CI mode)
 */
export function log(message: string): void {
  p.log.message(message);
}

/**
 * Log an info message
 */
export function logInfo(message: string): void {
  p.log.info(message);
}

/**
 * Log a success message
 */
export function logSuccess(message: string): void {
  p.log.success(message);
}

/**
 * Log a warning
 */
export function logWarning(message: string): void {
  p.log.warn(message);
}

/**
 * Log an error
 */
export function logError(message: string): void {
  p.log.error(message);
}

/**
 * Log a step
 */
export function logStep(message: string): void {
  p.log.step(message);
}
