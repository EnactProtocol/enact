/**
 * Type definitions for Enact server
 */

// Use npm package for type-checking, Edge Functions will use esm.sh at runtime
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Database types (generated from schema)
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      tools: {
        Row: Tool;
        Insert: ToolInsert;
        Update: ToolUpdate;
      };
      tool_versions: {
        Row: ToolVersion;
        Insert: ToolVersionInsert;
        Update: ToolVersionUpdate;
      };
      attestations: {
        Row: Attestation;
        Insert: AttestationInsert;
        Update: AttestationUpdate;
      };
      trusted_auditors: {
        Row: TrustedAuditor;
        Insert: TrustedAuditorInsert;
        Update: TrustedAuditorUpdate;
      };
      reports: {
        Row: Report;
        Insert: ReportInsert;
        Update: ReportUpdate;
      };
      download_logs: {
        Row: DownloadLog;
        Insert: DownloadLogInsert;
        Update: DownloadLogUpdate;
      };
    };
  };
}

/**
 * Supabase client with database types
 */
export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Profile (user)
 */
export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export type ProfileInsert = Omit<Profile, "created_at">;
export type ProfileUpdate = Partial<Omit<Profile, "id" | "created_at">>;

/**
 * Tool
 */
export interface Tool {
  id: string;
  owner_id: string;
  name: string;
  short_name: string;
  description: string | null;
  license: string | null;
  tags: string[] | null;
  repository_url: string | null;
  homepage_url: string | null;
  total_downloads: number;
  created_at: string;
  updated_at: string;
}

export type ToolInsert = Omit<Tool, "id" | "created_at" | "updated_at" | "total_downloads">;
export type ToolUpdate = Partial<Omit<Tool, "id" | "owner_id" | "created_at" | "updated_at">>;

/**
 * Tool Version
 */
export interface ToolVersion {
  id: string;
  tool_id: string;
  version: string;
  manifest: Record<string, unknown>;
  readme: string | null; // Reserved for future README.md support
  raw_manifest: string | null; // The raw enact.md file content
  bundle_hash: string;
  bundle_size: number;
  bundle_path: string;
  downloads: number;
  yanked: boolean;
  yank_reason: string | null;
  yank_replacement: string | null;
  yanked_at: string | null;
  published_by: string;
  published_at: string;
}

export type ToolVersionInsert = Omit<
  ToolVersion,
  "id" | "downloads" | "yanked" | "yanked_at" | "published_at"
>;
export type ToolVersionUpdate = Partial<
  Pick<ToolVersion, "yanked" | "yank_reason" | "yank_replacement" | "yanked_at">
>;

/**
 * Attestation
 */
export interface Attestation {
  id: string;
  tool_version_id: string;
  auditor: string;
  auditor_provider: string | null;
  bundle: Record<string, unknown>;
  checksum_manifest: Record<string, unknown> | null;
  rekor_log_id: string;
  rekor_log_index: number | null;
  signed_at: string;
  verified: boolean;
  rekor_verified: boolean;
  certificate_verified: boolean;
  signature_verified: boolean;
  verified_at: string | null;
  revoked: boolean;
  revoked_at: string | null;
  created_at: string;
}

export type AttestationInsert = Omit<Attestation, "id" | "created_at" | "revoked" | "revoked_at">;
export type AttestationUpdate = Partial<Pick<Attestation, "revoked" | "revoked_at">>;

/**
 * Trusted Auditor
 */
export interface TrustedAuditor {
  user_id: string;
  auditor_identity: string;
  created_at: string;
}

export type TrustedAuditorInsert = Omit<TrustedAuditor, "created_at">;
export type TrustedAuditorUpdate = never;

/**
 * Report
 */
export interface Report {
  id: string;
  tool_version_id: string;
  reporter_id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "security" | "malware" | "license" | "quality" | "other";
  description: string;
  evidence: string | null;
  status: "submitted" | "reviewing" | "confirmed" | "dismissed" | "resolved";
  created_at: string;
  reviewed_at: string | null;
  resolved_at: string | null;
}

export type ReportInsert = Omit<Report, "id" | "created_at" | "reviewed_at" | "resolved_at">;
export type ReportUpdate = Partial<Pick<Report, "status" | "reviewed_at" | "resolved_at">>;

/**
 * Download Log
 */
export interface DownloadLog {
  id: string;
  tool_version_id: string;
  downloaded_at: string;
  ip_hash: string | null;
  user_agent: string | null;
}

export type DownloadLogInsert = Omit<DownloadLog, "id" | "downloaded_at">;
export type DownloadLogUpdate = never;

/**
 * API Error Response
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * API Response Wrapper
 */
export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

/**
 * Pagination params
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}
