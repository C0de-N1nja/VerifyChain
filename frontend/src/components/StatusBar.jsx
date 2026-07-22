import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ZKSYNC_SEPOLIA_PARAMS } from "../config/network";
import { CONTRACTS } from "../config/contracts";
import { formatAddress } from "../utils/formatAddress";

export default function StatusBar() {
  const [blockNumber, setBlockNumber] = useState(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const provider = new ethers.JsonRpcProvider(ZKSYNC_SEPOLIA_PARAMS.rpcUrls[0]);

    const fetchBlock = async () => {
      try {
        const num = await provider.getBlockNumber();
        setBlockNumber(num);
      } catch (err) {
        console.error("RPC block fetch error:", err);
      }
    };

    fetchBlock();
    const interval = setInterval(fetchBlock, 12000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md text-xs py-2 px-4 md:px-8 border-t border-slate-200 text-slate-500 font-mono shadow-sm flex justify-between items-center">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200 font-sans font-medium text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          zkSync Sepolia
        </span>
        <span className="text-slate-300">|</span>
        <span>Block #{blockNumber ? blockNumber.toLocaleString() : "Syncing..."}</span>
      </div>

      <div className="hidden sm:flex items-center gap-6 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-sans">Governance:</span>
          <button 
            onClick={() => copyToClipboard(CONTRACTS.governanceBoard.address, "gov")}
            className="hover:text-indigo-600 transition-colors font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
          >
            {formatAddress(CONTRACTS.governanceBoard.address)}
            {copied === "gov" && <span className="ml-1 text-emerald-600 font-sans">Copied!</span>}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-sans">Registry:</span>
          <button 
            onClick={() => copyToClipboard(CONTRACTS.credentialRegistry.address, "reg")}
            className="hover:text-indigo-600 transition-colors font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
          >
            {formatAddress(CONTRACTS.credentialRegistry.address)}
            {copied === "reg" && <span className="ml-1 text-emerald-600 font-sans">Copied!</span>}
          </button>
        </div>
      </div>
    </footer>
  );
}