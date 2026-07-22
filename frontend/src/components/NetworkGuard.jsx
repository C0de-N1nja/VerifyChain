import { useWallet } from "../hooks/useWallet";

export default function NetworkGuard({ children }) {
  const { isCorrectNetwork, switchNetwork, address } = useWallet();

  if (!address) return children;

  if (!isCorrectNetwork) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
        <div className="modern-glass-card border border-rose-200 rounded-3xl p-8 max-w-md w-full space-y-4 shadow-xl">
          <div className="w-12 h-12 bg-rose-50 border border-rose-200 text-rose-600 rounded-full flex items-center justify-center mx-auto font-bold text-xl">
            !
          </div>
          <h2 className="text-xl font-bold text-slate-900">Unsupported Network</h2>
          <p className="text-slate-600 text-xs leading-relaxed">
            VerifyChain operates on zkSync Sepolia Layer 2. Please switch your connected wallet network to proceed.
          </p>
          <button
            onClick={switchNetwork}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md shadow-indigo-500/20"
          >
            Switch Network to zkSync Sepolia
          </button>
        </div>
      </div>
    );
  }

  return children;
}