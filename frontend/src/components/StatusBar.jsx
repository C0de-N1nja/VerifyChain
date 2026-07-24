import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ZKSYNC_SEPOLIA_PARAMS } from "../config/network";
import { CONTRACTS } from "../config/contracts";
import { formatAddress } from "../utils/formatAddress";

export default function StatusBar() {
  const [isOnline, setIsOnline] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const provider = new ethers.JsonRpcProvider(ZKSYNC_SEPOLIA_PARAMS.rpcUrls[0]);

    const checkConnection = async () => {
      try {
        await provider.getBlockNumber();
        if (!isOnline) setIsOnline(true);
      } catch (err) {
        console.error("RPC connection error:", err);
        if (isOnline) setIsOnline(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 12000);
    return () => clearInterval(interval);
  }, [isOnline]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 py-2.5 px-4 md:px-8 flex justify-between items-center font-sans text-xs text-slate-500">
      {/* SYSTEM STATUS */}
      <div className="flex items-center gap-2.5">
        <span 
          className={`flex items-center gap-2 font-medium px-2.5 py-1 rounded-full border ${
            isOnline 
              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-rose-500"}`}></span>
          {isOnline ? "System Operational" : "Connection Error"}
        </span>
      </div>

      {/* AUDITABLE CONTRACT ADDRESSES */}
      <div className="hidden sm:flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Governance Contract:</span>
          <button 
            onClick={() => copyToClipboard(CONTRACTS.governanceBoard.address, "gov")}
            className="hover:text-indigo-600 transition-colors font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded px-1"
            aria-label="Copy Governance Contract Address"
          >
            {formatAddress(CONTRACTS.governanceBoard.address)}
            {copied === "gov" && <span className="ml-2 text-emerald-600 font-sans">Copied!</span>}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Registry Contract:</span>
          <button 
            onClick={() => copyToClipboard(CONTRACTS.credentialRegistry.address, "reg")}
            className="hover:text-indigo-600 transition-colors font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded px-1"
            aria-label="Copy Registry Contract Address"
          >
            {formatAddress(CONTRACTS.credentialRegistry.address)}
            {copied === "reg" && <span className="ml-2 text-emerald-600 font-sans">Copied!</span>}
          </button>
        </div>
      </div>
    </footer>
  );
}