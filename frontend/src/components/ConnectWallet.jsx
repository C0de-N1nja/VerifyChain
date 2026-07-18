import { useWallet } from "../hooks/useWallet";
import { formatAddress } from "../utils/formatAddress";
import MetaMaskInstallPrompt from "./MetaMaskInstallPrompt";

export default function ConnectWallet() {
  const { address, connect, disconnect, isMetaMaskInstalled, role } = useWallet();

  if (!isMetaMaskInstalled) return <MetaMaskInstallPrompt />;

  if (address) {
    return (
      <div className="flex items-center gap-4 bg-slate-800/50 border border-slate-700 rounded-lg p-2 pr-4">
        {role.isIssuer && (
          <span className="text-xs font-mono bg-teal-500/10 text-teal-400 px-2 py-1 rounded">
            Tier {role.tier}
          </span>
        )}
        {role.isGovernanceMember && (
          <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded">
            Board
          </span>
        )}
        <span className="font-mono text-sm text-slate-200">{formatAddress(address)}</span>
        <button 
          onClick={disconnect}
          className="text-xs text-slate-400 hover:text-red-400 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold py-2 px-6 rounded-lg transition-colors"
    >
      Connect Wallet
    </button>
  );
}