/**
 * CLI utilities
 */

// Output formatting
export {
  colors,
  symbols,
  success,
  error,
  warning,
  info,
  dim,
  newline,
  header,
  keyValue,
  listItem,
  table,
  json,
  jsonCompact,
  formatError,
  errorWithDetails,
  suggest,
  status,
  clearLine,
  type TableColumn,
} from "./output";

// Spinner and prompts
export {
  createSpinner,
  withSpinner,
  intro,
  outro,
  confirm,
  text,
  password,
  select,
  isCancel,
  cancel,
  log,
  logInfo,
  logSuccess,
  logWarning,
  logError,
  logStep,
  type SpinnerInstance,
} from "./spinner";

// Exit codes
export {
  EXIT_SUCCESS,
  EXIT_FAILURE,
  EXIT_USAGE,
  EXIT_DATAERR,
  EXIT_NOINPUT,
  EXIT_NOUSER,
  EXIT_NOHOST,
  EXIT_UNAVAILABLE,
  EXIT_SOFTWARE,
  EXIT_OSERR,
  EXIT_OSFILE,
  EXIT_CANTCREAT,
  EXIT_IOERR,
  EXIT_TEMPFAIL,
  EXIT_PROTOCOL,
  EXIT_NOPERM,
  EXIT_CONFIG,
  EXIT_TOOL_NOT_FOUND,
  EXIT_MANIFEST_ERROR,
  EXIT_EXECUTION_ERROR,
  EXIT_TIMEOUT,
  EXIT_TRUST_ERROR,
  EXIT_REGISTRY_ERROR,
  EXIT_AUTH_ERROR,
  EXIT_VALIDATION_ERROR,
  EXIT_NETWORK_ERROR,
  EXIT_CONTAINER_ERROR,
  getExitCodeDescription,
  exit,
  exitSuccess,
  exitFailure,
} from "./exit-codes";

// Error handling
export {
  CliError,
  ToolNotFoundError,
  ManifestError,
  ValidationError,
  AuthError,
  NetworkError,
  RegistryError,
  TrustError,
  TimeoutError,
  ExecutionError,
  ContainerError,
  FileNotFoundError,
  PermissionError,
  ConfigError,
  UsageError,
  handleError,
  withErrorHandling,
  categorizeError,
  ErrorMessages,
  printErrorWithSuggestions,
} from "./errors";

// Auth utilities
export { getCurrentUsername, extractNamespace } from "./auth";
