import { useMemo } from "react";
import { ethers } from "ethers";
import { CONTRACTS } from "../config/contracts";

export function useContract(contractName, signerOrProvider) {
  return useMemo(() => {
    const config = CONTRACTS[contractName];
    // Guard against missing addresses or missing signer/provider
    if (!config || !config.address || !signerOrProvider) return null;
    
    return new ethers.Contract(config.address, config.abi, signerOrProvider);
  }, [contractName, signerOrProvider]);
}