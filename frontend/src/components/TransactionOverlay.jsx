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

  // Handle Escape key to close (only if not pending)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape" && status !== "pending") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [status, onClose]);

  if (status === "idle") return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="overlay-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full flex flex-col items-center text-center shadow-xl space-y-4 font-sans">
        
        {/* PENDING STATE */}
        {status === "pending" && (
          <>
            <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin my-2"></div>
            <h3 id="overlay-title" className="text-lg font-semibold text-slate-900">Securing Credential</h3>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
              Please approve the action in your security portal and wait for the network to confirm.
            </p>
            {/* SUBTLE ELAPSED TIME */}
            {elapsedTime > 3 && (
              <p className="text-slate-400 text-xs font-medium">
                This usually takes a few seconds...
              </p>
            )}
          </>
        )}

        {/* SUCCESS STATE */}
        {status === "success" && (
          <>
            <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center my-2 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 id="overlay-title" className="text-lg font-semibold text-slate-900">Action Completed</h3>
            <p className="text-slate-600 text-sm">
              The credential has been securely registered.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 mt-2"
            >
              Continue
            </button>
          </>
        )}

        {/* ERROR STATE */}
        {status === "error" && (
          <>
            <div className="w-12 h-12 bg-rose-600 text-white rounded-full flex items-center justify-center my-2 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 id="overlay-title" className="text-lg font-semibold text-slate-900">Action Failed</h3>
            <p className="text-slate-600 text-sm mb-2 max-w-xs">
              {error || "The action was cancelled or failed to process. Please try again."}
            </p>
            <button
              onClick={onClose}
              className="w-full bg-white hover:bg-slate-50 text-slate-800 font-medium py-2.5 rounded-lg text-sm transition-colors border border-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 mt-2"
            >
              Close
            </button>
          </>
        )}
        
      </div>
    </div>
  );
}