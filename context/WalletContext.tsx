"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ethers } from "ethers";

// ─── Types ─────────────────────────────────────────────────────────────────

interface NetworkInfo {
  chainId: string;
  name: string;
}

interface WalletContextValue {
  /** Whether MetaMask is detected in the browser */
  isMetaMaskInstalled: boolean;
  /** The connected wallet address, or null when disconnected */
  account: string | null;
  /** ETH balance formatted to 4 decimal places */
  balance: string;
  /** Current connected network info */
  network: NetworkInfo | null;
  /** ethers.js Web3Provider wrapping MetaMask */
  provider: ethers.providers.Web3Provider | null;
  /** ethers.js JsonRpcSigner for the connected account */
  signer: ethers.providers.JsonRpcSigner | null;
  /** True while the MetaMask approval popup is open */
  isConnecting: boolean;
  /** Last error message, or null */
  error: string | null;
  /** Whether the wallet info dropdown is visible */
  isOpen: boolean;
  connectWallet: () => Promise<void>;
  /** Calls wallet_revokePermissions — truly disconnects at the MetaMask level */
  disconnectWallet: () => Promise<void>;
  toggleWalletMenu: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (
        event: string,
        handler: (...args: unknown[]) => void,
      ) => void;
    };
  }
}

const KNOWN_NETWORKS: Record<number, string> = {
  1: "Ethereum Mainnet",
  5: "Goerli Testnet",
  11155111: "Sepolia Testnet",
  137: "Polygon Mainnet",
  80001: "Mumbai Testnet",
  56: "BNB Smart Chain",
  43114: "Avalanche C-Chain",
};

function makeProvider(): ethers.providers.Web3Provider | null {
  if (typeof window === "undefined" || !window.ethereum) return null;
  return new ethers.providers.Web3Provider(
    window.ethereum as ethers.providers.ExternalProvider,
    "any",
  );
}

async function resolveNetworkInfo(
  provider: ethers.providers.Web3Provider,
): Promise<NetworkInfo> {
  const { chainId, name } = await provider.getNetwork();
  return {
    chainId: chainId.toString(),
    name:
      KNOWN_NETWORKS[chainId] ??
      (name !== "unknown" ? name : `Chain ${chainId}`),
  };
}

async function resolveBalance(
  provider: ethers.providers.Web3Provider,
  address: string,
): Promise<string> {
  const raw = await provider.getBalance(address);
  return parseFloat(ethers.utils.formatEther(raw)).toFixed(4);
}

