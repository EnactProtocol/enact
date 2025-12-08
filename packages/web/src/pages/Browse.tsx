import ToolCard from "@/components/tools/ToolCard";
import SearchBar from "@/components/ui/SearchBar";
import Spinner from "@/components/ui/Spinner";
import { searchTools } from "@/lib/api";
import { apiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["tools", "search", query],
    queryFn: () => searchTools(apiClient, { query: query || "*" }),
  });

  const handleSearch = (newQuery: string) => {
    setSearchParams({ q: newQuery });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Browse Tools</h1>
        <SearchBar initialQuery={query} onSearch={handleSearch} />
      </div>

      {isLoading && (
        <div className="py-20">
          <Spinner size={40} />
        </div>
      )}

      {error && (
        <div className="card bg-warning-bg border-brand-red">
          <p className="text-status-bad">
            Error loading tools: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      )}

      {data && (
        <div>
          <div className="mb-4 text-sm text-gray-500">
            Found {data.total} tool{data.total !== 1 ? "s" : ""}
          </div>
          {data.results.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">No tools found. Try a different search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.results.map((tool) => (
                <ToolCard key={tool.name} tool={tool} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
