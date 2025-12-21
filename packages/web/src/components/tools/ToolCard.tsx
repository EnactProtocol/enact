import Badge from "@/components/ui/Badge";
import { formatNumber } from "@/lib/utils";
import { Download, Shield, Tag } from "lucide-react";
import { Link } from "react-router-dom";

interface ToolCardProps {
  tool: {
    name: string;
    description: string;
    version: string;
    downloads?: number;
    verified?: boolean;
    tags?: string[];
  };
}

export default function ToolCard({ tool }: ToolCardProps) {
  // Parse tool name into owner and name
  const parts = tool.name.split("/");
  const owner = parts.length > 1 ? parts[0] : "";
  const name = parts[parts.length - 1];

  return (
    <Link to={`/tools/${tool.name}`} className="card-hover">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{name}</h3>
          {owner && (
            <Link
              to={`/u/${owner}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-gray-400 hover:text-brand-blue truncate inline-block"
            >
              {owner}
            </Link>
          )}
        </div>
        {tool.verified && (
          <Shield className="w-5 h-5 text-status-good flex-shrink-0 ml-2" aria-label="Verified" />
        )}
      </div>

      <p className="text-gray-500 text-sm mb-4 line-clamp-2">{tool.description}</p>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <Download className="w-4 h-4" />
          <span>{tool.downloads ? formatNumber(tool.downloads) : "0"}</span>
        </div>
        <span className="text-brand-blue">v{tool.version}</span>
      </div>

      {tool.tags && tool.tags.length > 0 && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Tag className="w-3 h-3 text-gray-400" />
          {tool.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="default">
              {tag}
            </Badge>
          ))}
          {tool.tags.length > 3 && (
            <span className="text-xs text-gray-400">+{tool.tags.length - 3} more</span>
          )}
        </div>
      )}
    </Link>
  );
}
