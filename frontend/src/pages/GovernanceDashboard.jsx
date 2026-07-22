import { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import { useTransaction } from "../hooks/useTransaction";
import { getFreshContract } from "../hooks/useContract";
import TransactionOverlay from "../components/TransactionOverlay";
import Toast from "../components/Toast";
import { formatAddress } from "../utils/formatAddress";
import { parseError } from "../utils/errorMessages";

export default function GovernanceDashboard() {
  const { address, role } = useWallet();
  const { execute, status, error, reset } = useTransaction();
  const [toast, setToast] = useState({ message: "", type: "info" });

  const [activeTab, setActiveTab] = useState("pending");
  const [proposals, setProposals] = useState([]);
  const [boardMembersList, setBoardMembersList] = useState([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(true);

  // Active Issuers State
  const [activeIssuers, setActiveIssuers] = useState([]);
  const [isLoadingActive, setIsLoadingActive] = useState(false);

  // Submit Proposal State
  const [institutionAddress, setInstitutionAddress] = useState("");
  const [selectedTier, setSelectedTier] = useState(1);

  // 1. Fetch Registered Board Members & Proposals
  useEffect(() => {
    const fetchGovernanceData = async () => {
      setIsLoadingProposals(true);
      try {
        const governanceBoardRead = getFreshContract("governanceBoard", false);
        if (!governanceBoardRead) return;

        // Fetch official board member addresses
        const members = [];
        for (let m = 0; m < 3; m++) {
          try {
            const memAddr = await governanceBoardRead.boardMembers(m);
            members.push(memAddr);
          } catch (e) {
            break;
          }
        }
        setBoardMembersList(members);

        // Fetch pending proposals
        const tempProposals = [];
        const zeroAddress = "0x0000000000000000000000000000000000000000";

        for (let i = 0; i < 15; i++) {
          try {
            const p = await governanceBoardRead.getProposal(i);
            const formattedP = {
              id: i,
              institution: p.institution,
              tier: Number(p.tier),
              approvalCount: Number(p.approvalCount),
              status: Number(p.status),
              proposedBy: p.proposedBy,
            };

            if (
              formattedP.institution.toLowerCase() !== zeroAddress &&
              formattedP.status === 0
            ) {
              tempProposals.push(formattedP);
            }
          } catch (err) {
            break;
          }
        }
        setProposals(tempProposals);
      } catch (err) {
        console.error("Error fetching governance data:", err);
      } finally {
        setIsLoadingProposals(false);
      }
    };

    fetchGovernanceData();
  }, [status]);

  // 2. Fetch Active Issuers
  useEffect(() => {
    const fetchActiveIssuers = async () => {
      setIsLoadingActive(true);
      try {
        const governanceBoardRead = getFreshContract("governanceBoard", false);
        if (!governanceBoardRead) return;

        const filter = governanceBoardRead.filters.IssuerActivated();
        const events = await governanceBoardRead.queryFilter(filter);

        const issuers = events.map((event) => ({
          address: event.args.institution,
          tier: Number(event.args.tier),
          blockNumber: event.blockNumber,
        }));

        setActiveIssuers(issuers);
      } catch (err) {
        console.error("Error fetching active issuers:", err);
      } finally {
        setIsLoadingActive(false);
      }
    };

    if (activeTab === "active") {
      fetchActiveIssuers();
    }
  }, [activeTab, status]);

  if (role.isLoading)
    return <div className="text-center text-slate-500 py-20 text-xs font-medium">Verifying governance credentials...</div>;

  if (!role.isGovernanceMember) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-4 modern-glass-card p-8 rounded-3xl border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-slate-600 text-xs">
          Your connected wallet address ({formatAddress(address)}) is not a registered Governance Board member.
        </p>
      </div>
    );
  }

  const handleSubmitProposal = async (e) => {
    e.preventDefault();
    try {
      const contract = await getFreshContract("governanceBoard", true);
      await execute(() => contract.submitProposal(institutionAddress, selectedTier));
      setToast({ message: "Proposal submitted successfully.", type: "success" });
      setInstitutionAddress("");
    } catch (err) {
      setToast({
        message: parseError(err) || "Failed to submit proposal.",
        type: "error",
      });
    }
  };

  const handleApprove = async (proposalId) => {
    try {
      const contract = await getFreshContract("governanceBoard", true);
      await execute(() => contract.approveProposal(proposalId));
      setToast({
        message: "Proposal approved. Issuer activated on-chain.",
        type: "success",
      });
    } catch (err) {
      setToast({
        message: parseError(err) || "Failed to approve proposal.",
        type: "error",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 font-sans">
      <TransactionOverlay status={status} error={error} onClose={reset} />
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "info" })}
      />

      {/* DASHBOARD HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100">
            Institutional Control Surface
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Governance Board Dashboard
          </h1>
        </div>
        <span className="text-xs font-mono font-semibold bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-sm">
          Active Account: {formatAddress(address)}
        </span>
      </div>

      {/* REGISTERED BOARD MEMBERS PANEL */}
      <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl space-y-2">
        <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
          On-Chain Registered Board Member Wallets:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
          {boardMembersList.map((mem, idx) => {
            const isYou = mem.toLowerCase() === address.toLowerCase();
            return (
              <div
                key={idx}
                className={`p-2 rounded-xl border text-center font-bold ${
                  isYou
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200"
                }`}
              >
                Member {idx + 1}: {formatAddress(mem)} {isYou && "(Selected)"}
              </div>
            );
          })}
        </div>
      </div>

      {/* METRICS TOP BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="modern-glass-card p-5 rounded-2xl border border-slate-200/80 space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Approvals</p>
          <p className="text-2xl font-extrabold font-mono text-slate-900">{proposals.length}</p>
          <p className="text-[11px] text-slate-400">Proposals waiting for quorum</p>
        </div>

        <div className="modern-glass-card p-5 rounded-2xl border border-slate-200/80 space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Issuers</p>
          <p className="text-2xl font-extrabold font-mono text-indigo-600">{activeIssuers.length}</p>
          <p className="text-[11px] text-slate-400">Whitelisted institutions on-chain</p>
        </div>

        <div className="modern-glass-card p-5 rounded-2xl border border-slate-200/80 space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Multi-Sig Threshold</p>
          <p className="text-2xl font-extrabold font-mono text-emerald-600">2 of 3</p>
          <p className="text-[11px] text-slate-400">Quorum vote requirement</p>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex gap-2 border-b border-slate-200 pb-1">
        {[
          { id: "pending", label: "Pending Proposals" },
          { id: "submit", label: "Submit New Proposal" },
          { id: "active", label: "Active Issuers Registry" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === tab.id
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBMIT PROPOSAL TAB */}
      {activeTab === "submit" && (
        <div className="modern-glass-card p-8 rounded-3xl space-y-6 border border-slate-200">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">Onboard New Institution</h3>
            <p className="text-slate-500 text-xs">
              Submit a governance proposal to whitelist an institution wallet address on-chain.
            </p>
          </div>

          <form onSubmit={handleSubmitProposal} className="space-y-5">
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase text-slate-700">
                Institution Wallet Address
              </label>
              <input
                type="text"
                value={institutionAddress}
                onChange={(e) => setInstitutionAddress(e.target.value)}
                placeholder="0x..."
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-slate-700">
                Authorized Issuer Tier
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label
                  className={`p-4 rounded-2xl border cursor-pointer flex flex-col justify-between transition-all ${
                    selectedTier === 1
                      ? "bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={1}
                    checked={selectedTier === 1}
                    onChange={() => setSelectedTier(1)}
                    className="hidden"
                  />
                  <span className="text-xs font-bold text-slate-900">Tier 1: Academic Degree Issuer</span>
                  <span className="text-[11px] text-slate-500 mt-2">
                    Authorized for permanent academic degrees with zero expiration.
                  </span>
                </label>

                <label
                  className={`p-4 rounded-2xl border cursor-pointer flex flex-col justify-between transition-all ${
                    selectedTier === 2
                      ? "bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={2}
                    checked={selectedTier === 2}
                    onChange={() => setSelectedTier(2)}
                    className="hidden"
                  />
                  <span className="text-xs font-bold text-slate-900">Tier 2: Professional Certification</span>
                  <span className="text-[11px] text-slate-500 mt-2">
                    Authorized for professional credentials requiring mandatory expiration dates.
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={status === "pending"}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md shadow-indigo-500/20"
            >
              {status === "pending" ? "Executing Transaction..." : "Submit Onboarding Proposal"}
            </button>
          </form>
        </div>
      )}

      {/* PENDING PROPOSALS TAB */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          {isLoadingProposals ? (
            <p className="text-slate-500 text-center py-12 text-xs">Loading active proposals...</p>
          ) : proposals.length === 0 ? (
            <div className="text-center py-16 modern-glass-card rounded-3xl border border-slate-200 space-y-2">
              <h3 className="text-sm font-bold text-slate-800">No Pending Proposals</h3>
              <p className="text-slate-500 text-xs">There are no onboarding proposals currently waiting for multi-sig approval.</p>
            </div>
          ) : (
            proposals.map((p) => {
              const isSubmitter = p.proposedBy.toLowerCase() === address.toLowerCase();

              return (
                <div
                  key={p.id}
                  className="modern-glass-card p-6 rounded-2xl border border-slate-200 space-y-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        Proposal #{p.id}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          p.tier === 1
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        Tier {p.tier} {p.tier === 1 ? "Academic" : "Professional"}
                      </span>
                    </div>

                    <p className="font-mono text-xs font-bold text-slate-900">
                      Institution: {formatAddress(p.institution)}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Proposed by: {formatAddress(p.proposedBy)}</span>
                      <span>•</span>
                      <span className="font-semibold text-indigo-600">Current Votes: {p.approvalCount} / 2</span>
                    </div>
                  </div>

                  {isSubmitter ? (
                    <span className="text-xs font-mono font-semibold bg-amber-50 text-amber-700 px-4 py-2 rounded-xl border border-amber-200">
                      Voted (Submitted by You)
                    </span>
                  ) : (
                    <button
                      onClick={() => handleApprove(p.id)}
                      disabled={status === "pending"}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all shadow-md shadow-indigo-500/20 whitespace-nowrap"
                    >
                      Approve Proposal
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ACTIVE ISSUERS REGISTRY TAB */}
      {activeTab === "active" && (
        <div className="modern-glass-card rounded-2xl border border-slate-200 overflow-hidden">
          {isLoadingActive ? (
            <p className="text-slate-500 text-center py-12 text-xs">Loading active issuers...</p>
          ) : activeIssuers.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <h3 className="text-sm font-bold text-slate-800">Registry Empty</h3>
              <p className="text-slate-500 text-xs">No institutions have been activated on-chain yet.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-4">Institution Address</th>
                  <th className="p-4">Tier Authorization</th>
                  <th className="p-4 text-right">Block Number</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-mono">
                {activeIssuers.map((issuer, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-bold text-slate-900">{formatAddress(issuer.address)}</td>
                    <td className="p-4 font-sans">
                      <span
                        className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded ${
                          issuer.tier === 1
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        Tier {issuer.tier} {issuer.tier === 1 ? "Academic" : "Professional"}
                      </span>
                    </td>
                    <td className="p-4 text-right text-slate-500">#{issuer.blockNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}