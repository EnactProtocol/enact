import { CheckCircle, Terminal } from "lucide-react";
import { Link } from "react-router-dom";

export default function CliSuccess() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">
        <div className="p-8 text-center border border-gray-200 rounded-[2rem] bg-white shadow-[0_4px_24px_0_rgba(0,0,0,0.02),0_4px_32px_0_rgba(0,0,0,0.02),0_2px_64px_0_rgba(0,0,0,0.01),0_16px_32px_0_rgba(0,0,0,0.01)]">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h1>
          <p className="text-gray-500 mb-6">
            Your Enact CLI has been successfully authenticated. You can now return to your terminal.
          </p>

          <div className="bg-gray-900 text-gray-100 p-4 rounded-xl mb-6 text-left">
            <div className="flex items-center gap-2 mb-3 text-gray-400">
              <Terminal className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Try it out</span>
            </div>
            <code className="text-sm font-mono leading-relaxed">
              <span className="text-green-400">$</span> enact search python
              <br />
              <span className="text-green-400">$</span> enact install alice/greeter
              <br />
              <span className="text-green-400">$</span> enact run alice/greeter
            </code>
          </div>

          <Link
            to="/browse"
            className="inline-flex items-center justify-center w-full h-11 px-5 bg-brand-blue text-white rounded-xl font-medium hover:scale-y-[1.015] hover:scale-x-[1.005] transition-transform duration-150 ease-[cubic-bezier(0.165,0.85,0.45,1)] active:scale-[0.985]"
          >
            Browse Tools
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-gray-400">You can safely close this window</p>
      </div>
    </div>
  );
}
