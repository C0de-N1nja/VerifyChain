import { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import { useContract } from "../hooks/useContract";
import { useTransaction } from "../hooks/useTransaction";
import TransactionOverlay from "../components/TransactionOverlay";
import Toast from "../components/Toast";
import { formatAddress } from "../utils/formatAddress";
import { parseError } from "../utils/errorMessages";

export default function GovernanceDashboard() {
  const { address, role, signer, provider } = useWallet();
  const { execute, status, error, reset } = useTransaction();
  const [toast, setToast] = useState({ message: "", type: "info" });
  
  const governanceBoard = useContract("governanceBoard", signer);
  const governanceBoardRead = useContract("governanceBoard", provider);

  const [activeTab, setActiveTab] = useState("pending");
  const [proposals, setProposals] = useState([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(true);

  // Submit Proposal State
  const [institutionAddress, setInstitutionAddress] = useState("");
  const [selectedTier, setSelectedTier] = useState(1);

  // 1. Fetch Pending Proposals
  useEffect(() => {
    const fetchProposals = async () => {
      if (!governanceBoardRead) return;
      setIsLoadingProposals(true);
      try {
        const tempProposals = [];
        const zeroAddress = "0x0000000000000000000000000000000000000000";
        
        for (let i = 1; i <= 10; i++) {
          try {
            const p = await governanceBoardRead.getProposal(i);
            
            // Safely convert BigInts to Numbers
            const formattedP = {
              id: i,
              institution: p.institution,
              tier: Number(p.tier),
              approvalCount: Number(p.approvalCount),
              status: Number(p.status),
              proposedBy: p.proposedBy
            };

            // Only show if it exists and is Pending (status 0)
            if (formattedP.institution.toLowerCase() !== zeroAddress && formattedP.status === 0) {
              tempProposals.push(formattedP);
            }
          } catch (err) {
            break; // Stop loop if ID doesn't exist
          }
        }
        setProposals(tempProposals);
      } catch (err) {
        console.error("Error fetching proposals:", err);
      } finally {
        setIsLoadingProposals(false);
      }
    };

    fetchProposals();
  }, [governanceBoardRead, status]);

  // 2. Role Guard (Must come after hooks)
  if (role.isLoading) return <div className="text-center text-slate-400 mt-20">Checking governance permissions...</div>;
  
  if (!role.isGovernanceMember) {
    return (
      <div className="text-center text-slate-400 mt-20">
        <h2 className="text-2xl text-white font-bold mb-2">Access Denied</h2>
        <p>Your connected wallet is not a Governance Board member.</p>
      </div>
    );
  }

  const handleSubmitProposal = async (e) => {
    e.preventDefault();
    if (!governanceBoard) return;
    
    try {
      await execute(() => governanceBoard.submitProposal(institutionAddress, selectedTier));
      setToast({ message: "Proposal submitted successfully!", type: "success" });
      setInstitutionAddress("");
    } catch (err) {
      // This will now show the exact smart contract error
      setToast({ message: parseError(err) || "Failed to submit proposal.", type: "error" });
    }
  };

  const handleApprove = async (proposalId) => {
    if (!governanceBoard) return;
    try {
      await execute(() => governanceBoard.approveProposal(proposalId));
      setToast({ message: "Proposal approved! Issuer activated.", type: "success" });
    } catch (err) {
      // This will now show the exact smart contract error
      setToast({ message: parseError(err) || "Failed to approve proposal.", type: "error" });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <TransactionOverlay status={status} error={error} onClose={reset} />
      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ message: "", type: "info" })} 
      />

      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold">Governance Dashboard</h1>
        <span className="text-sm font-mono px-3 py-1 rounded bg-indigo-500/10 text-indigo-400">
          Board Member
        </span>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-800">
        {["pending", "submit", "active"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? "text-teal-400 border-b-2 border-teal-400" : "text-slate-400 hover:text-white"
            }`}
          >
            {tab === "pending" ? "Pending Proposals" : tab === "submit" ? "Submit Proposal" : "Active Issuers"}
          </button>
        ))}
      </div>

      {activeTab === "submit" && (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
          <form onSubmit={handleSubmitProposal} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Institution Wallet Address</label>
              <input 
                type="text" 
                value={institutionAddress} 
                onChange={(e) => setInstitutionAddress(e.target.value)} 
                placeholder="0x..." 
                required 
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Issuer Tier</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tier" value={1} checked={selectedTier === 1} onChange={() => setSelectedTier(1)} className="accent-teal-500" />
                  <span className="text-slate-300">Tier 1 (Academic)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tier" value={2} checked={selectedTier === 2} onChange={() => setSelectedTier(2)} className="accent-teal-500" />
                  <span className="text-slate-300">Tier 2 (Professional)</span>
                </label>
              </div>
            </div>
            <button type="submit" disabled={status === "pending"} className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-slate-900 font-bold py-3 px-6 rounded-lg w-full transition-colors">
              {status === "pending" ? "Processing..." : "Submit Proposal"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "pending" && (
        <div className="space-y-4">
          {isLoadingProposals ? (
            <p className="text-slate-400 text-center">Loading proposals...</p>
          ) : proposals.length === 0 ? (
            <p className="text-slate-500 text-center py-12">No proposals waiting for approval right now.</p>
          ) : (
            proposals.map((p) => (
              <div key={p.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <p className="font-mono text-sm text-white">{formatAddress(p.institution)}</p>
                  <p className="text-xs text-slate-400 mt-1">Tier {p.tier} • Approvals: {p.approvalCount} / 2</p>
                </div>
                <button 
                  onClick={() => handleApprove(p.id)} 
                  disabled={status === "pending"}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg text-sm"
                >
                  Approve
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "active" && (
        <div className="text-center text-slate-500 py-12">
          Active issuers list will appear here.
        </div>
      )}
    </div>
  );
}