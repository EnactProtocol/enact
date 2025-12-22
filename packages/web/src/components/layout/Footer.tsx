import { Github, MessageCircle, Terminal } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-1 border-t border-gray-2 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-1 mb-4">
              <Terminal className="h-6 w-6 text-gray-6" />
              <span className="text-xl font-bold text-gray-6">Enact</span>
            </div>
            <p className="text-gray-5 max-w-md">
              The npm for AI tools. Browse, discover, and safely run AI-executable tools with
              cryptographic verification.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-gray-6">Resources</h3>
            <ul className="space-y-2 text-gray-5">
              <li>
                <a
                  href="https://github.com/EnactProtocol/enact#readme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-blue"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/EnactProtocol/enact/blob/main/packages/cli/README.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-blue"
                >
                  CLI Guide
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/EnactProtocol/enact/blob/main/docs/publishing.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-blue"
                >
                  Publishing Tools
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-gray-6">Community</h3>
            <ul className="space-y-2 text-gray-5">
              <li>
                <a
                  href="https://discord.gg/mMfxvMtHyS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-blue flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Discord
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/EnactProtocol/enact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-blue flex items-center gap-2"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/EnactProtocol/enact/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-blue"
                >
                  Report Issues
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-2 mt-8 pt-6 text-center text-sm text-gray-5">
          <p>&copy; {currentYear} Enact. Built with ❤️ for the AI community.</p>
        </div>
      </div>
    </footer>
  );
}
