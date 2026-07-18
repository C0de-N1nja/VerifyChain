import { useEffect } from "react";

export default function Toast({ message, type = "info", onClose }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000); // Auto-dismiss after 4 seconds

      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  const styles = {
    error: "bg-red-500/10 border-red-500/30 text-red-400",
    success: "bg-teal-500/10 border-teal-500/30 text-teal-400",
    info: "bg-slate-700/50 border-slate-600 text-slate-200",
  };

  return (
    <div className="fixed bottom-8 right-8 z-[60] animate-slide-in">
      <div className={`flex items-center gap-3 border rounded-lg px-4 py-3 shadow-xl backdrop-blur-sm ${styles[type]}`}>
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}