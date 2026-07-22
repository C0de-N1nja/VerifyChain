import { ethers } from "ethers";
import governanceBoardAbi from "../config/governanceboard.json";
import credentialRegistryAbi from "../config/credentialregistry.json";

const errorMessages = {
  // Governance Errors
  GovernanceBoard__NotBoardMember: "Your wallet is not an authorized Governance Board member.",
  GovernanceBoard__AlreadyVoted: "You have already voted on this proposal.",
  GovernanceBoard__AlreadyActivated: "This institution is already an active whitelisted issuer.",
  GovernanceBoard__InvalidTier: "The selected tier level is invalid.",
  GovernanceBoard__ProposalAlreadyExecuted: "This proposal has already been executed.",
  GovernanceBoard__ProposalNotFound: "This proposal ID does not exist.",

  // Credential Registry Errors
  CredentialRegistry__NotActivatedIssuer: "Your connected wallet is not authorized to issue credentials.",
  CredentialRegistry__AlreadyRevoked: "This credential has already been revoked on-chain.",
  CredentialRegistry__NotBatchOwner: "You can only revoke credentials that were issued by your wallet address.",
  CredentialRegistry__BatchNotFound: "This certificate does not match any record on the blockchain.",
  CredentialRegistry__Expired: "This credential has passed its expiration date.",
  CredentialRegistry__InvalidProof: "Invalid Merkle Proof. The credential data may have been altered or forged.",
};

const govInterface = new ethers.Interface(governanceBoardAbi);
const regInterface = new ethers.Interface(credentialRegistryAbi);

export const parseError = (error) => {
  // Extract custom error hex data if present
  const data = error?.data || error?.info?.error?.data || error?.error?.data;

  if (data && typeof data === "string") {
    try {
      const parsedGov = govInterface.parseError(data);
      if (parsedGov && errorMessages[parsedGov.name]) {
        return errorMessages[parsedGov.name];
      }
    } catch (e) { /* ignore */ }

    try {
      const parsedReg = regInterface.parseError(data);
      if (parsedReg && errorMessages[parsedReg.name]) {
        return errorMessages[parsedReg.name];
      }
    } catch (e) { /* ignore */ }
  }

  // String matching fallback
  const errorString = JSON.stringify(error);
  for (const [key, message] of Object.entries(errorMessages)) {
    if (errorString.includes(key)) return message;
  }

  if (error?.shortMessage) return error.shortMessage;
  if (error?.message) return error.message;

  return "Transaction failed on-chain. Please check your inputs and try again.";
};