/**
 * useWallet – thin consumer of WalletContext.
 *
 * All wallet state is now centralised in context/WalletContext.tsx, which
 * uses ethers.js (v5) under the hood.  Importing this hook is equivalent to
 * calling useWalletContext() and gives the same API that Header and
 * WalletPopup already expect.
 */
export { useWalletContext as useWallet } from "@/context/WalletContext";
