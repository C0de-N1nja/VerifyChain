import { useState, useCallback } from "react";
import { parseError } from "../utils/errorMessages";

export function useTransaction() {
  const [status, setStatus] = useState("idle"); // 'idle' | 'pending' | 'success' | 'error'
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  const execute = useCallback(async (txFunction) => {
    setStatus("pending");
    setError(null);
    setTxHash(null);
    
    try {
      const tx = await txFunction();
      setTxHash(tx.hash);
      await tx.wait(); // Wait for confirmation
      setStatus("success");
      return tx;
    } catch (err) {
      console.error("Transaction failed:", err);
      // If user rejects in MetaMask
      if (err.code === "ACTION_REJECTED" || err?.info?.error?.code === 4001) {
        setError("Transaction was rejected in MetaMask.");
      } else {
        setError(parseError(err));
      }
      setStatus("error");
      throw err; // Re-throw so calling component can react if needed
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setTxHash(null);
  }, []);

  return { status, txHash, error, execute, reset };
}