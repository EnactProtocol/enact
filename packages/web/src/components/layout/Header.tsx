import { Search, Terminal } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import UserMenu from "./UserMenu";

export default function Header() {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-2">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1">
            <Terminal className="h-8 w-8 text-gray-6" />
            <span className="text-xl font-bold text-gray-6">Enact</span>
          </Link>

          <nav className="hidden md:flex items-center gap-10">
            <Link to="/browse" className="text-gray-5 hover:text-brand-blue transition-colors">
              Browse Tools
            </Link>
            <Link to="/docs" className="text-gray-5 hover:text-brand-blue transition-colors">
              Docs
            </Link>
            <a
              href="https://enactprotocol.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-5 hover:text-brand-blue transition-colors"
            >
              Protocol
            </a>
            <a
              href="https://github.com/EnactProtocol"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-5 hover:text-brand-blue transition-colors"
            >
              GitHub
            </a>
            <Link to="/blog" className="text-gray-5 hover:text-brand-blue transition-colors">
              Blog
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/browse" className="btn-secondary flex items-center gap-2">
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </Link>

            {/* Auth section */}
            {!loading &&
              (user ? (
                <UserMenu />
              ) : (
                <Link to="/login" className="btn-primary text-sm px-4 py-2">
                  Sign in
                </Link>
              ))}
          </div>
        </div>
      </div>
    </header>
  );
}
