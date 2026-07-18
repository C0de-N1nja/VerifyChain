import { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import { useContract } from "../hooks/useContract";
import { useTransaction } from "../hooks/useTransaction";
import TransactionOverlay from "../components/TransactionOverlay";
import Toast from "../components/Toast";
import { API_URL } from "../config/contracts";
import { formatAddress } from "../utils/formatAddress";
import { parseError } from "../utils/errorMessages";

export default function IssuerPortal() {
  const { address, role, signer } = useWallet();
  const { execute, status, error, reset } = useTransaction();
  const [toast, setToast] = useState({ message: "", type: "info" });
  const credentialRegistry = useContract("credentialRegistry", signer);

  const [activeTab, setActiveTab] = useState("issue");
  const [view, setView] = useState("form"); // 'form', 'review', 'success'
  
  // Form state
  const [studentName, setStudentName] = useState("");
  const [degreeTitle, setDegreeTitle] = useState("");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  // Batch state
  const [batchData, setBatchData] = useState(null);
  const [issueResults, setIssueResults] = useState(null);

  // History & Revocation state
  const [history, setHistory] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null); // { leafHash, merkleRoot, studentName }
  const [confirmText, setConfirmText] = useState("");

  // Fetch History & Credentials when tab changes
  useEffect(() => {
    if (activeTab === "history" || activeTab === "revocation") {
      fetchDashboardData();
    }
  }, [activeTab, status]);

  const fetchDashboardData = async () => {
    setIsLoadingHistory(true);
    try {
      const [histRes, credRes] = await Promise.all([
        fetch(`${API_URL}/api/issuer/history?issuerAddress=${address}`),
        fetch(`${API_URL}/api/issuer/credentials?issuerAddress=${address}`)
      ]);

      const histData = await histRes.json();
      const credData = await credRes.json();

      if (histData.batches) setHistory(histData.batches);
      if (credData.credentials) setCredentials(credData.credentials);
    } catch (err) {
      setToast({ message: "Failed to fetch history from backend.", type: "error" });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (role.isLoading) return <div className="text-center text-slate-400 mt-20">Checking issuer permissions...</div>;
  if (!role.isIssuer) {
    return (
      <div className="text-center text-slate-400 mt-20">
        <h2 className="text-2xl text-white font-bold mb-2">Access Denied</h2>
        <p>Your connected wallet is not an activated issuer.</p>
      </div>
    );
  }

  const handlePrepareBatch = async (e) => {
    e.preventDefault();
    setToast({ message: "Generating Merkle Root...", type: "info" });

    try {
      const issueTimestamp = Math.floor(new Date(issueDate).getTime() / 1000);
      let expiryTimestamp = 0;
      
      if (role.tier === 2 && expiryDate) {
        expiryTimestamp = Math.floor(new Date(expiryDate).getTime() / 1000);
      }

      const payload = {
        credentials: [{
          studentName,
          degreeTitle,
          issuerAddress: address,
          email: email || undefined, // Now included!
          expiryTimestamp
        }]
      };

      const response = await fetch(`${API_URL}/api/issuer/prepare-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Backend validation failed");

      setBatchData(data);
      setView("review");
      setToast({ message: "", type: "info" });
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    }
  };

  const handleConfirmRegister = async () => {
    if (!credentialRegistry || !batchData) return;

    try {
      const expiryTimestamp = batchData.credentials[0].credential.expiryTimestamp;
      
      await execute(() => credentialRegistry.registerBatch(batchData.merkleRoot, expiryTimestamp));
      
      setToast({ message: "Transaction confirmed. Generating PDFs...", type: "info" });

      const response = await fetch(`${API_URL}/api/issuer/confirm-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merkleRoot: batchData.merkleRoot,
          credentials: batchData.credentials
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to confirm batch on backend");

      setIssueResults(data);
      setView("success");
      setToast({ message: "Credential successfully issued!", type: "success" });
    } catch (err) {
      setToast({ message: parseError(err) || "Failed to register on blockchain.", type: "error" });
    }
  };

  const handleRevoke = async () => {
    if (!credentialRegistry || !revokeTarget || confirmText !== "CONFIRM") return;
    try {
      await execute(() => credentialRegistry.revokeCredential(revokeTarget.leafHash, revokeTarget.merkleRoot));
      
      await fetch(`${API_URL}/api/issuer/confirm-revocation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leafHash: revokeTarget.leafHash, merkleRoot: revokeTarget.merkleRoot })
      });

      setToast({ message: "Credential revoked successfully.", type: "success" });
      setRevokeTarget(null);
      setConfirmText("");
      fetchDashboardData(); // Refresh list
    } catch (err) {
      setToast({ message: parseError(err) || "Failed to revoke.", type: "error" });
    }
  };

  const resetForm = () => {
    setStudentName(""); setDegreeTitle(""); setEmail(""); setInstitution(""); setIssueDate(""); setExpiryDate("");
    setBatchData(null); setIssueResults(null); setView("form"); reset();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <TransactionOverlay status={status} error={error} onClose={reset} />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "info" })} />

      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold">Issuer Portal</h1>
        <span className={`text-sm font-mono px-3 py-1 rounded ${role.tier === 1 ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
          Tier {role.tier} Issuer
        </span>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-800">
        {["issue", "history", "revocation"].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${activeTab === tab ? "text-teal-400 border-b-2 border-teal-400" : "text-slate-400 hover:text-white"}`}>
            {tab === "issue" ? "Issue Credentials" : tab === "history" ? "Batch History" : "Revocation"}
          </button>
        ))}
      </div>

      {/* ISSUE TAB */}
      {activeTab === "issue" && (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
          {view === "form" && (
            <form onSubmit={handlePrepareBatch} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Student Name</label>
                  <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Student Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-teal-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Degree Title</label>
                <input type="text" value={degreeTitle} onChange={(e) => setDegreeTitle(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Institution</label>
                <input type="text" value={institution} onChange={(e) => setInstitution(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-teal-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Issue Date</label>
                  <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-teal-500" />
                </div>
                {role.tier === 2 && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Expiry Date</label>
                    <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-teal-500" />
                  </div>
                )}
              </div>
              <button type="submit" className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold py-3 px-6 rounded-lg w-full transition-colors">Review & Register</button>
            </form>
          )}

          {view === "review" && batchData && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Review Batch</h3>
                <p className="text-slate-400 text-sm">Please review the details before sending to the blockchain.</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg space-y-2">
                <div className="flex justify-between"><span className="text-slate-400">Student:</span><span className="text-white">{studentName}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Degree:</span><span className="text-white">{degreeTitle}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Merkle Root:</span><span className="text-teal-400 font-mono text-xs">{formatAddress(batchData.merkleRoot)}</span></div>
              </div>
              <button onClick={handleConfirmRegister} disabled={status === "pending"} className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-slate-900 font-bold py-3 px-6 rounded-lg w-full transition-colors">
                {status === "pending" ? "Confirm in MetaMask..." : "Confirm & Register on zkSync"}
              </button>
            </div>
          )}

          {view === "success" && issueResults && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-xl font-bold text-white">Issuance Complete</h3>
              <p className="text-slate-400">The credential has been anchored on zkSync.</p>
              
              <div className="bg-slate-800 p-4 rounded-lg text-left mt-6">
                <p className="text-sm text-slate-400">Delivery Status:</p>
                {issueResults.issued.map((item, i) => (
                  <div key={i} className="flex justify-between mt-2 text-sm">
                    <span className="text-white">{item.credential.studentName}</span>
                    <span className={item.emailed ? "text-teal-400" : "text-amber-400"}>
                      {item.emailed ? "✅ Email Sent" : "⚠️ Email Failed"}
                    </span>
                  </div>
                ))}
              </div>

              {issueResults.zipDownloadUrl && (
                <a href={`${API_URL}${issueResults.zipDownloadUrl}`} className="text-indigo-400 hover:underline block mt-4">Download Failed PDFs (ZIP)</a>
              )}

              <button onClick={resetForm} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg w-full mt-6">Issue Another Credential</button>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {isLoadingHistory ? (
            <p className="text-slate-400 text-center">Loading batch history...</p>
          ) : history.length === 0 ? (
            <p className="text-slate-500 text-center py-12">You haven't issued any credentials yet.</p>
          ) : (
            history.map((batch, i) => (
              <div key={i} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-sm text-teal-400">{formatAddress(batch.merkleRoot)}</span>
                  <span className="text-xs text-slate-500">Block #{batch.blockNumber}</span>
                </div>
                <div className="text-sm text-slate-400">
                  Expiry: {batch.expiryTimestamp === "0" ? "Permanent" : new Date(Number(batch.expiryTimestamp) * 1000).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* REVOCATION TAB */}
      {activeTab === "revocation" && (
        <div className="space-y-4">
          {isLoadingHistory ? (
            <p className="text-slate-400 text-center">Loading credentials...</p>
          ) : credentials.length === 0 ? (
            <p className="text-slate-500 text-center py-12">No active credentials to revoke.</p>
          ) : (
            credentials.map((cred, i) => (
              <div key={i} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <p className="text-white font-medium">{cred.studentName}</p>
                  <p className="text-xs text-slate-500">{cred.degreeTitle}</p>
                </div>
                {cred.revoked ? (
                  <span className="text-xs font-mono bg-red-500/10 text-red-400 px-3 py-1 rounded">Revoked</span>
                ) : (
                  <button onClick={() => setRevokeTarget(cred)} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold py-2 px-4 rounded-lg text-sm">
                    Revoke
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* UC-20 REVOCATION MODAL */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-xl p-8 max-w-md w-full">
            <h3 className="text-xl font-bold text-red-400 mb-4">Confirm Revocation</h3>
            <p className="text-slate-300 mb-4">
              You are about to permanently revoke the credential for <span className="font-bold text-white">{revokeTarget.studentName}</span>.
            </p>
            <p className="text-slate-400 text-sm mb-6">
              This action is permanent and cannot be undone. To confirm, type <span className="font-mono bg-slate-800 px-2 py-1 rounded text-red-400">CONFIRM</span> below:
            </p>
            <input 
              type="text" 
              value={confirmText} 
              onChange={(e) => setConfirmText(e.target.value)} 
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 mb-6 focus:outline-none focus:border-red-500 text-white" 
              placeholder="CONFIRM"
            />
            <div className="flex gap-4">
              <button onClick={() => { setRevokeTarget(null); setConfirmText(""); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg">Cancel</button>
              <button onClick={handleRevoke} disabled={confirmText !== "CONFIRM" || status === "pending"} className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg">
                {status === "pending" ? "Processing..." : "Revoke Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}