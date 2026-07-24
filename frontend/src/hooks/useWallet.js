import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ZKSYNC_SEPOLIA_CHAIN_ID, ZKSYNC_SEPOLIA_PARAMS } from "../config/network";
import { CONTRACTS } from "../config/contracts";

export function useWallet() {
	const [provider, setProvider] = useState(null);
	const [signer, setSigner] = useState(null);
	const [address, setAddress] = useState("");
	const [chainId, setChainId] = useState(null);
	const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(true);
	const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
	const [role, setRole] = useState({
		isGovernanceMember: false,
		isIssuer: false,
		tier: 0,
		isLoading: true,
		error: null,
	});

	// 1. Initialize provider and handle account/chain changes
	useEffect(() => {
		if (typeof window.ethereum !== "undefined") {
			setIsMetaMaskInstalled(true);
			const ethProvider = new ethers.BrowserProvider(window.ethereum);
			setProvider(ethProvider);

			const handleAccountsChanged = async (accounts) => {
				if (accounts.length > 0) {
					const freshAddress = accounts[0];
					setAddress(freshAddress);
					try {
						const freshSigner = await ethProvider.getSigner(freshAddress);
						setSigner(freshSigner);
					} catch (e) {
						console.error("Error fetching fresh signer:", e);
					}
				} else {
					setAddress("");
					setSigner(null);
				}
			};

			const handleChainChanged = async (newChainId) => {
				setChainId(newChainId);
				const isCorrect = newChainId.toLowerCase() === ZKSYNC_SEPOLIA_CHAIN_ID.toLowerCase();
				setIsCorrectNetwork(isCorrect);

				if (isCorrect && address) {
					try {
						const freshSigner = await ethProvider.getSigner(address);
						setSigner(freshSigner);
					} catch (e) {
						console.error("Error refreshing signer after chain change:", e);
					}
				}
			};

			window.ethereum.on("accountsChanged", handleAccountsChanged);
			window.ethereum.on("chainChanged", handleChainChanged);

			ethProvider.listAccounts().then(async (accounts) => {
				if (accounts.length > 0) {
					const initialAddress = accounts[0].address;
					setAddress(initialAddress);

					const initialSigner = await ethProvider.getSigner(initialAddress);
					setSigner(initialSigner);

					const network = await ethProvider.getNetwork();
					const currentChainId = "0x" + network.chainId.toString(16);
					setChainId(currentChainId);
					setIsCorrectNetwork(
						currentChainId.toLowerCase() === ZKSYNC_SEPOLIA_CHAIN_ID.toLowerCase()
					);
				} else {
					setRole(prev => ({ ...prev, isLoading: false }));
				}
			}).catch(err => {
				console.error("Initial connection check failed:", err);
				setRole(prev => ({ ...prev, isLoading: false, error: "Failed to connect to wallet." }));
			});

			return () => {
				window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
				window.ethereum.removeListener("chainChanged", handleChainChanged);
			};
		} else {
			setIsMetaMaskInstalled(false);
			setRole(prev => ({ ...prev, isLoading: false }));
		}
	}, []);

	useEffect(() => {
		const fetchRole = async () => {
			if (!address || !provider) {
				setRole({ isGovernanceMember: false, isIssuer: false, tier: 0, isLoading: false, error: null });
				return;
			}

			setRole((prev) => ({ ...prev, isLoading: true, error: null }));

			try {
				const governanceContract = new ethers.Contract(
					CONTRACTS.governanceBoard.address,
					CONTRACTS.governanceBoard.abi,
					provider
				);

				const [isGov, isIss, tierResult] = await Promise.all([
					governanceContract.isGovernanceMember(address),
					governanceContract.isActivatedIssuer(address),
					governanceContract.getIssuerTier(address).catch(() => 0)
				]);

				setRole({
					isGovernanceMember: isGov,
					isIssuer: isIss,
					tier: Number(tierResult),
					isLoading: false,
					error: null,
				});

			} catch (error) {
				console.error("Error fetching role:", error);
				setRole({
					isGovernanceMember: false,
					isIssuer: false,
					tier: 0,
					isLoading: false,
					error: "Failed to verify permissions. Please check your connection.",
				});
			}
		};

		fetchRole();
	}, [address, provider]);

	const connect = useCallback(async () => {
		if (!window.ethereum) return;
		try {
			const ethProvider = new ethers.BrowserProvider(window.ethereum);
			const accounts = await ethProvider.send("eth_requestAccounts", []);
			const ethSigner = await ethProvider.getSigner(accounts[0]);

			setAddress(accounts[0]);
			setSigner(ethSigner);

			const network = await ethProvider.getNetwork();
			const hexChainId = "0x" + network.chainId.toString(16);
			setChainId(hexChainId);
			setIsCorrectNetwork(
				hexChainId.toLowerCase() === ZKSYNC_SEPOLIA_CHAIN_ID.toLowerCase()
			);
		} catch (error) {
			console.error("Connection error:", error);
		}
	}, []);

	const switchNetwork = useCallback(async () => {
		if (!window.ethereum) return;
		try {
			await window.ethereum.request({
				method: "wallet_switchEthereumChain",
				params: [{ chainId: ZKSYNC_SEPOLIA_CHAIN_ID }],
			});
		} catch (switchError) {
			if (switchError.code === 4902) {
				try {
					await window.ethereum.request({
						method: "wallet_addEthereumChain",
						params: [ZKSYNC_SEPOLIA_PARAMS],
					});
				} catch (addError) {
					console.error("Error adding network:", addError);
				}
			} else {
				console.error("Error switching network:", switchError);
			}
		}
	}, []);

	const disconnect = useCallback(() => {
		setAddress("");
		setSigner(null);
		setRole({ isGovernanceMember: false, isIssuer: false, tier: 0, isLoading: false, error: null });
	}, []);

	return {
		provider,
		signer,
		address,
		isMetaMaskInstalled,
		isCorrectNetwork,
		role,
		connect,
		disconnect,
		switchNetwork,
	};
}