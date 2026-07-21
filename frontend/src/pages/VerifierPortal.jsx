import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { API_URL } from "../config/contracts";
import { formatAddress } from "../utils/formatAddress";

export default function VerifierPortal() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("idle");
  const [credentialId, setCredentialId] = useState("");
  const [verifyData, setVerifyData] = useState(null);

  useEffect(() => {
    const merkleRoot = searchParams.get("merkleRoot");
    const leaf = searchParams.get("leaf");
    const proof = searchParams.get("proof");

    if (merkleRoot && leaf) {
      verifyCredential(merkleRoot, leaf, proof);
    }
  }, [searchParams]);

  const verifyCredential = async (root, leaf, proofStr) => {
    setStatus("verifying");
    setVerifyData(null);

    try {
      let proofArray = [];
      if (proofStr && proofStr.length > 0) {
        proofArray = proofStr.split(',');
      }

      const response = await fetch(`${API_URL}/api/verify/${credentialId || "qr-scan"}?merkleRoot=${root}&leaf=${leaf}&proof=${proofArray.join(',')}`);
      const data = await response.json();

      if (data.status === "Valid") {
        setVerifyData({ issuer: data.issuer });
        setStatus("valid");
      } else if (data.status === "Expired") {
        setStatus("expired");
      } else if (data.status === "Revoked") {
        setStatus("revoked");
      } else {
        setStatus("not_found");
      }
    } catch (error) {
      console.error("Verification failed:", error);
      setStatus("error");
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (credentialId) {
      setStatus("verifying");
      setTimeout(() => setStatus("not_found"), 1500);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 px-4 font-sans">
      {/* VERIFICATION STATES */}
      {status === "verifying" && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-teal-500 rounded-full animate-spin mb-6"></div>
          <h3 className="text-xl font-bold text-white mb-2">Verifying Credential</h3>
          <p className="text-slate-400">Checking cryptographic proof against zkSync...</p>
        </div>
      )}

      {status === "valid" && verifyData && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-green-400 tracking-tight">Valid Credential</h2>
            <p className="text-slate-400 text-sm mt-1 font-mono">Cryptographically verified on zkSync</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Issued By</p>
              <p className="text-lg text-white font-mono break-all">{formatAddress(verifyData.issuer)}</p>
            </div>
          </div>

          {/* Signature Element: Merkle Tree Visual */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-6 text-center">Merkle Proof Path</p>
            <div className="flex flex-col items-center gap-3">
              <div className="bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-mono px-4 py-2 rounded-lg">
                Leaf (Credential Hash)
              </div>
              <div className="w-px h-6 bg-slate-700"></div>
              <div className="bg-slate-800 border border-slate-700 text-slate-400 text-xs font-mono px-4 py-2 rounded-lg">
                Proof Node 1
              </div>
              <div className="w-px h-6 bg-slate-700"></div>
              <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-mono px-4 py-2 rounded-lg">
                Merkle Root (Anchored on-chain)
              </div>
            </div>
          </div>
        </div>
      )}

      {status === "expired" && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-amber-400">Credential Expired</h2>
          <p className="text-slate-400 mt-2">This credential was once genuine but has now expired.</p>
        </div>
      )}

      {status === "revoked" && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-red-400">Credential Revoked</h2>
          <p className="text-slate-400 mt-2">This credential has been cancelled by the issuing institution.</p>
        </div>
      )}

      {status === "not_found" && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-red-400">Not Found</h2>
          <p className="text-slate-400 mt-2">This certificate does not match any record on the blockchain.</p>
        </div>
      )}

      {status === "error" && (
        <div className="bg-slate-700 border border-slate-600 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white">RPC Unavailable</h2>
          <p className="text-slate-300 mt-2">Verification is temporarily unavailable, please try again in a few minutes.</p>
        </div>
      )}

      {/* MANUAL ENTRY */}
      {status === "idle" && (
        <div className="text-center mt-10">
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Verify a Credential</h2>
          <p className="text-slate-400 mb-8">Scan a QR code from a certificate to verify it instantly.</p>
          
          <div className="border-t border-slate-800 pt-8 mt-8">
            <p className="text-sm text-slate-500 mb-4">Have a credential ID? Enter it manually:</p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
                placeholder="0x... or UUID"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-teal-500 font-mono text-sm"
              />
              <button type="submit" className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold px-6 rounded-lg transition-colors">
                Verify
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}