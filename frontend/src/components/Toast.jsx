import { useEffect } from "react";

export default function Toast({ message, type = "info", onClose }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  const styles = {
    error: "bg-rose-50 border-rose-200 text-rose-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    info: "bg-white border-slate-200 text-slate-800 shadow-xl shadow-slate-200/50",
  };

  return (
    <div className="fixed bottom-12 right-8 z-[60] transition-all">
      <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 shadow-lg ${styles[type]}`}>
        <span className="text-xs font-semibold">{message}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors font-bold text-xs">
          ✕
        </button>
      </div>
    </div>
  );
}