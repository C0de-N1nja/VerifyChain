import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { useWallet } from "./hooks/useWallet";
import ConnectWallet from "./components/ConnectWallet";
import NetworkGuard from "./components/NetworkGuard";
import Landing from "./pages/Landing";
import IssuerPortal from "./pages/IssuerPortal";
import VerifierPortal from "./pages/VerifierPortal";
import GovernanceDashboard from "./pages/GovernanceDashboard";

export default function App() {
  const { address } = useWallet();

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-slate-800 sticky top-0 bg-slate-950 z-40">
          <Link to="/" className="text-xl font-bold text-teal-400">VerifyChain</Link>
          <ConnectWallet />
        </header>

        <main className="flex-1 p-6 md:p-8">
          <NetworkGuard>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/issuer" element={<IssuerPortal />} />
              <Route path="/verify" element={<VerifierPortal />} />
              <Route path="/governance" element={<GovernanceDashboard />} />
            </Routes>
          </NetworkGuard>
        </main>
      </div>
    </BrowserRouter>
  );
}