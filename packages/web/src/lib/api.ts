import {
  EnactApiClient,
  getFileContent as apiGetFileContent,
  getToolFiles as apiGetToolFiles,
  getToolInfo as apiGetToolInfo,
  getToolVersion as apiGetToolVersion,
  getUserProfile as apiGetUserProfile,
  getUserTools as apiGetUserTools,
  searchTools as apiSearchTools,
} from "./api-client";
import { API_URL, SUPABASE_ANON_KEY } from "./supabase";

export const apiClient = new EnactApiClient({
  baseUrl: API_URL,
  authToken: SUPABASE_ANON_KEY,
});

// Re-export API functions
export const searchTools = apiSearchTools;
export const getToolInfo = apiGetToolInfo;
export const getToolVersion = apiGetToolVersion;
export const getToolFiles = apiGetToolFiles;
export const getFileContent = apiGetFileContent;
export const getUserProfile = apiGetUserProfile;
export const getUserTools = apiGetUserTools;

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
  UserProfile,
  UserTool,
  UserToolsResponse,
} from "./api-client";
