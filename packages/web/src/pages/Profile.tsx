import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useApiClient } from "@/hooks/useApiClient";
import { getUserProfile, getUserTools } from "@/lib/api";
import type { UserProfile, UserTool, UserToolsResponse } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Download,
  Eye,
  EyeOff,
  Globe,
  Link as LinkIcon,
  Lock,
  Package,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

type VisibilityFilter = "all" | "public" | "private" | "unlisted";

function ToolCard({ tool, showVisibility }: { tool: UserTool; showVisibility: boolean }) {
  // Parse tool name into owner and name
  const parts = tool.name.split("/");
  const name = parts[parts.length - 1];

  const visibilityIcon = {
    public: <Globe className="w-4 h-4 text-green-500" />,
    private: <Lock className="w-4 h-4 text-yellow-500" />,
    unlisted: <LinkIcon className="w-4 h-4 text-blue-500" />,
  };

  const visibilityLabel = {
    public: "Public",
    private: "Private",
    unlisted: "Unlisted",
  };

  return (
    <Link to={`/tools/${tool.name}`} className="card-hover">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{name}</h3>
        </div>
        {showVisibility && (
          <div className="flex items-center gap-1 text-sm text-gray-500 ml-2">
            {visibilityIcon[tool.visibility]}
            <span className="hidden sm:inline">{visibilityLabel[tool.visibility]}</span>
          </div>
        )}
      </div>

      <p className="text-gray-500 text-sm mb-4 line-clamp-2">{tool.description}</p>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <Download className="w-4 h-4" />
          <span>{formatNumber(tool.downloads)}</span>
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

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { profile: currentUserProfile } = useAuth();
  const apiClient = useApiClient();
  const [filter, setFilter] = useState<VisibilityFilter>("all");

  const isOwnProfile = currentUserProfile?.username?.toLowerCase() === username?.toLowerCase();

  // Fetch user profile
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery<UserProfile>({
    queryKey: ["userProfile", username],
    queryFn: () => getUserProfile(apiClient, username!),
    enabled: !!username,
  });

  // Fetch user's tools
  const {
    data: toolsData,
    isLoading: toolsLoading,
    error: toolsError,
  } = useQuery<UserToolsResponse>({
    queryKey: ["userTools", username, isOwnProfile],
    queryFn: () => getUserTools(apiClient, username!, { includePrivate: isOwnProfile }),
    enabled: !!username,
  });

  if (profileLoading) {
    return (
      <div className="container mx-auto px-4 py-20">
        <Spinner size={40} />
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="card bg-warning-bg border-brand-red">
          <h2 className="text-xl font-semibold text-status-bad mb-2">User Not Found</h2>
          <p className="text-gray-600">The user "{username}" doesn't exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  // Filter tools based on visibility
  const filteredTools =
    toolsData?.tools.filter((tool) => {
      if (filter === "all") return true;
      return tool.visibility === filter;
    }) || [];

  // Count tools by visibility
  const visibilityCounts = {
    all: toolsData?.tools.length || 0,
    public: toolsData?.tools.filter((t) => t.visibility === "public").length || 0,
    private: toolsData?.tools.filter((t) => t.visibility === "private").length || 0,
    unlisted: toolsData?.tools.filter((t) => t.visibility === "unlisted").length || 0,
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="w-32 h-32 rounded-full border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-brand-blue flex items-center justify-center text-white text-4xl font-bold border-4 border-white shadow-lg">
              {profile.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-xl text-gray-500 mb-4">@{profile.username}</p>

          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span>
                {profile.public_tool_count} public tool
                {profile.public_tool_count !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Joined {formatDate(profile.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Section */}
      <div className="border-t border-gray-200 pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isOwnProfile ? "Your Tools" : "Tools"}
          </h2>

          {/* Visibility Filter (only for own profile) */}
          {isOwnProfile && toolsData?.is_own_profile && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                  filter === "all"
                    ? "bg-brand-blue text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Eye className="w-4 h-4" />
                All ({visibilityCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setFilter("public")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                  filter === "public"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Globe className="w-4 h-4" />
                Public ({visibilityCounts.public})
              </button>
              <button
                type="button"
                onClick={() => setFilter("private")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                  filter === "private"
                    ? "bg-yellow-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Lock className="w-4 h-4" />
                Private ({visibilityCounts.private})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unlisted")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                  filter === "unlisted"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <EyeOff className="w-4 h-4" />
                Unlisted ({visibilityCounts.unlisted})
              </button>
            </div>
          )}
        </div>

        {toolsLoading ? (
          <div className="py-12">
            <Spinner size={32} />
          </div>
        ) : toolsError ? (
          <div className="card bg-warning-bg border-brand-red">
            <p className="text-status-bad">
              Error loading tools:{" "}
              {toolsError instanceof Error ? toolsError.message : "Unknown error"}
            </p>
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="card text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {filter !== "all"
                ? `No ${filter} tools found.`
                : isOwnProfile
                  ? "You haven't published any tools yet."
                  : "This user hasn't published any tools yet."}
            </p>
            {isOwnProfile && filter === "all" && (
              <p className="text-sm text-gray-400 mt-2">
                Get started by running{" "}
                <code className="bg-gray-100 px-2 py-1 rounded">enact publish</code>
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTools.map((tool) => (
              <ToolCard
                key={tool.name}
                tool={tool}
                showVisibility={isOwnProfile && toolsData?.is_own_profile === true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
