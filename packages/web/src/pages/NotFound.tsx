import { Home, Search } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-6xl font-bold text-gray-2 mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
        <p className="text-gray-5 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/" className="btn-primary flex items-center gap-2">
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <Link to="/browse" className="btn-secondary flex items-center gap-2">
            <Search className="w-4 h-4" />
            Browse Tools
          </Link>
        </div>
      </div>
    </div>
  );
}
