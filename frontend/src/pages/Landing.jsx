import { Link } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";

export default function Landing() {
  const { address, role } = useWallet();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-4xl md:text-5xl font-bold mb-4 text-slate-100">
        Cryptographic certainty for academic credentials.
      </h1>
      <p className="text-slate-400 max-w-xl mb-8">
        VerifyChain anchors academic records on zkSync, ensuring they are permanent, verifiable, and tamper-proof.
      </p>
      
      <div className="flex gap-4">
        <Link to="/verify" className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
          Verify a Credential
        </Link>
        
        {address && role.isIssuer && (
          <Link to="/issuer" className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold py-3 px-6 rounded-lg transition-colors">
            Issuer Portal
          </Link>
        )}
        
        {address && role.isGovernanceMember && (
          <Link to="/governance" className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg transition-colors">
            Governance Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}