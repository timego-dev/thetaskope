"use client"

import { Button } from "./ui/button"
import { WalletIcon, CopyIcon, ExternalLinkIcon, LogOutIcon, ChevronRightIcon, NetworkIcon } from "lucide-react"
import { useWallet } from "@/hooks/useWallet"
import { Separator } from "./ui/separator"
import { toast } from "sonner"

export function WalletPopup() {
  const { account, balance, network, disconnectWallet } = useWallet();

  const getNetworkIcon = (chainId: string) => {
    switch (chainId) {
      case '1':   return '🟢'; // Ethereum Mainnet
      case '5':   return '🟡'; // Goerli
      case '11155111': return '🟣'; // Sepolia
      case '137': return '🟣'; // Polygon
      case '80001': return '🟡'; // Mumbai
      default:    return '⚪';
    }
  };

  const copyAddress = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      toast.success("Address copied!", {
        description: `${account.slice(0, 6)}...${account.slice(-4)} copied to clipboard`,
        duration: 2000,
      });
    } catch {
      toast.error("Failed to copy", {
        description: "Could not access clipboard. Please copy the address manually.",
      });
    }
  };

  const EXPLORER_URLS: Record<string, string> = {
    '1': 'https://etherscan.io',
    '5': 'https://goerli.etherscan.io',
    '11155111': 'https://sepolia.etherscan.io',
    '137': 'https://polygonscan.com',
    '80001': 'https://mumbai.polygonscan.com',
    '56': 'https://bscscan.com',
    '43114': 'https://snowtrace.io',
  };

  const viewOnExplorer = () => {
    if (account && network) {
      const base = EXPLORER_URLS[network.chainId] ?? 'https://etherscan.io';
      window.open(`${base}/address/${account}`, '_blank');
    }
  };

  if (!account) return null;

  return (
    <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-background/100 shadow-lg">
      <div className="space-y-4 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/20 p-2">
              <WalletIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium">Connected</span>
              <span className="text-xs text-muted-foreground">MetaMask</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-destructive/20 hover:text-destructive"
            onClick={disconnectWallet}
          >
            <LogOutIcon className="h-4 w-4" />
          </Button>
        </div>

        <Separator className="my-2" />

        {/* Network and Balance */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Network</span>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${network?.chainId === '1' ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="font-medium text-sm">{network?.name}</span>
            </div>
          </div>
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getNetworkIcon(network?.chainId || '')}</span>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{network?.name}</span>
                <span className="text-xs text-muted-foreground">Chain ID: {network?.chainId}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-primary/20"
            >
              <NetworkIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Balance</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{balance} ETH</span>
              <span className="text-xs text-muted-foreground">≈ ${(parseFloat(balance) * 2000).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <Separator className="my-2" />

        {/* Address Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Address</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-primary/20"
                onClick={copyAddress}
                title="Copy address"
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-primary/20"
                onClick={viewOnExplorer}
                title="View on explorer"
              >
                <ExternalLinkIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between bg-muted rounded-lg p-2">
            <span className="text-sm font-mono">
              {`${account.slice(0, 6)}...${account.slice(-4)}`}
            </span>
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Quick Actions */}
        <Separator className="my-2" />

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="w-full">
            <span className="text-sm">Send</span>
          </Button>
          <Button variant="outline" size="sm" className="w-full">
            <span className="text-sm">Receive</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
