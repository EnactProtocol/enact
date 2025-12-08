import { getFileIcon } from "@/lib/shiki";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  Package,
  Terminal,
} from "lucide-react";
import type { FC } from "react";
import { useState } from "react";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface FileTreeProps {
  files: FileNode[];
  selectedPath?: string;
  onSelectFile: (path: string) => void;
}

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  selectedPath?: string;
  onSelectFile: (path: string) => void;
  defaultExpanded?: boolean;
}

function getIconComponent(iconName: string) {
  const icons: Record<string, FC<{ className?: string }>> = {
    file: File,
    "file-text": FileText,
    "file-code": FileCode,
    terminal: Terminal,
    braces: Braces,
    package: Package,
  };
  return icons[iconName] || File;
}

function FileTreeItem({
  node,
  depth,
  selectedPath,
  onSelectFile,
  defaultExpanded = false,
}: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || depth === 0);
  const isSelected = selectedPath === node.path;
  const isDirectory = node.type === "directory";

  const handleClick = () => {
    if (isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      onSelectFile(node.path);
    }
  };

  const iconName = isDirectory ? "folder" : getFileIcon(node.path);
  const IconComponent = getIconComponent(iconName);

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={`
          w-full flex items-center gap-1.5 px-2 py-1 text-sm text-left
          hover:bg-gray-1 rounded
          ${isSelected ? "bg-blueLight-1 text-brand-blue" : "text-gray-5"}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDirectory ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-4" /> {/* Spacer for alignment */}
            <IconComponent className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children
            .sort((a, b) => {
              // Directories first, then files, alphabetically
              if (a.type !== b.type) {
                return a.type === "directory" ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ files, selectedPath, onSelectFile }: FileTreeProps) {
  if (files.length === 0) {
    return <div className="p-4 text-sm text-gray-4">No files found</div>;
  }

  return (
    <div className="py-2">
      {files
        .sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === "directory" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        })
        .map((node) => (
          <FileTreeItem
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
            defaultExpanded={true}
          />
        ))}
    </div>
  );
}

/**
 * Build a file tree from a flat list of file paths
 */
export function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];

  for (const path of paths) {
    const parts = path.split("/").filter(Boolean);
    let currentLevel = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      let existing = currentLevel.find((n) => n.name === part);

      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: isLast ? "file" : "directory",
          children: isLast ? undefined : [],
        };
        currentLevel.push(existing);
      }

      if (!isLast && existing.children) {
        currentLevel = existing.children;
      }
    }
  }

  return root;
}
