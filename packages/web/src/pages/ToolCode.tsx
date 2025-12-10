import CodeViewer from "@/components/code/CodeViewer";
import FileTree, { buildFileTree, type FileNode } from "@/components/code/FileTree";
import Spinner from "@/components/ui/Spinner";
import { apiClient, getFileContent, getToolFiles, getToolInfo } from "@/lib/api";
import type { FileContentResponse, ToolFilesResponse, ToolInfo } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Check, ChevronRight, Copy, FileCode } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

export default function ToolCode() {
  const {
    owner,
    category,
    name,
    "*": filePath,
  } = useParams<{ owner: string; category?: string; name: string; "*": string }>();
  const navigate = useNavigate();
  // Support both 2-segment (owner/name) and 3-segment (owner/category/name) tool names
  const toolName = category ? `${owner}/${category}/${name}` : `${owner}/${name}`;

  const [copied, setCopied] = useState(false);
  const currentFile = filePath || "";

  // Fetch tool info
  const {
    data: tool,
    isLoading: toolLoading,
    error: toolError,
  } = useQuery<ToolInfo>({
    queryKey: ["tool", toolName],
    queryFn: () => getToolInfo(apiClient, toolName),
  });

  // Fetch files list
  const {
    data: filesData,
    isLoading: filesLoading,
    error: filesError,
  } = useQuery<ToolFilesResponse>({
    queryKey: ["tool-files", toolName, tool?.latestVersion],
    queryFn: () => getToolFiles(apiClient, toolName, tool!.latestVersion),
    enabled: !!tool?.latestVersion,
  });

  // Fetch file content when a file is selected
  const {
    data: fileContent,
    isLoading: contentLoading,
    error: contentError,
  } = useQuery<FileContentResponse>({
    queryKey: ["file-content", toolName, tool?.latestVersion, currentFile],
    queryFn: () => getFileContent(apiClient, toolName, tool!.latestVersion, currentFile),
    enabled: !!tool?.latestVersion && !!currentFile,
  });

  // Build file tree
  const fileTree: FileNode[] = filesData ? buildFileTree(filesData.files.map((f) => f.path)) : [];

  // Auto-select first file if none selected
  useEffect(() => {
    if (!currentFile && filesData?.files.length) {
      const firstFile = filesData.files.find((f) => f.type === "file");
      if (firstFile) {
        navigate(`/tools/${toolName}/code/${firstFile.path}`, { replace: true });
      }
    }
  }, [currentFile, filesData, navigate, toolName]);

  const handleSelectFile = (path: string) => {
    navigate(`/tools/${toolName}/code/${path}`);
  };

  const handleCopyPath = async () => {
    await navigator.clipboard.writeText(currentFile);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (toolLoading || filesLoading) {
    return (
      <div className="container mx-auto px-4 py-20">
        <Spinner size={40} />
      </div>
    );
  }

  // Error state
  if (toolError || filesError) {
    const error = toolError || filesError;
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="card bg-brand-pink/10 border-brand-pink/50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-brand-red flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-gray-6 mb-1">Error loading code</h2>
              <p className="text-gray-5">
                {error instanceof Error ? error.message : "Failed to load tool files"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="card text-center py-12">
          <p className="text-gray-5">Tool not found</p>
        </div>
      </div>
    );
  }

  // Parse path for breadcrumbs
  const pathParts = currentFile.split("/").filter(Boolean);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-2 bg-white">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to={`/tools/${toolName}`}
                className="flex items-center gap-1 text-sm text-gray-5 hover:text-gray-6"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to {name}
              </Link>
              <span className="text-gray-3">|</span>
              <div className="flex items-center gap-1 text-sm">
                <FileCode className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{toolName}</span>
                <span className="text-gray-400">@{tool.latestVersion}</span>
              </div>
            </div>
          </div>

          {/* Breadcrumb */}
          {currentFile && (
            <div className="flex items-center gap-1 mt-2 text-sm">
              <button
                type="button"
                onClick={() => navigate(`/tools/${toolName}/code`)}
                className="text-brand-blue hover:underline"
              >
                {name}
              </button>
              {pathParts.map((part, i) => (
                <span key={part} className="flex items-center gap-1">
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  {i === pathParts.length - 1 ? (
                    <span className="text-gray-6 font-medium">{part}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const subPath = pathParts.slice(0, i + 1).join("/");
                        navigate(`/tools/${toolName}/code/${subPath}`);
                      }}
                      className="text-brand-blue hover:underline"
                    >
                      {part}
                    </button>
                  )}
                </span>
              ))}
              <button
                type="button"
                onClick={handleCopyPath}
                className="ml-2 p-1 text-gray-4 hover:text-gray-5"
                title="Copy path"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-brand-green" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File tree sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-gray-2 bg-gray-1 overflow-y-auto">
          <FileTree files={fileTree} selectedPath={currentFile} onSelectFile={handleSelectFile} />
        </div>

        {/* Code viewer */}
        <div className="flex-1 overflow-auto bg-[#0d1117]">
          {contentLoading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner size={32} />
            </div>
          ) : contentError ? (
            <div className="p-8">
              <div className="card bg-brand-pink/10 border-brand-pink/50">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-brand-red flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-6">Failed to load file</h3>
                    <p className="text-sm text-gray-5">
                      {contentError instanceof Error ? contentError.message : "Unknown error"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : fileContent ? (
            <CodeViewer
              code={
                fileContent.encoding === "base64" ? atob(fileContent.content) : fileContent.content
              }
              filePath={currentFile}
            />
          ) : !currentFile ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <FileCode className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select a file to view its contents</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
