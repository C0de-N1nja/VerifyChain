export default function MetaMaskInstallPrompt() {
  return (
    <div className="modern-glass-card border border-slate-200 rounded-2xl p-6 text-slate-900 max-w-sm text-center space-y-4">
      <h2 className="text-base font-bold text-slate-900">MetaMask Wallet Required</h2>
      <p className="text-slate-500 text-xs leading-relaxed">
        To access governance or issuer administrative features, please install the MetaMask extension.
      </p>
      <a 
        href="https://metamask.io/download/" 
        target="_blank" 
        rel="noreferrer"
        className="inline-block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-indigo-500/20"
      >
        Install MetaMask Extension
      </a>
    </div>
  );
}