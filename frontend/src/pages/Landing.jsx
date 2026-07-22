import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";

export default function Landing() {
  const { address, role } = useWallet();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeaf, setSelectedLeaf] = useState(0);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/verify?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const sampleLeaves = [
    { name: "Ali Raza", hash: "0x8f2a...91b0", degree: "BS Computer Science" },
    { name: "Sara Khan", hash: "0x3c1d...44e8", degree: "MS Data Science" },
    { name: "Usman Ahmed", hash: "0x7e9f...12a4", degree: "BS Software Eng" },
  ];

  return (
    <div className="space-y-16 py-4">
      {/* HERO SECTION */}
      <section className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold shadow-sm">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
          zkSync Era Layer-2 Cryptographic Protocol
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Universal Academic Verification <br />
          <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-500 bg-clip-text text-transparent">
            Powered by Merkle Trees
          </span>
        </h1>

        <p className="text-slate-600 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
          VerifyChain anchors thousands of academic credentials under a single 32-byte Merkle Root on-chain. Student data remains completely private off-chain while verification is instant.
        </p>

        {/* SEARCH WIDGET */}
        <form onSubmit={handleSearch} className="max-w-xl mx-auto pt-2">
          <div className="modern-glass-card p-2 rounded-2xl flex items-center gap-2 shadow-xl shadow-slate-200/50 border border-slate-200 focus-within:border-indigo-500 transition-all">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Paste Merkle Root, Leaf Hash, or Credential ID"
              className="w-full bg-transparent px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-mono"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-indigo-500/20 whitespace-nowrap"
            >
              Verify
            </button>
          </div>
        </form>

        {/* QUICK NAVIGATION BUTTONS */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            to="/verify"
            className="bg-white hover:bg-slate-50 text-slate-800 font-semibold px-5 py-2.5 rounded-xl text-sm border border-slate-200 shadow-sm transition-all"
          >
            Public Verifier
          </Link>

          {address && role.isIssuer && (
            <Link
              to="/issuer"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-md shadow-indigo-500/20 transition-all"
            >
              Issuer Portal
            </Link>
          )}

          {address && role.isGovernanceMember && (
            <Link
              to="/governance"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-md transition-all"
            >
              Governance Board
            </Link>
          )}
        </div>
      </section>

      {/* INTERACTIVE MERKLE TREE VISUALIZER WIDGET (THE WOW FACTOR) */}
      <section className="modern-glass-card p-8 rounded-3xl space-y-6 max-w-4xl mx-auto border border-slate-200/80 shadow-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Interactive Merkle Proof Architecture</h2>
            <p className="text-slate-500 text-xs">Click a credential leaf below to trace its cryptographic path to the on-chain root.</p>
          </div>
          <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            Live Interactive Model
          </span>
        </div>

        {/* TREE DIAGRAM */}
        <div className="flex flex-col items-center gap-6 py-4">
          {/* ROOT */}
          <div className="bg-gradient-to-r from-indigo-600 to-sky-600 text-white px-6 py-3 rounded-2xl shadow-lg shadow-indigo-500/20 text-center font-mono text-xs">
            <p className="text-[10px] font-sans uppercase tracking-wider text-indigo-200 font-bold">On-Chain Merkle Root</p>
            <p className="font-bold text-sm">0x9a4e...71b2</p>
          </div>

          <div className="w-0.5 h-6 bg-slate-300"></div>

          {/* PARENT NODES */}
          <div className="flex gap-12 sm:gap-24">
            <div className="bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl text-center font-mono text-[11px] text-slate-700 shadow-sm">
              <p className="text-[9px] font-sans uppercase text-slate-400 font-bold">Parent Hash AB</p>
              0x1f8c...33a1
            </div>
            <div className="bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl text-center font-mono text-[11px] text-slate-700 shadow-sm">
              <p className="text-[9px] font-sans uppercase text-slate-400 font-bold">Parent Hash CD</p>
              0x5e2b...88f4
            </div>
          </div>

          <div className="w-full max-w-md flex justify-between px-12">
            <div className="w-0.5 h-6 bg-slate-300"></div>
            <div className="w-0.5 h-6 bg-slate-300"></div>
          </div>

          {/* LEAF NODES (CLICKABLE) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            {sampleLeaves.map((leaf, i) => (
              <button
                key={i}
                onClick={() => setSelectedLeaf(i)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  selectedLeaf === i
                    ? "bg-indigo-50/80 border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-900">{leaf.name}</span>
                  {selectedLeaf === i && <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full">Selected</span>}
                </div>
                <p className="text-[11px] text-slate-500">{leaf.degree}</p>
                <p className="text-[10px] font-mono text-indigo-600 mt-2 font-medium">{leaf.hash}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* METRICS GRID */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "On-Chain Cost", value: "32 Bytes", sub: "Single root per batch" },
          { label: "Multi-Sig Board", value: "2 of 3", sub: "Decentralized consensus" },
          { label: "On-Chain PII", value: "0 Bits", sub: "Strict student privacy" },
          { label: "Verification Latency", value: "< 3 Sec", sub: "Direct smart contract query" },
        ].map((item, i) => (
          <div key={i} className="modern-glass-card p-5 rounded-2xl space-y-1">
            <p className="text-2xl font-extrabold text-slate-900 font-mono">{item.value}</p>
            <p className="text-xs font-bold text-indigo-600">{item.label}</p>
            <p className="text-[11px] text-slate-500">{item.sub}</p>
          </div>
        ))}
      </section>

      {/* FEATURE HIGHLIGHT CARDS */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight text-center">Core Protocol Specifications</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="modern-glass-card modern-glass-card-hover p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
              01
            </div>
            <h3 className="font-bold text-slate-900 text-base">Merkle Tree Batching</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              Credential metadata is hashed off-chain using SHA-256 and structured into a binary Merkle Tree. Only the single root is committed on-chain, preserving gas efficiency.
            </p>
          </div>

          <div className="modern-glass-card modern-glass-card-hover p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
              02
            </div>
            <h3 className="font-bold text-slate-900 text-base">Multi-Sig Onboarding</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              Institutional issuers must be approved through a 2 of 3 multi-signature vote on GovernanceBoard.sol before gaining authorization to register credential batches.
            </p>
          </div>

          <div className="modern-glass-card modern-glass-card-hover p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
              03
            </div>
            <h3 className="font-bold text-slate-900 text-base">Public QR Verification</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              Scanning a certificate QR code reconstructs the leaf hash and calls the view function verify() on-chain using supplied Merkle Proof sibling nodes. Zero wallet required.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}