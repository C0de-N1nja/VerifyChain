import credentialRegistryAbi from "./credentialregistry.json";
import governanceBoardAbi from "./governanceboard.json";

export const CONTRACTS = {
  governanceBoard: {
    address: "0x833C48E232174F849201fc58642bfdb41265D51e",
    abi: governanceBoardAbi,
  },
  credentialRegistry: {
    address: "0x92fF1cB6177c6543E3ED358dcceBD7F7E9cBcBef",
    abi: credentialRegistryAbi,
  },
};

export const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;