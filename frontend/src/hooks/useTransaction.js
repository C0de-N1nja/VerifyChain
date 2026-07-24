import { useState, useCallback } from "react";
import { parseError } from "../utils/errorMessages";

export function useTransaction() {
	const [status, setStatus] = useState("idle");
	const [pendingStep, setPendingStep] = useState("");
	const [txHash, setTxHash] = useState(null);
	const [error, setError] = useState(null);

	const execute = useCallback(async (txFunction) => {
		setStatus("pending");
		setError(null);
		setTxHash(null);
		setPendingStep("awaiting_approval");

		try {
			const tx = await txFunction();

			setTxHash(tx.hash);
			setPendingStep("confirming");

			await tx.wait();
			setStatus("success");
			setPendingStep("");
			return tx;
		} catch (err) {
			console.error("Transaction failed:", err);

			if (err.code === "ACTION_REJECTED" || err?.info?.error?.code === 4001 || err?.code === 4001) {
				setError("Action cancelled. You did not approve the request in your security portal.");
			} else {
				setError(parseError(err) || "The action failed to process. Please try again.");
			}
			setStatus("error");
			setPendingStep("");
			throw err;
		}
	}, []);

	const reset = useCallback(() => {
		setStatus("idle");
		setError(null);
		setTxHash(null);
		setPendingStep("");
	}, []);

	return { status, pendingStep, txHash, error, execute, reset };
}