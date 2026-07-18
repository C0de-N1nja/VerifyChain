const errorMessages = {
  // Governance Errors
  GovernanceBoard__NotBoardMember: "You are not authorized as a Governance Board member.",
  GovernanceBoard__AlreadyVoted: "You have already voted on this proposal.",
  GovernanceBoard__AlreadyActivated: "This institution is already an active issuer.",
  GovernanceBoard__InvalidTier: "The selected tier is invalid.",
  GovernanceBoard__ProposalAlreadyExecuted: "This proposal has already been executed.",
  GovernanceBoard__ProposalNotFound: "This proposal does not exist.",

  // Credential Registry Errors
  CredentialRegistry__NotActivatedIssuer: "Your wallet is not authorized to issue credentials.",
  CredentialRegistry__AlreadyRevoked: "This credential has already been revoked.",
  CredentialRegistry__NotBatchOwner: "You can only revoke credentials you issued yourself.",
  CredentialRegistry__BatchNotFound: "This certificate does not match any record on the blockchain.",
  CredentialRegistry__Expired: "This credential has expired.",
  CredentialRegistry__InvalidProof: "Invalid Merkle Proof. The credential data may have been tampered with.",
};

export const parseError = (error) => {
  const errorData = error?.data || error?.info?.error?.data || error?.reason;
  
  if (typeof errorData === "string") {
    for (const [key, message] of Object.entries(errorMessages)) {
      if (errorData.includes(key)) return message;
    }
  }
  
  if (error?.revert && error?.revert?.name) {
    return errorMessages[error.revert.name] || error.revert.name;
  }

  if (error?.shortMessage) return error.shortMessage;
  
  // NEW: If it's a standard backend/fetch error, show the actual message!
  if (error?.message) return error.message;
  
  return "Something went wrong. Please refresh and try again.";
};