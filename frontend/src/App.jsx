import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { useWallet } from "./hooks/useWallet";
import ConnectWallet from "./components/ConnectWallet";
import NetworkGuard from "./components/NetworkGuard";
import StatusBar from "./components/StatusBar";
import Landing from "./pages/Landing";
import IssuerPortal from "./pages/IssuerPortal";
import VerifierPortal from "./pages/VerifierPortal";
import GovernanceDashboard from "./pages/GovernanceDashboard";

function Navigation() {
  const { address, role } = useWallet();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 modern-header px-4 md:px-8 py-3.5 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2 text-slate-900 font-extrabold tracking-tight group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 p-0.5 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center text-indigo-600 font-mono text-sm font-bold">
              V
            </div>
          </div>
          <span className="text-xl">Verify<span className="text-indigo-600">Chain</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/verify"
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              isActive("/verify")
                ? "bg-indigo-50 text-indigo-600 border border-indigo-200/60 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            Verify Credential
          </Link>

          {address && role.isIssuer && (
            <Link
              to="/issuer"
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                isActive("/issuer")
                  ? "bg-indigo-50 text-indigo-600 border border-indigo-200/60 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              Issuer Portal
            </Link>
          )}

          {address && role.isGovernanceMember && (
            <Link
              to="/governance"
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                isActive("/governance")
                  ? "bg-indigo-50 text-indigo-600 border border-indigo-200/60 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              Governance Board
            </Link>
          )}
        </nav>
      </div>

      <ConnectWallet />
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col relative font-sans selection:bg-indigo-500/10 selection:text-indigo-600">
        {/* Soft Ambient Light Gradients */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <Navigation />

        <main className="flex-1 p-6 md:p-10 pb-20 max-w-6xl mx-auto w-full relative z-10">
          <NetworkGuard>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/issuer" element={<IssuerPortal />} />
              <Route path="/verify" element={<VerifierPortal />} />
              <Route path="/governance" element={<GovernanceDashboard />} />
            </Routes>
          </NetworkGuard>
        </main>

        <StatusBar />
      </div>
    </BrowserRouter>
  );
}