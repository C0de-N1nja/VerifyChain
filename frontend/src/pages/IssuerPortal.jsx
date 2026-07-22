import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useContract, getFreshContract } from "../hooks/useContract";
import { useTransaction } from "../hooks/useTransaction";
import TransactionOverlay from "../components/TransactionOverlay";
import Toast from "../components/Toast";
import { API_URL } from "../config/contracts";
import { formatAddress } from "../utils/formatAddress";
import { parseError } from "../utils/errorMessages";

export default function IssuerPortal() {
  const { address, role } = useWallet();
  const navigate = useNavigate();
  const { execute, status, error, reset } = useTransaction();
  const [toast, setToast] = useState({ message: "", type: "info" });

  const [activeTab, setActiveTab] = useState("issue");
  const [view, setView] = useState("form"); // form | review | success
  const [issuanceMode, setIssuanceMode] = useState("single"); // single | bulk

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
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [batchStudents, setBatchStudents] = useState([]);
  const [isLoadingBatchStudents, setIsLoadingBatchStudents] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState(null);
  const [confirmText, setConfirmText] = useState("");

  // CSV Upload state
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

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
        fetch(`${API_URL}/api/issuer/credentials?issuerAddress=${address}`),
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

  const toggleExpandBatch = async (merkleRoot) => {
    if (expandedBatch === merkleRoot) {
      setExpandedBatch(null);
      setBatchStudents([]);
      return;
    }

    setExpandedBatch(merkleRoot);
    setIsLoadingBatchStudents(true);
    try {
      const res = await fetch(`${API_URL}/api/issuer/credentials?merkleRoot=${merkleRoot}`);
      const data = await res.json();
      if (data.credentials) setBatchStudents(data.credentials);
    } catch (err) {
      console.error("Error fetching batch credentials:", err);
    } finally {
      setIsLoadingBatchStudents(false);
    }
  };

  if (role.isLoading)
    return <div className="text-center text-slate-500 py-20 text-xs font-medium">Checking issuer authorization...</div>;

  if (!role.isIssuer) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-4 modern-glass-card p-8 rounded-3xl border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-slate-600 text-xs">
          Your connected wallet address is not an activated institutional issuer.
        </p>
      </div>
    );
  }

  // Handle Single Credential Preparation
  const handlePrepareBatch = async (e) => {
    e.preventDefault();
    setToast({ message: "Generating Merkle Tree...", type: "info" });

    try {
      const issueTimestamp = Math.floor(new Date(issueDate).getTime() / 1000);
      let expiryTimestamp = 0;

      if (role.tier === 2 && expiryDate) {
        expiryTimestamp = Math.floor(new Date(expiryDate).getTime() / 1000);
      }

      const payload = {
        credentials: [
          {
            studentName,
            degreeTitle,
            issuerAddress: address,
            email: email || undefined,
            expiryTimestamp,
          },
        ],
      };

      const response = await fetch(`${API_URL}/api/issuer/prepare-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Backend validation failed.");

      setBatchData(data);
      setView("review");
      setToast({ message: "", type: "info" });
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    }
  };

  // Handle Bulk CSV Preparation
  const handleCsvUpload = async (file) => {
    if (!file) return;
    setToast({ message: "Parsing CSV file...", type: "info" });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/api/issuer/prepare-batch-csv`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data.details ? data.details.join(" | ") : data.error;
        throw new Error(errorMsg || "CSV processing failed.");
      }

      setBatchData(data);
      setView("review");
      setToast({ message: "", type: "info" });
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) handleCsvUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleCsvUpload(file);
  };

  // Handle Blockchain Registration & PDF Delivery
  const handleConfirmRegister = async () => {
    if (!batchData) return;

    try {
      const expiryTimestamp = batchData.credentials[0]?.credential?.expiryTimestamp || 0;
      const contract = await getFreshContract("credentialRegistry", true);

      await execute(() =>
        contract.registerBatch(batchData.merkleRoot, expiryTimestamp)
      );

      setToast({ message: "Batch anchored on-chain. Generating certificates...", type: "info" });

      const response = await fetch(`${API_URL}/api/issuer/confirm-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merkleRoot: batchData.merkleRoot,
          credentials: batchData.credentials,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to confirm batch.");

      setIssueResults(data);
      setView("success");
      setToast({ message: "Credential batch successfully issued.", type: "success" });
    } catch (err) {
      setToast({
        message: parseError(err) || "Blockchain transaction failed.",
        type: "error",
      });
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget || confirmText !== "CONFIRM") return;
    try {
      const contract = await getFreshContract("credentialRegistry", true);

      await execute(() =>
        contract.revokeCredential(revokeTarget.leafHash, revokeTarget.merkleRoot)
      );

      await fetch(`${API_URL}/api/issuer/confirm-revocation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leafHash: revokeTarget.leafHash,
          merkleRoot: revokeTarget.merkleRoot,
        }),
      });

      setToast({ message: "Credential revoked on-chain.", type: "success" });
      setRevokeTarget(null);
      setConfirmText("");
      fetchDashboardData();
    } catch (err) {
      setToast({ message: parseError(err) || "Failed to revoke credential.", type: "error" });
    }
  };

  const resetForm = () => {
    setStudentName("");
    setDegreeTitle("");
    setEmail("");
    setInstitution("");
    setIssueDate("");
    setExpiryDate("");
    setBatchData(null);
    setIssueResults(null);
    setView("form");
    reset();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 font-sans">
      <TransactionOverlay status={status} error={error} onClose={reset} />
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "info" })}
      />

      {/* PORTAL HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100">
            Institutional Issuer Interface
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Credential Issuer Portal
          </h1>
        </div>
        <span
          className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border shadow-sm ${
            role.tier === 1
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-purple-50 text-purple-700 border-purple-200"
          }`}
        >
          Tier {role.tier} {role.tier === 1 ? "Academic Issuer" : "Professional Certification"}
        </span>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex gap-2 border-b border-slate-200 pb-1">
        {[
          { id: "issue", label: "Issue Credentials" },
          { id: "history", label: "Batch History" },
          { id: "revocation", label: "Revocation Panel" },
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

      {/* ISSUE TAB */}
      {activeTab === "issue" && (
        <div className="modern-glass-card p-8 rounded-3xl space-y-6 border border-slate-200">
          {view === "form" && (
            <div className="space-y-6">
              {/* MODE TOGGLE */}
              <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
                <button
                  onClick={() => setIssuanceMode("single")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    issuanceMode === "single"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Single Credential
                </button>
                <button
                  onClick={() => setIssuanceMode("bulk")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    issuanceMode === "bulk"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Bulk CSV Upload
                </button>
              </div>

              {issuanceMode === "single" ? (
                <form onSubmit={handlePrepareBatch} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold uppercase text-slate-700">Student Name</label>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold uppercase text-slate-700">Student Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="For PDF delivery"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase text-slate-700">Degree Title</label>
                    <input
                      type="text"
                      value={degreeTitle}
                      onChange={(e) => setDegreeTitle(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase text-slate-700">Institution Name</label>
                    <input
                      type="text"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold uppercase text-slate-700">Issue Date</label>
                      <input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                    {role.tier === 2 && (
                      <div className="space-y-1">
                        <label className="block text-xs font-bold uppercase text-slate-700">Expiry Date</label>
                        <input
                          type="date"
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(e.target.value)}
                          required
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md shadow-indigo-500/20"
                  >
                    Prepare Merkle Root
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <span className="text-xs text-indigo-900 font-medium">Standard CSV Column Format Required</span>
                    <a
                      href={`${API_URL}/api/issuer/csv-template`}
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >
                      Download Sample CSV (25 Students)
                    </a>
                  </div>

                  <div
                    onClick={() => fileInputRef.current.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                      isDragging
                        ? "border-indigo-500 bg-indigo-50/50"
                        : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <p className="text-xs font-bold text-slate-700 mb-1">
                      Drag and drop CSV file here, or click to browse
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">Supports up to 1000 records per Merkle Root batch</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* REVIEW MERKLE ROOT STAGE */}
          {view === "review" && batchData && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Review Batch Specifications</h3>
                <p className="text-slate-500 text-xs">Verify the calculated Merkle Root before committing on-chain.</p>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Credential Count:</span>
                  <span className="font-bold text-slate-900">{batchData.credentials.length} Record(s)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Calculated Merkle Root:</span>
                  <span className="font-bold text-indigo-600">{formatAddress(batchData.merkleRoot)}</span>
                </div>
              </div>

              <button
                onClick={handleConfirmRegister}
                disabled={status === "pending"}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md shadow-indigo-500/20"
              >
                {status === "pending" ? "Awaiting Wallet Signature..." : "Confirm & Register on zkSync"}
              </button>
            </div>
          )}

          {/* ISSUANCE COMPLETE SUCCESS STAGE WITH DIRECT ONE-CLICK VERIFY BUTTON */}
          {view === "success" && issueResults && (
            <div className="text-center space-y-6">
              <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20 font-bold text-xl">
                ✓
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-slate-900">Issuance Complete</h3>
                <p className="text-slate-500 text-xs font-mono">
                  {issueResults.issued.length} credential(s) anchored under Merkle Root {formatAddress(issueResults.merkleRoot)}
                </p>
              </div>

              {/* ONE-CLICK DIRECT VERIFICATION BUTTON WITH PROOF */}
              {issueResults.issued.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      const firstCred = issueResults.issued[0];
                      const proofString = firstCred.proof && Array.isArray(firstCred.proof) ? firstCred.proof.join(',') : '';
                      navigate(`/verify?merkleRoot=${issueResults.merkleRoot}&leaf=${firstCred.leaf}&proof=${proofString}`);
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                  >
                    <span>Verify First Certificate Live ↗</span>
                  </button>
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left max-h-60 overflow-y-auto space-y-2 text-xs">
                <p className="font-bold text-slate-700 uppercase text-[10px]">Email Dispatch Results:</p>
                {issueResults.issued.map((item, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-slate-200/60 pb-2 last:border-0 font-mono">
                    <span className="text-slate-800 font-sans font-medium">{item.credential.studentName}</span>
                    <span className={item.emailed ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                      {item.emailed ? "Email Delivered" : "Delivery Failed"}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={resetForm}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl text-xs transition-colors border border-slate-300"
              >
                Issue Another Batch
              </button>
            </div>
          )}
        </div>
      )}

      {/* EXPANDABLE BATCH HISTORY TAB */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {isLoadingHistory ? (
            <p className="text-slate-500 text-center py-12 text-xs">Loading batch history...</p>
          ) : history.length === 0 ? (
            <p className="text-slate-500 text-center py-16 text-xs">No batches have been issued by this address yet.</p>
          ) : (
            history.map((batch, i) => {
              const isExpanded = expandedBatch === batch.merkleRoot;

              return (
                <div key={i} className="modern-glass-card rounded-2xl border border-slate-200 overflow-hidden space-y-2">
                  <div className="p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded border border-indigo-100">
                          Block #{batch.blockNumber}
                        </span>
                        <span className="text-[10px] font-sans font-medium text-slate-500">
                          {batch.expiryTimestamp === "0" ? "Permanent Degree" : "Time-Bound Certification"}
                        </span>
                      </div>
                      <p className="font-mono text-xs font-bold text-slate-900">
                        Merkle Root: <span className="text-indigo-600">{formatAddress(batch.merkleRoot)}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpandBatch(batch.merkleRoot)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors border border-slate-300"
                      >
                        {isExpanded ? "Hide Students ↑" : "View Students"}
                      </button>

                      <button
                        onClick={() =>
                          navigate(`/verify?merkleRoot=${batch.merkleRoot}&leaf=${batch.merkleRoot}&proof=`)
                        }
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-colors shadow-sm"
                      >
                        Inspect On-Chain ↗
                      </button>
                    </div>
                  </div>

                  {/* EXPANDABLE DRAWER SHOWING STUDENT RECORDS IN THIS BATCH */}
                  {isExpanded && (
                    <div className="bg-slate-50/90 border-t border-slate-200 p-5 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Students Included in Batch ({formatAddress(batch.merkleRoot)}):
                      </p>

                      {isLoadingBatchStudents ? (
                        <p className="text-slate-400 text-xs font-mono">Fetching student records...</p>
                      ) : batchStudents.length === 0 ? (
                        <p className="text-slate-400 text-xs">No off-chain records indexed for this root.</p>
                      ) : (
                        <div className="space-y-2">
                          {batchStudents.map((cred, idx) => (
                            <div
                              key={idx}
                              className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs"
                            >
                              <div>
                                <p className="font-bold text-slate-900">{cred.studentName}</p>
                                <p className="text-slate-500 text-[11px]">{cred.degreeTitle}</p>
                              </div>
                              <button
                                onClick={() => {
                                  const proofString = cred.proof && Array.isArray(cred.proof) ? cred.proof.join(',') : '';
                                  navigate(`/verify?merkleRoot=${cred.merkleRoot}&leaf=${cred.leafHash}&proof=${proofString}`);
                                }}
                                className="text-indigo-600 font-bold hover:underline text-xs"
                              >
                                Verify Credential ↗
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* REVOCATION PANEL TAB */}
      {activeTab === "revocation" && (
        <div className="space-y-4">
          {isLoadingHistory ? (
            <p className="text-slate-500 text-center py-12 text-xs">Loading active credentials...</p>
          ) : credentials.length === 0 ? (
            <p className="text-slate-500 text-center py-16 text-xs">No credentials available to revoke.</p>
          ) : (
            credentials.map((cred, i) => (
              <div
                key={i}
                className="modern-glass-card p-5 rounded-2xl border border-slate-200 flex justify-between items-center gap-4"
              >
                <div className="space-y-1">
                  <p className="font-bold text-xs text-slate-900">{cred.studentName}</p>
                  <p className="text-[11px] text-slate-500">{cred.degreeTitle}</p>
                  <p className="font-mono text-[10px] text-slate-400">Leaf: {formatAddress(cred.leafHash)}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const proofString = cred.proof && Array.isArray(cred.proof) ? cred.proof.join(',') : '';
                      navigate(`/verify?merkleRoot=${cred.merkleRoot}&leaf=${cred.leafHash}&proof=${proofString}`);
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors border border-slate-300"
                  >
                    Verify Status ↗
                  </button>

                  {cred.revoked ? (
                    <span className="text-[10px] font-mono font-bold bg-rose-50 text-rose-700 px-3 py-1.5 rounded-xl border border-rose-200">
                      Revoked On-Chain
                    </span>
                  ) : (
                    <button
                      onClick={() => setRevokeTarget(cred)}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3.5 py-1.5 rounded-xl text-xs border border-rose-200 transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PERMANENT REVOCATION CONFIRMATION MODAL */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl">
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase bg-rose-50 text-rose-700 px-2.5 py-1 rounded border border-rose-200">
                Irreversible Action
              </span>
              <h3 className="text-lg font-extrabold text-slate-900">Confirm Permanent Revocation</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                You are about to permanently invalidate the credential for <span className="font-bold text-slate-900">{revokeTarget.studentName}</span> on the blockchain.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <p className="text-[11px] text-slate-500 font-medium">
                To confirm, type <span className="font-mono font-bold text-rose-600">CONFIRM</span> in capital letters below:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="CONFIRM"
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-rose-600"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRevokeTarget(null);
                  setConfirmText("");
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleRevoke}
                disabled={confirmText !== "CONFIRM" || status === "pending"}
                className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-rose-600/20"
              >
                {status === "pending" ? "Revoking..." : "Revoke Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}