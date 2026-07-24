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
    <div className="space-y-20 py-8 md:py-12">
      
      {/* HERO SECTION */}
      <section className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Official Academic Credential Registry
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
          The Global Standard for Academic Credential Integrity
        </h1>

        <p className="text-slate-600 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
          Instantly issue, manage, and verify academic credentials. Cryptographically secured against fraud, without exposing student data.
        </p>

        {/* SEARCH WIDGET */}
        <form onSubmit={handleSearch} className="max-w-xl mx-auto pt-4">
          <div className="bg-white p-2 rounded-xl flex items-center gap-2 border border-slate-300 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 transition-all shadow-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Credential ID or Verification Link"
              className="w-full bg-transparent px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              aria-label="Credential Verification Search"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
            >
              Verify
            </button>
          </div>
        </form>

        {/* QUICK NAVIGATION BUTTONS */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            to="/verify"
            className="bg-white hover:bg-slate-50 text-slate-800 font-medium px-5 py-2.5 rounded-lg text-sm border border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
          >
            Verify a Credential
          </Link>

          {address && role.isIssuer && (
            <Link
              to="/issuer"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
            >
              Issuer Portal
            </Link>
          )}

          {address && role.isGovernanceMember && (
            <Link
              to="/governance"
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
            >
              Governance Board
            </Link>
          )}
        </div>
      </section>

      {/* HOW IT WORKS (Replaces the prominent Merkle Visualizer) */}
      <section className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold flex items-center justify-center mx-auto text-sm">
              1
            </div>
            <h3 className="font-semibold text-slate-900 text-base">Institution Issues Degree</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Universities upload student data. The system instantly generates a secure, tamper-proof fingerprint of the credential.
            </p>
          </div>

          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold flex items-center justify-center mx-auto text-sm">
              2
            </div>
            <h3 className="font-semibold text-slate-900 text-base">Blockchain Registration</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              The credential fingerprint is permanently anchored to the blockchain, ensuring it can never be altered or deleted.
            </p>
          </div>

          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold flex items-center justify-center mx-auto text-sm">
              3
            </div>
            <h3 className="font-semibold text-slate-900 text-base">Instant Verification</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Employers validate a credential's authenticity in seconds via PDF upload, QR scan, or Credential ID.
            </p>
          </div>
        </div>
      </section>

      {/* METRICS GRID */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
        {[
          { label: "Cost Efficient", value: "Batched", sub: "Gas-optimized anchoring" },
          { label: "Governance Controlled", value: "2 of 3", sub: "Institutional consensus" },
          { label: "Student Privacy", value: "100%", sub: "No PII on blockchain" },
          { label: "Verification Speed", value: "< 3 Sec", sub: "Instant cryptographic check" },
        ].map((item, i) => (
          <div key={i} className="bg-white p-6 space-y-1">
            <p className="text-2xl font-bold text-slate-900">{item.value}</p>
            <p className="text-xs font-semibold text-indigo-600">{item.label}</p>
            <p className="text-xs text-slate-500">{item.sub}</p>
          </div>
        ))}
      </section>

      {/* FEATURE HIGHLIGHT CARDS */}
      <section className="space-y-6 max-w-5xl mx-auto">
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight text-center">Core Platform Benefits</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-800 font-semibold text-sm">
              01
            </div>
            <h3 className="font-semibold text-slate-900 text-base">Scalable Batch Issuance</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Thousands of credentials are securely processed off-chain, with only a single cryptographic anchor registered on-chain, ensuring maximum efficiency.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-800 font-semibold text-sm">
              02
            </div>
            <h3 className="font-semibold text-slate-900 text-base">Authorized Issuers Only</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Institutions must be approved through a decentralized governance board, ensuring only official registrars can issue credentials.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-800 font-semibold text-sm">
              03
            </div>
            <h3 className="font-semibold text-slate-900 text-base">Public & Trustless Verification</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Anyone can verify a credential's integrity instantly via QR code or PDF upload. No wallet, account, or technical knowledge required.
            </p>
          </div>
        </div>
      </section>

      {/* ADVANCED TECHNICAL ARCHITECTURE (For Examiners / Developers) */}
      <section className="max-w-4xl mx-auto">
        <details className="bg-slate-50 border border-slate-200 rounded-xl p-6 group">
          <summary className="font-semibold text-slate-700 cursor-pointer flex items-center justify-between text-sm">
            <span>Advanced Technical Architecture & Cryptographic Proofs</span>
            <span className="transition-transform group-open:rotate-180 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </summary>
          
          <div className="mt-6 space-y-6 border-t border-slate-200 pt-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Interactive Merkle Proof Architecture</h3>
              <p className="text-slate-500 text-xs mt-1">Click a credential leaf below to trace its cryptographic path to the on-chain root.</p>
            </div>

            {/* TREE DIAGRAM */}
            <div className="flex flex-col items-center gap-6 py-4">
              {/* ROOT */}
              <div className="bg-slate-900 text-white px-6 py-3 rounded-lg text-center text-xs shadow-sm">
                <p className="text-[11px] font-sans uppercase tracking-wider text-slate-400 font-semibold">On-Chain Merkle Root</p>
                <p className="font-mono text-sm mt-1">0x9a4e...71b2</p>
              </div>

              <div className="w-px h-6 bg-slate-300"></div>

              {/* PARENT NODES */}
              <div className="flex gap-12 sm:gap-24">
                <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-center font-mono text-xs text-slate-700 shadow-sm">
                  <p className="text-[11px] font-sans uppercase text-slate-400 font-semibold">Parent Hash AB</p>
                  <p className="mt-1">0x1f8c...33a1</p>
                </div>
                <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-center font-mono text-xs text-slate-700 shadow-sm">
                  <p className="text-[11px] font-sans uppercase text-slate-400 font-semibold">Parent Hash CD</p>
                  <p className="mt-1">0x5e2b...88f4</p>
                </div>
              </div>

              <div className="w-full max-w-md flex justify-between px-12">
                <div className="w-px h-6 bg-slate-300"></div>
                <div className="w-px h-6 bg-slate-300"></div>
              </div>

              {/* LEAF NODES (CLICKABLE) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                {sampleLeaves.map((leaf, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedLeaf(i)}
                    className={`p-4 rounded-lg border text-left transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                      selectedLeaf === i
                        ? "bg-indigo-50 border-indigo-500 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-slate-900">{leaf.name}</span>
                      {selectedLeaf === i && <span className="text-[11px] bg-indigo-600 text-white font-medium px-2 py-0.5 rounded">Active</span>}
                    </div>
                    <p className="text-xs text-slate-500">{leaf.degree}</p>
                    <p className="text-xs font-mono text-indigo-600 mt-2 font-medium">{leaf.hash}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </details>
      </section>

    </div>
  );
}