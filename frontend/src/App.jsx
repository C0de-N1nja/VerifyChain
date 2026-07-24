import { useState } from "react";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const navLinks = (
    <>
      <Link
        to="/verify"
        onClick={() => setIsMobileMenuOpen(false)}
        aria-current={isActive("/verify") ? "page" : undefined}
        className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive("/verify")
            ? "bg-slate-100 text-indigo-600"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        Verify Credential
      </Link>

      {address && role.isIssuer && (
        <Link
          to="/issuer"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-current={isActive("/issuer") ? "page" : undefined}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive("/issuer")
              ? "bg-slate-100 text-indigo-600"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          Issuer Portal
        </Link>
      )}

      {address && role.isGovernanceMember && (
        <Link
          to="/governance"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-current={isActive("/governance") ? "page" : undefined}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive("/governance")
              ? "bg-slate-100 text-indigo-600"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          Governance Board
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 md:px-8 py-3 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2 text-slate-900 font-bold tracking-tight">
          {/* Solid, enterprise-grade logo */}
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-mono text-sm font-bold">
            V
          </div>
          <span className="text-lg">Verify<span className="text-indigo-600">Chain</span></span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2">
          {navLinks}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {!isActive("/verify") && <ConnectWallet />}
        
        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={isMobileMenuOpen}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Dropdown Navigation */}
      {isMobileMenuOpen && (
        <nav className="absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-sm md:hidden flex flex-col p-4 space-y-2">
          {navLinks}
        </nav>
      )}
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500/10 selection:text-indigo-600">
        
        <Navigation />

        <main id="main-content" className="flex-1 p-6 md:p-10 pb-20 max-w-7xl mx-auto w-full">
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