import {
  EnactApiClient,
  getFileContent as apiGetFileContent,
  getToolFiles as apiGetToolFiles,
  getToolInfo as apiGetToolInfo,
  getToolVersion as apiGetToolVersion,
  searchTools as apiSearchTools,
} from "./api-client";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:54321/functions/v1";

// Default Supabase anon key for local development
const ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const apiClient = new EnactApiClient({
  baseUrl: API_URL,
  authToken: ANON_KEY,
});

// Re-export API functions
export const searchTools = apiSearchTools;
export const getToolInfo = apiGetToolInfo;
export const getToolVersion = apiGetToolVersion;
export const getToolFiles = apiGetToolFiles;
export const getFileContent = apiGetFileContent;

// Re-export types
export type {
  SearchOptions,
  SearchResponse,
  SearchResult,
  ToolInfo,
  ToolVersionInfo,
  ToolFile,
  ToolFilesResponse,
  FileContentResponse,
  ApiClientOptions,
} from "./api-client";
