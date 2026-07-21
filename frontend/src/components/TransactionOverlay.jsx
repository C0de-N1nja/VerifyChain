export default function TransactionOverlay({ status, error, onClose }) {
  if (status === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 max-w-md w-full flex flex-col items-center text-center">
        
        {status === "pending" && (
          <>
            <div className="w-12 h-12 border-4 border-slate-700 border-t-teal-500 rounded-full animate-spin mb-6"></div>
            <h3 className="text-xl font-bold text-white mb-2">Processing Transaction</h3>
            <p className="text-slate-400">
              Your credentials are being registered on the blockchain. This usually takes about 20 to 30 seconds.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-teal-500/10 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Transaction Confirmed</h3>
            <p className="text-slate-400 mb-6">The batch has been successfully anchored on zkSync.</p>
            <button onClick={onClose} className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold py-2 px-6 rounded-lg transition-colors">
              Continue
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Transaction Failed</h3>
            <p className="text-red-400 mb-6">{error || "Something went wrong. Please try again."}</p>
            <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-lg transition-colors">
              Close
            </button>
          </>
        )}
        
      </div>
    </div>
  );
}