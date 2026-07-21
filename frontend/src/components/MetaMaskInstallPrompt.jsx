export default function MetaMaskInstallPrompt() {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-900 text-white rounded-xl border border-slate-700">
      <h2 className="text-xl font-bold mb-4">MetaMask Not Found</h2>
      <p className="text-slate-400 mb-6 text-center">
        You need MetaMask to use this portal. Please install the extension to continue.
      </p>
      <a 
        href="https://metamask.io/download/" 
        target="_blank" 
        rel="noreferrer"
        className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
      >
        Install MetaMask
      </a>
    </div>
  );
}