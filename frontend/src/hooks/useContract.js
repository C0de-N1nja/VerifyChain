import { useMemo } from "react";
import { ethers } from "ethers";
import { CONTRACTS } from "../config/contracts";

// Hook export for components using useContract
export function useContract(contractName, signerOrProvider) {
  return useMemo(() => {
    const config = CONTRACTS[contractName];
    if (!config || !config.address || !signerOrProvider) return null;
    return new ethers.Contract(config.address, config.abi, signerOrProvider);
  }, [contractName, signerOrProvider]);
}

// Dynamic fresh contract getter for instant signers
export function getFreshContract(contractName, isWrite = false) {
  if (typeof window.ethereum === "undefined") return null;

  const config = CONTRACTS[contractName];
  if (!config || !config.address) return null;

  const provider = new ethers.BrowserProvider(window.ethereum);

  if (isWrite) {
    return provider.getSigner().then((signer) => {
      return new ethers.Contract(config.address, config.abi, signer);
    });
  } else {
    return new ethers.Contract(config.address, config.abi, provider);
  }
}