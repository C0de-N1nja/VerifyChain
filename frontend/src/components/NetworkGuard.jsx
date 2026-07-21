import { useWallet } from "../hooks/useWallet";

export default function NetworkGuard({ children }) {
  const { isCorrectNetwork, switchNetwork, address } = useWallet();

  // If wallet isn't connected yet, just render the page (the page itself will prompt to connect)
  if (!address) return children;

  if (!isCorrectNetwork) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
        <div className="bg-slate-900 border border-red-500/30 rounded-xl p-8 max-w-md">
          <h2 className="text-2xl font-bold text-white mb-4">Wrong Network</h2>
          <p className="text-slate-400 mb-6">
            This application only runs on zkSync Sepolia. Please switch your network to continue.
          </p>
          <button
            onClick={switchNetwork}
            className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold py-2 px-6 rounded-lg transition-colors"
          >
            Switch to zkSync Sepolia
          </button>
        </div>
      </div>
    );
  }

  return children;
}