// ─── Context ───────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState("0");
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [provider, setProvider] =
    useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.providers.JsonRpcSigner | null>(
    null,
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Fire-and-forget: POST the wallet address to the Express backend so it gets
   * persisted in MongoDB.  Errors are logged but never surface to the user.
   */
  async function saveWalletAddressToDb(address: string): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/api/v1/wallet/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn("[WalletContext] saveWalletAddressToDb failed:", data);
      }
    } catch (err) {
      console.warn("[WalletContext] saveWalletAddressToDb network error:", err);
    }
  }

  /** Clear all wallet state setters in one call. */
  const clearWalletState = () => {
    setAccount(null);
    setBalance("0");
    setNetwork(null);
    setProvider(null);
    setSigner(null);
    setIsOpen(false);
  };

  // ── Refresh helpers ────────────────────────────────────────────────────

  const refreshState = useCallback(
    async (ethersProvider: ethers.providers.Web3Provider, address: string) => {
      const [bal, net] = await Promise.all([
        resolveBalance(ethersProvider, address),
        resolveNetworkInfo(ethersProvider),
      ]);
      setBalance(bal);
      setNetwork(net);
    },
    [],
  );

  // ── On mount: detect MetaMask and restore session if still connected ────
  //
  // After wallet_revokePermissions the site loses eth_accounts permission, so
  // listAccounts() returns [] — no localStorage flag needed.

  useEffect(() => {
    setIsMetaMaskInstalled(!!window.ethereum?.isMetaMask);

    const init = async () => {
      const ethersProvider = makeProvider();
      if (!ethersProvider) return;
      try {
        // Does NOT prompt — returns [] if permission was previously revoked
        const accounts = await ethersProvider.listAccounts();
        if (accounts.length > 0) {
          const address = accounts[0];
          const walletSigner = ethersProvider.getSigner();
          setProvider(ethersProvider);
          setSigner(walletSigner);
          setAccount(address);
          await refreshState(ethersProvider, address);
        }
      } catch (err) {
        console.error("[WalletContext] init error:", err);
      }
    };

    init();
  }, [refreshState]);

  // ── MetaMask event listeners ────────────────────────────────────────────

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (rawAccounts: unknown) => {
      const accounts = rawAccounts as string[];
      if (accounts.length === 0) {
        clearWalletState();
      } else {
        const ethersProvider = makeProvider()!;
        const address = accounts[0];
        setAccount(address);
        setProvider(ethersProvider);
        setSigner(ethersProvider.getSigner());
        await refreshState(ethersProvider, address);
      }
    };

    const handleChainChanged = async () => {
      // ethers.js recommends recreating the provider on chain change
      const ethersProvider = makeProvider();
      if (!ethersProvider) return;
      setProvider(ethersProvider);
      setSigner(ethersProvider.getSigner());
      const accounts = await ethersProvider.listAccounts();
      if (accounts.length > 0) {
        await refreshState(ethersProvider, accounts[0]);
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [refreshState]);

  // ── Public actions ─────────────────────────────────────────────────────

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install it from metamask.io");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ethersProvider = new ethers.providers.Web3Provider(
        window.ethereum as ethers.providers.ExternalProvider,
        "any",
      );

      // Triggers the MetaMask approval popup
      await ethersProvider.send("eth_requestAccounts", []);

      const walletSigner = ethersProvider.getSigner();
      const address = await walletSigner.getAddress();

      setProvider(ethersProvider);
      setSigner(walletSigner);
      setAccount(address);
      await refreshState(ethersProvider, address);
      setIsOpen(true);

      // Persist the wallet address to the database (fire-and-forget —
      // a failure here should never block the user from using the app)
      saveWalletAddressToDb(address);
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code === 4001) {
        setError("Connection rejected. Please approve the MetaMask request.");
      } else {
        setError("Failed to connect wallet. Please try again.");
      }
      console.error("[WalletContext] connectWallet error:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [refreshState]);

  const disconnectWallet = useCallback(async () => {
    if (provider) {
      try {
        // provider.send() is the ethers.js API for arbitrary JSON-RPC calls.
        // wallet_revokePermissions revokes the site's eth_accounts access at
        // the MetaMask level.  After this:
        //   • listAccounts() returns []  → no auto-connect on refresh
        //   • eth_requestAccounts shows the full approval popup again
        // MetaMask will also fire accountsChanged with [] automatically.
        await provider.send("wallet_revokePermissions", [{ eth_accounts: {} }]);
      } catch (err) {
        // wallet_revokePermissions is supported in MetaMask ≥ v11.
        // For older versions we fall through and just clear local state.
        console.warn(
          "[WalletContext] wallet_revokePermissions not supported:",
          err,
        );
      }
    }
    // Clear React state eagerly (the accountsChanged event does the same, but
    // clearing immediately gives instant UI feedback).
    clearWalletState();
  }, [provider]);

  const toggleWalletMenu = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        isMetaMaskInstalled,
        account,
        balance,
        network,
        provider,
        signer,
        isConnecting,
        error,
        isOpen,
        connectWallet,
        disconnectWallet,
        toggleWalletMenu,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

// ─── Consumer hook ─────────────────────────────────────────────────────────

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWalletContext must be used inside <WalletProvider>");
  }
  return ctx;
}
