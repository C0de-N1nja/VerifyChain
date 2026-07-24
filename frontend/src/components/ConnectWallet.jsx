import { useWallet } from "../hooks/useWallet";
import { formatAddress } from "../utils/formatAddress";
import MetaMaskInstallPrompt from "./MetaMaskInstallPrompt";

export default function ConnectWallet() {
  const { address, connect, disconnect, isMetaMaskInstalled, role } = useWallet();

  if (!isMetaMaskInstalled) return <MetaMaskInstallPrompt />;

  if (address) {
    return (
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 pl-2 shadow-sm">
        {/* Role Indicator */}
        {role.isIssuer && (
          <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md">
            Issuer
          </span>
        )}

        {role.isGovernanceMember && (
          <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
            Governance
          </span>
        )}

        {/* Session Address (Visible for transparency, styled subtly) */}
        <span className="text-xs text-slate-500 font-medium hidden sm:block">
          {formatAddress(address)}
        </span>

        {/* Accessible Disconnect Button */}
        <button 
          onClick={disconnect}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-rose-500"
          aria-label="Sign out of portal"
          title="Sign Out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg text-xs transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
    >
      Secure Access
    </button>
  );
}