import { useWallet } from "../hooks/useWallet";
import { formatAddress } from "../utils/formatAddress";
import MetaMaskInstallPrompt from "./MetaMaskInstallPrompt";

export default function ConnectWallet() {
  const { address, connect, disconnect, isMetaMaskInstalled, role } = useWallet();

  if (!isMetaMaskInstalled) return <MetaMaskInstallPrompt />;

  if (address) {
    return (
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-1.5 pr-4 shadow-sm text-xs">
        {role.isIssuer && (
          <span className="font-mono font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200">
            Tier {role.tier}
          </span>
        )}

        {role.isGovernanceMember && (
          <span className="font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200">
            Board
          </span>
        )}

        <span className="font-mono font-bold text-slate-800 pl-1">{formatAddress(address)}</span>

        <button 
          onClick={disconnect}
          className="text-slate-400 hover:text-rose-600 transition-colors font-medium ml-1"
          title="Disconnect Wallet"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-all shadow-md shadow-indigo-500/20"
    >
      Connect Wallet
    </button>
  );
}