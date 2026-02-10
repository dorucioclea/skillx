import { Link } from "react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 h-14 border-b border-sx-border bg-sx-bg/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="font-mono text-lg font-bold">
          SKILL<span className="text-sx-accent">X</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-6 md:flex">
          <Link
            to="/leaderboard"
            className="text-sm text-sx-fg-muted transition-colors hover:text-sx-fg"
          >
            Leaderboard
          </Link>
          <Link
            to="/search"
            className="text-sm text-sx-fg-muted transition-colors hover:text-sx-fg"
          >
            Search
          </Link>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          <Link
            to="/settings"
            className="hidden rounded-lg bg-sx-accent px-4 py-2 text-sm font-medium text-sx-bg transition-colors hover:bg-sx-accent-hover md:block"
          >
            Get API Key
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-sx-fg-muted transition-colors hover:text-sx-fg md:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-sx-border bg-sx-bg-elevated md:hidden">
          <div className="flex flex-col space-y-1 px-4 py-3">
            <Link
              to="/leaderboard"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-sx-fg-muted transition-colors hover:bg-sx-bg-hover hover:text-sx-fg"
            >
              Leaderboard
            </Link>
            <Link
              to="/search"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-sx-fg-muted transition-colors hover:bg-sx-bg-hover hover:text-sx-fg"
            >
              Search
            </Link>
            <Link
              to="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg bg-sx-accent px-3 py-2 text-sm font-medium text-sx-bg transition-colors hover:bg-sx-accent-hover"
            >
              Get API Key
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
