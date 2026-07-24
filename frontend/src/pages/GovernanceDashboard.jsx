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

  // Approval Modal State
  const [approvalTarget, setApprovalTarget] = useState(null);

  // 1. Fetch Registered Board Members & Proposals
  useEffect(() => {
    const fetchGovernanceData = async () => {
      setIsLoadingProposals(true);
      try {
        const governanceBoardRead = getFreshContract("governanceBoard", false);
        if (!governanceBoardRead) return;

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
    return <div className="text-center text-slate-500 py-20 text-sm font-medium">Verifying governance credentials...</div>;

  if (!role.isGovernanceMember) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-4 bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-slate-600 text-sm">
          Your connected account ({formatAddress(address)}) is not a registered Governance Board member.
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
        message: "Institution authorized successfully.",
        type: "success",
      });
      setApprovalTarget(null);
    } catch (err) {
      setToast({
        message: parseError(err) || "Failed to approve proposal.",
        type: "error",
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-6 font-sans">
      <TransactionOverlay status={status} error={error} onClose={reset} />
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "info" })}
      />

      {/* DASHBOARD HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100">
            System Administration
          </span>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mt-2">
            Governance Dashboard
          </h1>
        </div>
        <span className="text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          Signed in as: <span className="font-mono text-slate-800">{formatAddress(address)}</span>
        </span>
      </div>

      {/* METRICS BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <p className="text-sm font-medium text-slate-500">Pending Approvals</p>
          <p className="text-3xl font-bold text-slate-900">{proposals.length}</p>
          <p className="text-xs text-slate-400">Institutions awaiting review</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <p className="text-sm font-medium text-slate-500">Active Institutions</p>
          <p className="text-3xl font-bold text-indigo-600">{activeIssuers.length}</p>
          <p className="text-xs text-slate-400">Authorized to issue credentials</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <p className="text-sm font-medium text-slate-500">Approval Requirement</p>
          <p className="text-3xl font-bold text-emerald-600">2 of 3</p>
          <p className="text-xs text-slate-400">Votes needed to authorize</p>
        </div>
      </div>

      {/* REGISTERED BOARD MEMBERS PANEL */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-slate-800">Authorized Board Members</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {boardMembersList.map((mem, idx) => {
            const isYou = mem.toLowerCase() === address.toLowerCase();
            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                  isYou
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}
              >
                <span className="font-medium">Member {idx + 1}</span>
                <span className="font-mono text-xs">{formatAddress(mem)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex gap-6 border-b border-slate-200">
        {[
          { id: "pending", label: "Pending Approvals" },
          { id: "submit", label: "Add Institution" },
          { id: "active", label: "Active Registry" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBMIT PROPOSAL TAB */}
      {activeTab === "submit" && (
        <div className="bg-white p-8 rounded-xl space-y-6 border border-slate-200 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">Add New Institution</h3>
            <p className="text-slate-500 text-sm">
              Submit a proposal to authorize a new institution to issue credentials.
            </p>
          </div>

          <form onSubmit={handleSubmitProposal} className="space-y-6">
            <div className="space-y-1.5">
              <label htmlFor="instAddr" className="block text-sm font-medium text-slate-700">
                Institution Account Address
              </label>
              <input
                id="instAddr"
                type="text"
                value={institutionAddress}
                onChange={(e) => setInstitutionAddress(e.target.value)}
                placeholder="0x..."
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Authorization Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label
                  className={`p-4 rounded-lg border cursor-pointer flex flex-col justify-between transition-colors ${
                    selectedTier === 1
                      ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500"
                      : "bg-white border-slate-300 hover:border-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={1}
                    checked={selectedTier === 1}
                    onChange={() => setSelectedTier(1)}
                    className="sr-only"
                  />
                  <span className="text-sm font-semibold text-slate-900">Academic Degree Issuer</span>
                  <span className="text-xs text-slate-500 mt-2">
                    Authorized for permanent academic degrees (e.g., BSc, MSc, PhD).
                  </span>
                </label>

                <label
                  className={`p-4 rounded-lg border cursor-pointer flex flex-col justify-between transition-colors ${
                    selectedTier === 2
                      ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500"
                      : "bg-white border-slate-300 hover:border-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={2}
                    checked={selectedTier === 2}
                    onChange={() => setSelectedTier(2)}
                    className="sr-only"
                  />
                  <span className="text-sm font-semibold text-slate-900">Professional Certification</span>
                  <span className="text-xs text-slate-500 mt-2">
                    Authorized for time-bound professional credentials and certificates.
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={status === "pending"}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
            >
              {status === "pending" ? "Submitting Proposal..." : "Submit for Approval"}
            </button>
          </form>
        </div>
      )}

      {/* PENDING PROPOSALS TAB */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          {isLoadingProposals ? (
            <p className="text-slate-500 text-center py-12 text-sm">Loading pending proposals...</p>
          ) : proposals.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <h3 className="text-sm font-semibold text-slate-800">No Pending Approvals</h3>
              <p className="text-slate-500 text-sm mt-1">There are no institutions awaiting authorization.</p>
            </div>
          ) : (
            proposals.map((p) => {
              const isSubmitter = p.proposedBy.toLowerCase() === address.toLowerCase();

              return (
                <div
                  key={p.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        Request #{p.id}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          p.tier === 1
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {p.tier === 1 ? "Academic" : "Professional"}
                      </span>
                    </div>

                    <p className="text-sm text-slate-900">
                      Institution: <span className="font-mono font-medium">{formatAddress(p.institution)}</span>
                    </p>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Requested by: {formatAddress(p.proposedBy)}</span>
                      <span>•</span>
                      <span className="font-medium text-slate-700">Approvals: {p.approvalCount} / 2</span>
                    </div>
                  </div>

                  {isSubmitter ? (
                    <span className="text-xs font-medium bg-amber-50 text-amber-700 px-4 py-2 rounded-lg border border-amber-200 whitespace-nowrap">
                      Awaiting other votes
                    </span>
                  ) : (
                    <button
                      onClick={() => setApprovalTarget(p)}
                      disabled={status === "pending"}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-colors shadow-sm whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
                    >
                      Review & Approve
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoadingActive ? (
            <p className="text-slate-500 text-center py-12 text-sm">Loading active institutions...</p>
          ) : activeIssuers.length === 0 ? (
            <div className="text-center py-12 space-y-1">
              <h3 className="text-sm font-semibold text-slate-800">Registry is Empty</h3>
              <p className="text-slate-500 text-sm">No institutions have been authorized yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <th className="p-4">Institution Address</th>
                    <th className="p-4">Authorization Type</th>
                    <th className="p-4 text-right">Registered (Block)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {activeIssuers.map((issuer, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-mono text-slate-900">{formatAddress(issuer.address)}</td>
                      <td className="p-4">
                        <span
                          className={`text-xs font-medium px-2.5 py-0.5 rounded ${
                            issuer.tier === 1
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {issuer.tier === 1 ? "Academic" : "Professional"}
                        </span>
                      </td>
                      <td className="p-4 text-right text-slate-500 font-mono text-xs">#{issuer.blockNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* APPROVAL CONFIRMATION MODAL */}
      {approvalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full space-y-6 shadow-xl">
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded border border-indigo-200">
                Confirmation Required
              </span>
              <h3 className="text-lg font-semibold text-slate-900">Authorize Institution</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                You are about to authorize this institution to issue academic credentials. This action is irreversible.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 text-sm">
               <div className="flex justify-between"><span className="text-slate-500">Request ID:</span><span className="font-medium text-slate-900">#{approvalTarget.id}</span></div>
               <div className="flex justify-between"><span className="text-slate-500">Institution:</span><span className="font-mono text-xs text-slate-900">{formatAddress(approvalTarget.institution)}</span></div>
               <div className="flex justify-between"><span className="text-slate-500">Type:</span><span className="font-medium text-slate-900">{approvalTarget.tier === 1 ? "Academic" : "Professional"}</span></div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setApprovalTarget(null)}
                className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm transition-colors border border-slate-300"
              >
                Cancel
              </button>

              <button
                onClick={() => handleApprove(approvalTarget.id)}
                disabled={status === "pending"}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors shadow-sm"
              >
                {status === "pending" ? "Authorizing..." : "Confirm Authorization"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}