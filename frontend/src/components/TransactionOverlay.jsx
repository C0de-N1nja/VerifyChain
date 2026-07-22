import { useState, useEffect } from "react";

export default function TransactionOverlay({ status, error, onClose }) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let timer;
    if (status === "pending") {
      setElapsedTime(0);
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status]);

  if (status === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full flex flex-col items-center text-center shadow-2xl space-y-4 font-sans">
        
        {status === "pending" && (
          <>
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin my-2"></div>
            <h3 className="text-lg font-bold text-slate-900">Processing Blockchain Transaction</h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              Your transaction is being committed to zkSync Sepolia Layer 2.
            </p>
            {/* LIVE ON-CHAIN CONFIRMATION TIMER */}
            <div className="bg-indigo-50 border border-indigo-100 font-mono text-indigo-700 font-bold px-4 py-1.5 rounded-full text-xs">
              On-Chain Confirmation Time: {elapsedTime}s
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-xl my-2 shadow-md shadow-emerald-500/20">
              ✓
            </div>
            <h3 className="text-lg font-bold text-slate-900">Transaction Confirmed</h3>
            <p className="text-slate-600 text-xs">
              Anchored on zkSync Sepolia in <span className="font-mono font-bold text-emerald-600">{elapsedTime} seconds</span>.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-indigo-500/20"
            >
              Continue
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-12 h-12 bg-rose-600 text-white rounded-full flex items-center justify-center font-bold text-xl my-2 shadow-md shadow-rose-600/20">
              ✕
            </div>
            <h3 className="text-lg font-bold text-slate-900">Transaction Failed</h3>
            <p className="text-rose-600 text-xs mb-2">{error || "The blockchain transaction was rejected or failed."}</p>
            <button
              onClick={onClose}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl text-xs transition-colors border border-slate-300"
            >
              Close
            </button>
          </>
        )}
        
      </div>
    </div>
  );
}