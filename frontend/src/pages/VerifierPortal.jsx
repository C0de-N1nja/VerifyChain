import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { API_URL, CONTRACTS } from "../config/contracts";
import { formatAddress } from "../utils/formatAddress";

export default function VerifierPortal() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("idle"); // idle | verifying | valid | expired | revoked | not_found | error
  const [verifyData, setVerifyData] = useState(null);
  const [manualRoot, setManualRoot] = useState("");
  const [manualLeaf, setManualLeaf] = useState("");

  useEffect(() => {
    try {
      const merkleRoot = searchParams.get("merkleRoot");
      const leaf = searchParams.get("leaf");
      const proof = searchParams.get("proof") || "";

      if (merkleRoot && leaf) {
        verifyCredential(merkleRoot, leaf, proof);
      }
    } catch (err) {
      console.error("URL Parsing Error:", err);
    }
  }, [searchParams]);

  const verifyCredential = async (root, leaf, proofStr) => {
    setStatus("verifying");
    setVerifyData(null);

    try {
      let proofParam = "";
      if (proofStr && typeof proofStr === "string" && proofStr.trim().length > 0) {
        proofParam = proofStr;
      }

      const response = await fetch(
        `${API_URL}/api/verify/qr-scan?merkleRoot=${root}&leaf=${leaf}&proof=${proofParam}`
      );

      if (!response.ok) {
        setStatus("not_found");
        return;
      }

      const data = await response.json();

      if (data.status === "Valid") {
        setVerifyData({
          issuer: data.issuer || "0x0000000000000000000000000000000000000000",
          merkleRoot: root,
          leaf: leaf,
          proofCount: proofParam ? proofParam.split(",").length : 0,
        });
        setStatus("valid");
      } else if (data.status === "Expired") {
        setVerifyData({ expiredOn: data.expiredOn || "" });
        setStatus("expired");
      } else if (data.status === "Revoked") {
        setVerifyData({
          merkleRoot: root,
          leaf: leaf,
        });
        setStatus("revoked");
      } else {
        setStatus("not_found");
      }
    } catch (error) {
      console.error("Verification Error:", error);
      setStatus("error");
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualRoot && manualLeaf) {
      verifyCredential(manualRoot.trim(), manualLeaf.trim(), "");
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-8 font-sans">
      {/* HEADER */}
      <div className="text-center space-y-2">
        <span className="text-xs font-mono font-bold tracking-wider uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
          Public Verifier Portal
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Credential Verification Engine
        </h1>
        <p className="text-slate-500 text-xs max-w-md mx-auto">
          Automated cryptographic proof validation against zkSync Sepolia smart contracts.
        </p>
      </div>

      {/* VERIFYING LOADING STATE */}
      {status === "verifying" && (
        <div className="modern-glass-card p-12 rounded-3xl text-center space-y-4 border border-slate-200 shadow-xl">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
          <h3 className="text-lg font-bold text-slate-900">Verifying Cryptographic Proof</h3>
          <p className="text-slate-500 text-xs font-mono">Querying zkSync Sepolia Layer 2...</p>
        </div>
      )}

      {/* VALID CREDENTIAL RESULT STATE */}
      {status === "valid" && verifyData && (
        <div className="space-y-6">
          {/* VALID SEAL BANNER */}
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-6 text-center space-y-2 shadow-sm">
            <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md font-bold text-xl">
              ✓
            </div>
            <h2 className="text-2xl font-extrabold text-emerald-900 tracking-tight">
              Cryptographically Authentic Credential
            </h2>
            <p className="text-emerald-700 text-xs font-mono font-medium">
              Verified on-chain via zkSync Sepolia smart contract
            </p>
          </div>

          {/* ISSUER DETAILS */}
          <div className="modern-glass-card p-6 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Issuing Authority</h3>
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Whitelisted Issuer Address</span>
              <span className="font-mono text-xs font-bold text-indigo-600 bg-white px-3 py-1 rounded border border-slate-200">
                {formatAddress(verifyData.issuer)}
              </span>
            </div>
          </div>

          {/* VISUAL MERKLE TREE DIAGRAM */}
          <div className="modern-glass-card p-8 rounded-3xl border border-slate-200/90 space-y-6 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Cryptographic Merkle Tree Structure</h3>
                <p className="text-[11px] text-slate-500">Visual proof path reconstruction to the on-chain root.</p>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-bold">
                Proof Verified
              </span>
            </div>

            {/* TREE STRUCTURE DIAGRAM */}
            <div className="flex flex-col items-center gap-4 py-4 font-mono text-xs">
              <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-lg shadow-indigo-500/20 text-center font-bold">
                <p className="text-[9px] font-sans uppercase tracking-wider text-indigo-200 font-bold">On-Chain Merkle Root</p>
                <p className="text-sm mt-0.5">{formatAddress(verifyData.merkleRoot)}</p>
              </div>

              <div className="w-0.5 h-6 bg-indigo-300"></div>

              <div className="bg-emerald-50 border-2 border-emerald-500/60 p-4 rounded-2xl text-center max-w-sm w-full space-y-1 shadow-sm">
                <div className="flex justify-between items-center border-b border-emerald-200/60 pb-1 mb-1">
                  <span className="text-[9px] font-sans uppercase text-emerald-800 font-bold">Credential Leaf Node</span>
                  <span className="text-[9px] font-sans bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">Scanned Record</span>
                </div>
                <p className="text-emerald-900 font-bold text-xs">{formatAddress(verifyData.leaf)}</p>
              </div>
            </div>
          </div>

          {/* LIVE ON-CHAIN AUDIT RECEIPT CARD INSIDE APP */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-3 font-mono text-xs shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-teal-400 font-bold uppercase text-[10px] tracking-wider font-sans">On-Chain Cryptographic Receipt</span>
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-sans text-[10px]">Confirmed on Layer 2</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Network:</span>
              <span className="text-slate-200">zkSync Sepolia (Chain ID 300)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Registry Contract:</span>
              <span className="text-slate-200">{formatAddress(CONTRACTS.credentialRegistry.address)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Merkle Root:</span>
              <span className="text-teal-400 font-bold">{formatAddress(verifyData.merkleRoot)}</span>
            </div>
            <div className="pt-2">
              <a
                href={`https://sepolia.explorer.zksync.io/address/${CONTRACTS.credentialRegistry.address}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block bg-teal-500 hover:bg-teal-400 text-slate-950 font-sans font-bold px-4 py-2 rounded-lg text-xs transition-colors"
              >
                View Contract on zkSync Explorer ↗
              </a>
            </div>
          </div>

          <button
            onClick={() => setStatus("idle")}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl text-xs transition-colors border border-slate-300"
          >
            Verify Another Credential
          </button>
        </div>
      )}

      {/* REVOKED RESULT STATE WITH ON-CHAIN PROOF */}
      {status === "revoked" && (
        <div className="space-y-6">
          <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-8 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 bg-rose-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md font-bold text-xl">
              ✕
            </div>
            <h2 className="text-2xl font-extrabold text-rose-900 tracking-tight">Credential Revoked</h2>
            <p className="text-rose-800 text-xs leading-relaxed max-w-md mx-auto">
              This credential has been permanently cancelled on-chain by the issuing institution.
            </p>
          </div>

          {/* LIVE ON-CHAIN REVOCATION RECEIPT INSIDE APP */}
          {verifyData && (
            <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-3 font-mono text-xs shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-rose-400 font-bold uppercase text-[10px] tracking-wider font-sans">On-Chain Revocation Proof</span>
                <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded font-sans text-[10px]">revokedLeaves[leaf] == true</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Revoked Leaf Hash:</span>
                <span className="text-rose-400 font-bold">{formatAddress(verifyData.leaf)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Batch Merkle Root:</span>
                <span className="text-slate-200">{formatAddress(verifyData.merkleRoot)}</span>
              </div>
              <div className="pt-2">
                <a
                  href={`https://sepolia.explorer.zksync.io/address/${CONTRACTS.credentialRegistry.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block bg-rose-600 hover:bg-rose-500 text-white font-sans font-bold px-4 py-2 rounded-lg text-xs transition-colors"
                >
                  Verify Revocation Event on Explorer ↗
                </a>
              </div>
            </div>
          )}

          <button
            onClick={() => setStatus("idle")}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl text-xs border border-slate-300 transition-colors"
          >
            Reset Verifier
          </button>
        </div>
      )}

      {/* EXPIRED / NOT FOUND / ERROR */}
      {(status === "expired" || status === "not_found" || status === "error") && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-3 shadow-sm">
          <h2 className="text-2xl font-extrabold text-rose-900 tracking-tight">
            {status === "expired" ? "Credential Expired" : "Verification Failed"}
          </h2>
          <p className="text-rose-800 text-xs">
            {status === "expired"
              ? "The expiration timestamp for this credential has passed."
              : "No matching on-chain record found for this credential."}
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-4 bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold px-6 py-2 rounded-xl text-xs border border-rose-300"
          >
            Reset Verifier
          </button>
        </div>
      )}

      {/* MANUAL LOOKUP */}
      {status === "idle" && (
        <div className="modern-glass-card p-8 rounded-3xl space-y-6 border border-slate-200">
          <h3 className="text-base font-bold text-slate-900">Manual Credential Verification</h3>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <input
              type="text"
              value={manualRoot}
              onChange={(e) => setManualRoot(e.target.value)}
              placeholder="Merkle Root (0x...)"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-900"
            />
            <input
              type="text"
              value={manualLeaf}
              onChange={(e) => setManualLeaf(e.target.value)}
              placeholder="Leaf Hash (0x...)"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-900"
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs shadow-md"
            >
              Verify On-Chain
            </button>
          </form>
        </div>
      )}
    </div>
  );
}