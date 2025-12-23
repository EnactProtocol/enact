import { type FileNode, buildFileTree } from "@/components/code/FileTree";
import AttestButton from "@/components/trust/AttestButton";
import Badge from "@/components/ui/Badge";
import CopyButton from "@/components/ui/CopyButton";
import Spinner from "@/components/ui/Spinner";
import { useApiClientWithAuth } from "@/hooks/useApiClient";
import { getFileContent, getToolFiles, getToolInfo } from "@/lib/api";
import type { FileContentResponse, ToolFilesResponse, ToolInfo } from "@/lib/api-client";
import { formatNumber, getInstallCommand, getRunCommand } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Download, File, Folder, Shield } from "lucide-react";
import Markdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import ToolCode from "./ToolCode";

// Parse tool path from wildcard route - handles any number of segments
// Uses "/-/blob/" as the separator (like GitLab) to avoid collision with tool names
function parseToolPath(path: string | undefined): {
  toolName: string;
  isCodeView: boolean;
  filePath: string;
} {
  if (!path) return { toolName: "", isCodeView: false, filePath: "" };

  // Look for "/-/blob/" separator (safe marker that won't conflict with tool names)
  const blobMarkerIndex = path.indexOf("/-/blob/");

  if (blobMarkerIndex !== -1) {
    const toolName = path.slice(0, blobMarkerIndex);
    const filePath = path.slice(blobMarkerIndex + 8); // length of "/-/blob/"
    return { toolName, isCodeView: true, filePath };
  }

  // Also check for "/-/tree" (directory view without specific file)
  const treeMarkerIndex = path.indexOf("/-/tree");
  if (treeMarkerIndex !== -1) {
    const toolName = path.slice(0, treeMarkerIndex);
    // Everything after "/-/tree" or "/-/tree/" is the directory path
    const afterMarker = path.slice(treeMarkerIndex + 7); // length of "/-/tree"
    const filePath = afterMarker.startsWith("/") ? afterMarker.slice(1) : "";
    return { toolName, isCodeView: true, filePath };
  }

  // It's a tool detail view: the entire path is the tool name
  return { toolName: path, isCodeView: false, filePath: "" };
}

// Extract owner (first segment) and display name (last segment) from tool name
function parseToolName(toolName: string): { owner: string; displayName: string } {
  const parts = toolName.split("/");
  return {
    owner: parts[0] || "",
    displayName: parts[parts.length - 1] || toolName,
  };
}

