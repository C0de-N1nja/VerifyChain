import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const [view, setView] = useState("form");
  const [issuanceMode, setIssuanceMode] = useState("single");

  // Form state
  const [studentName, setStudentName] = useState("");
  const [degreeTitle, setDegreeTitle] = useState("");
  const [department, setDepartment] = useState("");
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
  
  // UI State for 3-Level Accordion & Search
  const [expandedInst, setExpandedInst] = useState(null);
  const [expandedDept, setExpandedDept] = useState(null);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [revokeSearchQuery, setRevokeSearchQuery] = useState("");

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

  if (role.isLoading)
    return <div className="text-center text-slate-500 py-20 text-sm font-medium">Checking issuer authorization...</div>;

  if (!role.isIssuer) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-4 bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-slate-600 text-sm">
          Your connected account is not an authorized institutional issuer.
        </p>
      </div>
    );
  }

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
            department: department || "General",
            issuerAddress: address,
            email: email || undefined,
            expiryTimestamp,
            institutionName: institution,
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
  
  const handleCsvUpload = async (file) => {
    if (!file) return;
    setToast({ message: "Processing CSV file...", type: "info" });

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

  const handleConfirmRegister = async () => {
    if (!batchData) return;

    try {
      const expiryTimestamp = batchData.credentials[0]?.credential?.expiryTimestamp || 0;
      const contract = await getFreshContract("credentialRegistry", true);

      await execute(() =>
        contract.registerBatch(batchData.merkleRoot, expiryTimestamp)
      );

      setToast({ message: "Credential registered. Generating certificates...", type: "info" });

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
      setToast({ message: "Credential successfully issued.", type: "success" });
    } catch (err) {
      setToast({
        message: parseError(err) || "Issuance failed.",
        type: "error",
      });
    }
  };

  const handleRevoke = async () => {
    // Retain your existing revoke logic here
  };

  const resetForm = () => {
    setStudentName("");
    setDegreeTitle("");
    setDepartment("");
    setEmail("");
    setInstitution("");
    setIssueDate("");
    setExpiryDate("");
    setBatchData(null);
    setIssueResults(null);
    setView("form");
    reset();
  };

  // --- 3-LEVEL FILTERING & GROUPING LOGIC ---
  const filteredCredentials = credentials.filter(cred => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      cred.studentName?.toLowerCase().includes(q) ||
      cred.degreeTitle?.toLowerCase().includes(q) ||
      cred.department?.toLowerCase().includes(q) ||
      cred.institutionName?.toLowerCase().includes(q)
    );
  });

  // Level 1: Institution -> Level 2: Department -> Level 3: Batch -> Students
  const groupedHistory = Object.entries(
    filteredCredentials.reduce((acc, cred) => {
      const inst = cred.institutionName || 'Unknown Institution';
      const dept = cred.department || 'General';
      const batch = cred.merkleRoot;
      
      if (!acc[inst]) acc[inst] = {};
      if (!acc[inst][dept]) acc[inst][dept] = {};
      if (!acc[inst][dept][batch]) acc[inst][dept][batch] = [];
      acc[inst][dept][batch].push(cred);
      
      return acc;
    }, {})
  );

  // Revocation Tab Filter
  const filteredRevocationCreds = credentials.filter(cred => {
    if (!revokeSearchQuery) return true;
    const q = revokeSearchQuery.toLowerCase();
    return (
      cred.studentName?.toLowerCase().includes(q) ||
      cred.degreeTitle?.toLowerCase().includes(q) ||
      cred.department?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 font-sans">
      <TransactionOverlay status={status} error={error} onClose={reset} />
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "info" })}
      />

      {/* PORTAL HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100">
            Issuer Portal
          </span>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mt-2">
            Credential Management
          </h1>
        </div>
        <span className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
          Authorized {role.tier === 1 ? "Academic" : "Professional"} Issuer
        </span>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex gap-6 border-b border-slate-200">
        {[
          { id: "issue", label: "Issue Credentials" },
          { id: "history", label: "Batch History" },
          { id: "revocation", label: "Revocation" },
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

      {/* ISSUE TAB */}
      {activeTab === "issue" && (
        <div className="bg-white p-8 rounded-xl space-y-6 border border-slate-200 shadow-sm">
          {view === "form" && (
            <div className="space-y-6">
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit border border-slate-200">
                <button
                  onClick={() => setIssuanceMode("single")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    issuanceMode === "single" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Single Credential
                </button>
                <button
                  onClick={() => setIssuanceMode("bulk")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    issuanceMode === "bulk" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Bulk CSV Upload
                </button>
              </div>

              {issuanceMode === "single" ? (
                <form onSubmit={handlePrepareBatch} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-800">Student Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="studentName" className="block text-sm font-medium text-slate-700">Student Name</label>
                        <input id="studentName" type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} required
                          className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="email" className="block text-sm font-medium text-slate-700">Student Email</label>
                        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="For PDF delivery"
                          className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-800">Academic Details</h3>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label htmlFor="degreeTitle" className="block text-sm font-medium text-slate-700">Degree Title</label>
                        <input id="degreeTitle" type="text" value={degreeTitle} onChange={(e) => setDegreeTitle(e.target.value)} required
                          className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label htmlFor="institution" className="block text-sm font-medium text-slate-700">Institution Name</label>
                          <input id="institution" type="text" value={institution} onChange={(e) => setInstitution(e.target.value)} required
                            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="department" className="block text-sm font-medium text-slate-700">Department</label>
                          <input id="department" type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g., Computer Science" required
                            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label htmlFor="issueDate" className="block text-sm font-medium text-slate-700">Issue Date</label>
                          <input id="issueDate" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required
                            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        {role.tier === 2 && (
                          <div className="space-y-1.5">
                            <label htmlFor="expiryDate" className="block text-sm font-medium text-slate-700">Expiry Date</label>
                            <input id="expiryDate" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required
                              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">
                    Review Credential
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                   <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                    <span className="text-sm text-indigo-900 font-medium">Standard CSV format required (Inst & Dept columns included)</span>
                    <a href={`${API_URL}/api/issuer/csv-template`} className="text-sm font-medium text-indigo-600 hover:underline">Download Template</a>
                  </div>
                  <div
                    onClick={(e) => { e.preventDefault(); const input = document.createElement('input'); input.type = 'file'; input.accept = '.csv'; input.onchange = (e) => handleFileChange(e); input.click(); }}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${isDragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-slate-400 bg-slate-50"}`}
                  >
                    <p className="text-sm font-medium text-slate-700 mb-1">Drag and drop CSV file here, or click to browse</p>
                    <p className="text-xs text-slate-500">Supports up to 1000 records per batch</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {view === "review" && batchData && (
             <div className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-900">Review & Confirm</h3>
                  <p className="text-slate-500 text-sm">Please review the credential details below before finalizing.</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Total Credentials:</span>
                    <span className="font-medium text-slate-900">{batchData.credentials.length} Record(s)</span>
                  </div>
                  {batchData.credentials.length === 1 && batchData.credentials[0].credential && (
                    <div className="pt-4 border-t border-slate-200 space-y-2 text-sm">
                       <div className="flex justify-between"><span className="text-slate-500">Name:</span><span className="font-medium text-slate-900">{batchData.credentials[0].credential.studentName}</span></div>
                       <div className="flex justify-between"><span className="text-slate-500">Degree:</span><span className="font-medium text-slate-900">{batchData.credentials[0].credential.degreeTitle}</span></div>
                       <div className="flex justify-between"><span className="text-slate-500">Institution:</span><span className="font-medium text-slate-900">{batchData.credentials[0].credential.institutionName || 'N/A'}</span></div>
                       <div className="flex justify-between"><span className="text-slate-500">Department:</span><span className="font-medium text-slate-900">{batchData.credentials[0].credential.department || 'General'}</span></div>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-4 border-t border-slate-200 text-sm">
                    <span className="text-slate-500">Secure Batch ID:</span>
                    <span className="font-mono text-xs text-indigo-600">{formatAddress(batchData.merkleRoot)}</span>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  <p>Once confirmed, this credential will be permanently registered and cannot be altered.</p>
                </div>
                <button onClick={handleConfirmRegister} disabled={status === "pending"} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">
                  {status === "pending" ? "Waiting for institutional approval..." : "Confirm & Issue Credential"}
                </button>
              </div>
          )}

          {view === "success" && issueResults && (
             <div className="text-center space-y-6">
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-slate-900">Credential Successfully Issued</h3>
                  <p className="text-slate-500 text-sm">{issueResults.issued.length} credential(s) have been secured and emailed.</p>
                </div>
                {issueResults.issued.length > 0 && (
                  <div className="pt-2">
                    <button onClick={() => { const firstCred = issueResults.issued[0]; const proofString = firstCred.proof && Array.isArray(firstCred.proof) ? firstCred.proof.join(',') : ''; navigate(`/verify?merkleRoot=${issueResults.merkleRoot}&leaf=${firstCred.leaf}&proof=${proofString}`); }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg text-sm transition-colors shadow-sm flex items-center justify-center gap-2">
                      View Verification Page
                    </button>
                  </div>
                )}
                <div className="bg-white p-4 rounded-lg border border-slate-200 text-left max-h-60 overflow-y-auto space-y-2">
                  <p className="font-medium text-slate-700 uppercase text-xs tracking-wider">Delivery Status:</p>
                  {issueResults.issued.map((item, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0">
                      <span className="text-sm text-slate-800 font-medium">{item.credential.studentName}</span>
                      <span className={`text-xs font-medium ${item.emailed ? "text-emerald-600" : "text-amber-600"}`}>{item.emailed ? "Email Delivered" : "Delivery Failed"}</span>
                    </div>
                  ))}
                </div>
                <button onClick={resetForm} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-3 rounded-lg text-sm transition-colors border border-slate-300">
                  Issue Another Credential
                </button>
              </div>
          )}
        </div>
      )}

      {/* BATCH HISTORY TAB (3-LEVEL ACCORDION) */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* SEARCH & STATS BAR */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="w-full sm:w-1/2">
              <input
                type="text"
                placeholder="Search university, student, degree, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-4 text-xs">
              <div className="bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg border border-indigo-100 text-center">
                <p className="font-bold text-base">{groupedHistory.length}</p>
                <p>Institutions</p>
              </div>
              <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg border border-emerald-100 text-center">
                <p className="font-bold text-base">{filteredCredentials.length}</p>
                <p>Total Records</p>
              </div>
            </div>
          </div>

          {isLoadingHistory ? (
            <p className="text-slate-500 text-center py-12 text-sm">Loading batch history...</p>
          ) : groupedHistory.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
               <p className="text-slate-500 text-sm">No records found matching your search.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* LEVEL 1: INSTITUTION */}
              {groupedHistory.map(([instName, departments]) => {
                const isInstExpanded = expandedInst === instName;
                const totalRecordsInInst = Object.values(departments).flat().flat().length;

                return (
                  <div key={instName} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div 
                      onClick={() => setExpandedInst(isInstExpanded ? null : instName)}
                      className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-slate-900">{instName}</h3>
                        <p className="text-sm text-slate-500">{totalRecordsInInst} Total Record(s)</p>
                      </div>
                      <button className="text-slate-400 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 bg-white">
                        {isInstExpanded ? "Hide" : "View"}
                      </button>
                    </div>

                    {/* LEVEL 2: DEPARTMENTS */}
                    {isInstExpanded && (
                      <div className="bg-slate-50 border-t border-slate-200 p-5 space-y-4">
                        {Object.entries(departments).map(([deptName, batches]) => {
                          const isDeptExpanded = expandedDept === `${instName}-${deptName}`;
                          const totalRecordsInDept = Object.values(batches).flat().length;

                          return (
                            <div key={deptName} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                              <div 
                                onClick={() => setExpandedDept(isDeptExpanded ? null : `${instName}-${deptName}`)}
                                className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                              >
                                <div className="space-y-1">
                                  <h4 className="text-md font-semibold text-indigo-700">{deptName}</h4>
                                  <p className="text-xs text-slate-500">{totalRecordsInDept} Record(s)</p>
                                </div>
                                <button className="text-slate-400 text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-200 bg-white">
                                  {isDeptExpanded ? "Hide" : "View"}
                                </button>
                              </div>

                              {/* LEVEL 3: BATCHES */}
                              {isDeptExpanded && (
                                <div className="bg-white border-t border-slate-200 p-4 space-y-3">
                                  {Object.entries(batches).map(([merkleRoot, students]) => {
                                    const isBatchExpanded = expandedBatch === merkleRoot;
                                    return (
                                      <div key={merkleRoot} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                                        <div className="p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                          <div className="space-y-1">
                                            <span className="text-xs font-mono font-medium bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                              Batch ID: {formatAddress(merkleRoot)}
                                            </span>
                                            <p className="text-sm text-slate-800 font-medium mt-1">
                                              {students.length} Record(s) in this batch
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => setExpandedBatch(isBatchExpanded ? null : merkleRoot)}
                                              className="bg-white hover:bg-slate-100 text-slate-800 font-medium px-3 py-1.5 rounded-lg text-xs transition-colors border border-slate-300"
                                            >
                                              {isBatchExpanded ? "Hide Students" : "View Students"}
                                            </button>
                                            <button
                                              onClick={() => navigate(`/verify?merkleRoot=${merkleRoot}&leaf=${students[0].leafHash}&proof=${students[0].proof.join(',')}`)}
                                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm"
                                            >
                                              Verify Batch
                                            </button>
                                          </div>
                                        </div>

                                        {/* LEVEL 4: STUDENTS */}
                                        {isBatchExpanded && (
                                          <div className="bg-white border-t border-slate-200 p-3 space-y-2">
                                            {students.map((cred, idx) => (
                                              <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                                                <div>
                                                  <p className="font-medium text-slate-900 text-sm">{cred.studentName}</p>
                                                  <p className="text-slate-500 text-xs">{cred.degreeTitle}</p>
                                                </div>
                                                <button
                                                  onClick={() => navigate(`/verify?merkleRoot=${cred.merkleRoot}&leaf=${cred.leafHash}&proof=${cred.proof.join(',')}`)}
                                                  className="text-indigo-600 font-medium hover:underline text-sm"
                                                >
                                                  Verify
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* REVOCATION TAB (WITH SEARCH) */}
      {activeTab === "revocation" && (
        <div className="space-y-4">
          {/* REVOKE SEARCH BAR */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <input
              type="text"
              placeholder="Search student to revoke..."
              value={revokeSearchQuery}
              onChange={(e) => setRevokeSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>

          {isLoadingHistory ? (
            <p className="text-slate-500 text-center py-12 text-sm">Loading active credentials...</p>
          ) : filteredRevocationCreds.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
               <p className="text-slate-500 text-sm">No credentials found matching your search.</p>
            </div>
          ) : (
            filteredRevocationCreds.map((cred, i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center gap-4">
                <div className="space-y-1">
                  <p className="font-medium text-slate-900 text-sm">{cred.studentName}</p>
                  <p className="text-slate-500 text-xs">{cred.degreeTitle} • {cred.institutionName || 'N/A'} • {cred.department || 'General'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/verify?merkleRoot=${cred.merkleRoot}&leaf=${cred.leafHash}&proof=${cred.proof.join(',')}`)}
                    className="bg-white hover:bg-slate-50 text-slate-700 font-medium px-3 py-1.5 rounded-lg text-sm transition-colors border border-slate-300"
                  >
                    Verify
                  </button>
                  {cred.revoked ? (
                    <span className="text-xs font-medium bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg border border-rose-200">Revoked</span>
                  ) : (
                    <button
                      onClick={() => handleRevoke(cred)}
                      className="bg-white hover:bg-rose-50 text-rose-700 font-medium px-3.5 py-1.5 rounded-lg text-sm border border-rose-200 transition-colors"
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
    </div>
  );
}