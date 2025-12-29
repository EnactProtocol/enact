import { Menu, Search, Terminal, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import UserMenu from "./UserMenu";

const navLinks = [
  { to: "/browse", label: "Browse Tools", external: false },
  { to: "/docs", label: "Docs", external: false },
  { to: "https://github.com/EnactProtocol", label: "GitHub", external: true },
  { to: "/blog", label: "Blog", external: false },
  { to: "https://discord.gg/mMfxvMtHyS", label: "Discord", external: true },
];

export default function Header() {
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-2">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1">
            <Terminal className="h-8 w-8 text-gray-6" />
            <span className="text-xl font-bold text-gray-6">Enact</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-10">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.to}
                  href={link.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-5 hover:text-brand-blue transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-gray-5 hover:text-brand-blue transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
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

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden p-2 text-gray-5 hover:text-gray-6"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden mt-4 pb-2 border-t border-gray-2 pt-4">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) =>
                link.external ? (
                  <a
                    key={link.to}
                    href={link.to}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-5 hover:text-brand-blue transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="text-gray-5 hover:text-brand-blue transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
