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
            // ALWAYS fetch a fresh signer matching the newly selected account
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

      const handleChainChanged = () => {
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      // Check initial connection
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
        }
      });

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    } else {
      setIsMetaMaskInstalled(false);
    }
  }, []);

  // 2. Fetch role whenever address or provider changes
  useEffect(() => {
    const fetchRole = async () => {
      if (!address || !provider) {
        setRole({ isGovernanceMember: false, isIssuer: false, tier: 0, isLoading: false });
        return;
      }

      setRole((prev) => ({ ...prev, isLoading: true }));
      try {
        const governanceContract = new ethers.Contract(
          CONTRACTS.governanceBoard.address,
          CONTRACTS.governanceBoard.abi,
          provider
        );

        let isGov = false;
        let isIss = false;
        let tier = 0;

        try {
          isGov = await governanceContract.isGovernanceMember(address);
        } catch (e) { /* ignore */ }

        try {
          isIss = await governanceContract.isActivatedIssuer(address);
        } catch (e) { /* ignore */ }

        try {
          tier = await governanceContract.getIssuerTier(address);
          tier = Number(tier);
        } catch (e) { /* ignore */ }

        setRole({
          isGovernanceMember: isGov,
          isIssuer: isIss,
          tier: tier,
          isLoading: false,
        });
      } catch (error) {
        console.error("Error fetching role:", error);
        setRole({ isGovernanceMember: false, isIssuer: false, tier: 0, isLoading: false });
      }
    };

    fetchRole();
  }, [address, provider]);

  // 3. Connect Wallet
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

  // 4. Switch Network
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

  // 5. Disconnect
  const disconnect = useCallback(() => {
    setAddress("");
    setSigner(null);
    setRole({ isGovernanceMember: false, isIssuer: false, tier: 0, isLoading: false });
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