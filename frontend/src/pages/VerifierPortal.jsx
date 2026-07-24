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
				setStatus("error");
				return;
			}

			const data = await response.json();

			if (data.status === "Valid") {
				setVerifyData({
					issuer: data.issuer || "0x0000000000000000000000000000000000000000",
					merkleRoot: root,
					leaf: leaf,
					proofCount: proofParam ? proofParam.split(",").length : 0,
					studentName: data.studentName || null,
					degreeTitle: data.degreeTitle || null,
					institutionName: data.institutionName || null,
					issuedAt: data.issuedAt || null,
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
		<div className="max-w-2xl mx-auto py-8 space-y-8 font-sans">
			{/* HEADER */}
			<div className="text-center space-y-3">
				<span className="text-xs font-semibold tracking-wider uppercase text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
					Public Verifier
				</span>
				<h1 className="text-3xl font-bold text-slate-900 tracking-tight">
					Credential Verification
				</h1>
				<p className="text-slate-600 text-sm max-w-md mx-auto">
					Instantly verify the authenticity of academic credentials. No account or wallet required.
				</p>
			</div>

			{/* VERIFYING LOADING STATE */}
			{status === "verifying" && (
				<div className="bg-white p-12 rounded-xl text-center space-y-4 border border-slate-200 shadow-sm">
					<div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
					<h3 className="text-base font-semibold text-slate-900">Checking credential integrity...</h3>
					<p className="text-slate-500 text-sm">Querying secure registry...</p>
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

					{/* CREDENTIAL DETAILS */}
					{(verifyData.studentName || verifyData.degreeTitle || verifyData.institutionName || verifyData.issuedAt) && (
						<div className="modern-glass-card p-6 rounded-2xl border border-slate-200 space-y-3">
							<h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Credential Details</h3>
							{verifyData.studentName && (
								<div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
									<span className="text-xs font-semibold text-slate-700">Student Name</span>
									<span className="text-sm font-bold text-slate-900">{verifyData.studentName}</span>
								</div>
							)}
							{verifyData.degreeTitle && (
								<div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
									<span className="text-xs font-semibold text-slate-700">Degree Title</span>
									<span className="text-sm font-bold text-slate-900">{verifyData.degreeTitle}</span>
								</div>
							)}
							{verifyData.institutionName && (
								<div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
									<span className="text-xs font-semibold text-slate-700">Issuing Institution</span>
									<span className="text-sm font-bold text-slate-900">{verifyData.institutionName}</span>
								</div>
							)}
							{verifyData.issuedAt && (
								<div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
									<span className="text-xs font-semibold text-slate-700">Date Issued</span>
									<span className="text-sm font-bold text-slate-900">
										{new Date(verifyData.issuedAt).toLocaleDateString()}
									</span>
								</div>
							)}
						</div>
					)}

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

					{/* ADVANCED TECHNICAL DETAILS (Accordion) */}
					<details className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm group">
						<summary className="font-medium text-slate-700 cursor-pointer flex items-center justify-between text-sm">
							<span>Advanced Cryptographic Details</span>
							<span className="transition-transform group-open:rotate-180 text-slate-400">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
									<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
								</svg>
							</span>
						</summary>

						<div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
							<div className="flex justify-between text-sm">
								<span className="text-slate-500">Batch Root Hash:</span>
								<span className="font-mono text-slate-800 text-xs">{formatAddress(verifyData.merkleRoot)}</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-slate-500">Proof Nodes Supplied:</span>
								<span className="font-mono text-slate-800 text-xs">{verifyData.proofCount}</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-slate-500">Registry Contract:</span>
								<span className="font-mono text-slate-800 text-xs">{formatAddress(CONTRACTS.credentialRegistry.address)}</span>
							</div>
							<div className="pt-2">
								<a
									href={`https://sepolia.explorer.zksync.io/address/${CONTRACTS.credentialRegistry.address}`}
									target="_blank"
									rel="noreferrer"
									className="inline-block text-indigo-600 hover:text-indigo-700 font-medium text-xs"
								>
									View Registry on Blockchain Explorer ↗
								</a>
							</div>
						</div>
					</details>

					<button
						onClick={() => setStatus("idle")}
						className="w-full bg-white hover:bg-slate-50 text-slate-800 font-medium py-3 rounded-xl text-sm transition-colors border border-slate-300 shadow-sm"
					>
						Verify Another Credential
					</button>
				</div>
			)}

			{/* REVOKED RESULT STATE */}
			{status === "revoked" && (
				<div className="space-y-6">
					<div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center space-y-3 shadow-sm">
						<div className="w-12 h-12 bg-rose-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
							<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
								<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</div>
						<h2 className="text-xl font-bold text-rose-900 tracking-tight">Credential Revoked</h2>
						<p className="text-rose-800 text-sm leading-relaxed max-w-md mx-auto">
							This credential has been permanently cancelled by the issuing institution.
						</p>
					</div>

					{verifyData && (
						<div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3 shadow-sm">
							<h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Revocation Record</h3>
							<div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
								<span className="text-xs text-slate-500 block mb-1">Document Key</span>
								<p className="font-mono text-sm text-rose-700 break-all">{verifyData.leaf}</p>
							</div>
						</div>
					)}

					<button
						onClick={() => setStatus("idle")}
						className="w-full bg-white hover:bg-slate-50 text-slate-800 font-medium py-3 rounded-xl text-sm border border-slate-300 shadow-sm transition-colors"
					>
						Verify Another Credential
					</button>
				</div>
			)}

			{/* EXPIRED / NOT FOUND / ERROR */}
			{(status === "expired" || status === "not_found" || status === "error") && (
				<div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center space-y-3 shadow-sm">
					<div className="w-12 h-12 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
						<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
							<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					</div>
					<h2 className="text-xl font-bold text-amber-900 tracking-tight">
						{status === "expired" ? "Credential Expired" : "Verification Failed"}
					</h2>
					<p className="text-amber-800 text-sm">
						{status === "expired"
							? "The validity period for this credential has passed."
							: "No matching record found. Please check your input and try again."}
					</p>
					<button
						onClick={() => setStatus("idle")}
						className="mt-4 bg-white hover:bg-amber-50 text-amber-900 font-medium px-6 py-2.5 rounded-xl text-sm border border-amber-300 transition-colors"
					>
						Try Again
					</button>
				</div>
			)}

			{/* MANUAL LOOKUP */}
			{status === "idle" && (
				<div className="bg-white p-8 rounded-xl space-y-6 border border-slate-200 shadow-sm">
					<div className="space-y-1">
						<h3 className="text-lg font-semibold text-slate-900">Manual Verification</h3>
						<p className="text-sm text-slate-500">Enter the credential details exactly as provided.</p>
					</div>
					<form onSubmit={handleManualSubmit} className="space-y-4">
						<div className="space-y-1.5">
							<label htmlFor="rootId" className="text-sm font-medium text-slate-700">Credential Batch ID</label>
							<input
								id="rootId"
								type="text"
								value={manualRoot}
								onChange={(e) => setManualRoot(e.target.value)}
								placeholder="0x..."
								className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
							/>
						</div>
						<div className="space-y-1.5">
							<label htmlFor="docId" className="text-sm font-medium text-slate-700">Document ID</label>
							<input
								id="docId"
								type="text"
								value={manualLeaf}
								onChange={(e) => setManualLeaf(e.target.value)}
								placeholder="0x..."
								className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
							/>
						</div>
						<button
							type="submit"
							className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
						>
							Verify Credential
						</button>
					</form>
				</div>
			)}
		</div>
	);
}