import { useEffect, useState } from "react";

export default function Toast({ message, type = "info", onClose }) {
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (message && !isPaused) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // Increased to 5s for better readability

      return () => clearTimeout(timer);
    }
  }, [message, onClose, isPaused]);

  if (!message) return null;

  const styles = {
    error: "bg-rose-50 border-rose-200 text-rose-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    info: "bg-white border-slate-200 text-slate-800 shadow-lg shadow-slate-200/50",
  };

  const icons = {
    error: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    success: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    info: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div 
      className="fixed bottom-16 left-4 right-4 sm:left-auto sm:right-8 sm:w-auto sm:max-w-sm z-[60] transition-all duration-300 ease-out"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      <div className={`flex items-start gap-3 border rounded-xl px-4 py-3 shadow-lg ${styles[type]}`}>
        <div className="flex-shrink-0 pt-0.5">
          {icons[type]}
        </div>
        <span className="flex-1 text-sm font-medium leading-5">
          {message}
        </span>
        <button 
          onClick={onClose} 
          className="flex-shrink-0 -mt-1 -mr-1 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
          aria-label="Dismiss notification"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}