export default function Tool() {
  const { "*": fullPath } = useParams<{ "*": string }>();
  const { toolName, isCodeView, filePath } = parseToolPath(fullPath);
  const { owner, displayName } = parseToolName(toolName);
  const { client: apiClient, isAuthLoading } = useApiClientWithAuth();

  // All hooks must be called before any conditional returns to satisfy React's rules of hooks
  const {
    data: tool,
    isLoading,
    error,
  } = useQuery<ToolInfo>({
    queryKey: ["tool", toolName, apiClient],
    queryFn: () => getToolInfo(apiClient, toolName),
    enabled: !isCodeView && !isAuthLoading, // Wait for auth to be ready
  });

  // Fetch files list
  const { data: filesData } = useQuery<ToolFilesResponse>({
    queryKey: ["toolFiles", toolName, tool?.latestVersion],
    queryFn: () => getToolFiles(apiClient, toolName, tool!.latestVersion),
    enabled: !isCodeView && !!tool?.latestVersion,
  });

  // Find the manifest file (SKILL.md preferred, with fallback to legacy formats)
  const enactFile = filesData?.files.find(
    (f) =>
      f.path === "SKILL.md" ||
      f.path === "enact.md" ||
      f.path === "enact.yaml" ||
      f.path === "enact.yml"
  );

  // Fetch enact file content
  const { data: enactContent } = useQuery<FileContentResponse>({
    queryKey: ["fileContent", toolName, tool?.latestVersion, enactFile?.path],
    queryFn: () => getFileContent(apiClient, toolName, tool!.latestVersion, enactFile!.path),
    enabled: !isCodeView && !!tool?.latestVersion && !!enactFile,
  });

  // If it's a code view, delegate to ToolCode component
  if (isCodeView && toolName) {
    return <ToolCode toolName={toolName} initialFilePath={filePath} />;
  }

  // Build file tree from paths, then get top-level items (files and directories)
  const fileTree: FileNode[] = filesData ? buildFileTree(filesData.files.map((f) => f.path)) : [];

  // Sort: directories first, then files alphabetically
  const sortedFiles = [...fileTree].sort((a, b) => {
    if (a.type === "directory" && b.type !== "directory") return -1;
    if (a.type !== "directory" && b.type === "directory") return 1;
    return a.name.localeCompare(b.name);
  });

  if (isAuthLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-20">
        <Spinner size={40} />
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="card bg-warning-bg border-brand-red">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-status-bad flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">Tool not found</h2>
              <p className="text-status-bad">
                {error instanceof Error ? error.message : `Could not find tool: ${toolName}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if tool has downloads (as a proxy for verification)
  const isVerified = tool.totalDownloads > 0 && tool.versions.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{displayName}</h1>
            <p className="text-gray-500">{owner}</p>
          </div>
          {isVerified && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-brand-green rounded-lg">
              <Shield className="w-5 h-5" />
              <span className="font-medium">Verified</span>
            </div>
          )}
        </div>

        <p className="text-lg text-gray-600 mb-4">{tool.description}</p>

        <div className="flex items-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            <span>{formatNumber(tool.totalDownloads)} downloads</span>
          </div>
          <div className="text-brand-blue">Version {tool.latestVersion}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content - GitHub-style file browser */}
        <div className="lg:col-span-2 space-y-6">
          {/* File List */}
          <div className="card p-0 overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-900">{owner}</span>
                <span className="text-gray-400">/</span>
                <span className="font-semibold text-gray-900">{displayName}</span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {sortedFiles.length > 0 ? (
                sortedFiles.map((file) => (
                  <Link
                    key={file.path}
                    to={
                      file.type === "directory"
                        ? `/tools/${toolName}/-/tree/${file.path}`
                        : `/tools/${toolName}/-/blob/${file.path}`
                    }
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                  >
                    {file.type === "directory" ? (
                      <Folder className="w-4 h-4 text-brand-blue" />
                    ) : (
                      <File className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-gray-900 hover:text-brand-blue hover:underline flex-1">
                      {file.name}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-3 text-gray-500 text-sm">Loading files...</div>
              )}
            </div>
          </div>

          {/* enact file content (like GitHub README) */}
          {enactFile && (
            <div className="card p-0 overflow-hidden">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center gap-2">
                <File className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-gray-900">{enactFile.path}</span>
              </div>
              <div className="p-4">
                {enactContent ? (
                  enactFile.path.endsWith(".md") ? (
                    <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-brand-blue prose-code:bg-gray-100 prose-code:text-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-100 prose-pre:text-gray-800">
                      <Markdown remarkPlugins={[remarkGfm]}>{enactContent.content}</Markdown>
                    </div>
                  ) : (
                    <pre className="text-sm text-gray-700 font-mono whitespace-pre-wrap overflow-x-auto">
                      {enactContent.content}
                    </pre>
                  )
                ) : (
                  <div className="text-gray-500 text-sm">Loading content...</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Metadata */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Author</dt>
                <dd className="font-medium text-gray-900">{tool.author.username}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Version</dt>
                <dd className="font-medium text-brand-blue">{tool.latestVersion}</dd>
              </div>
              {tool.license && (
                <div>
                  <dt className="text-gray-500">License</dt>
                  <dd className="font-medium text-gray-900">{tool.license}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Installation */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-2">Installation</h3>
            <div className="bg-gray-600 text-gray-100 p-2 rounded-lg flex items-center justify-between text-xs">
              <code className="flex-1 truncate">{getInstallCommand(toolName)}</code>
              <CopyButton text={getInstallCommand(toolName)} className="ml-2" />
            </div>
          </div>

          {/* Usage */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-2">Usage</h3>
            <div className="bg-gray-600 text-gray-100 p-2 rounded-lg flex items-center justify-between text-xs">
              <code className="flex-1 truncate">{getRunCommand(toolName)}</code>
              <CopyButton text={getRunCommand(toolName)} className="ml-2" />
            </div>
          </div>

          {/* Attest */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-2">Trust</h3>
            <p className="text-xs text-gray-500 mb-3">Attest this tool to vouch for its safety</p>
            <AttestButton toolName={toolName} version={tool.latestVersion} />
          </div>

          {/* Tags */}
          {tool.tags && tool.tags.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {tool.tags.map((tag) => (
                  <Badge key={tag} variant="teal">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
