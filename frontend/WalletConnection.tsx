import { useState, useEffect } from 'react';
import { AptosWalletAdapterProvider, useWallet } from '@aptos-labs/wallet-adapter-react';
import { Toaster, toast } from 'react-hot-toast';

// Add window type for Petra wallet
declare global {
  interface Window {
    petra?: any;
  }
}

// Define approval credential types
interface WalletApprovalCredentials {
  address: string;
  publicKey: string;
  permissions: string[];
  network: string;
  timestamp: number;
}

interface ConnectionMetadata {
  dappName: string;
  dappUrl: string;
  iconUrl?: string;
  permissions: string[];
}

export function WalletConnection() {
  const { connect, account, connected, disconnect, network } = useWallet();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<WalletApprovalCredentials | null>(null);

  // Connection metadata for the dApp
  const connectionMetadata: ConnectionMetadata = {
    dappName: "Pharma Supply Chain",
    dappUrl: window.location.origin,
    permissions: [
      "view_account",
      "sign_transaction",
      "sign_message",
      "view_balance"
    ]
  };

  useEffect(() => {
    // Check if Petra wallet is installed and verify previous credentials
    const checkWalletAvailability = async () => {
      if (typeof window.petra === 'undefined') {
        setError('Petra wallet is not installed. Please install it first.');
        return;
      }

      // Check for stored credentials
      const storedCredentials = localStorage.getItem('walletCredentials');
      if (storedCredentials) {
        try {
          const parsed = JSON.parse(storedCredentials) as WalletApprovalCredentials;
          // Verify if credentials are still valid (24 hour expiry)
          if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            setCredentials(parsed);
          } else {
            // Clear expired credentials
            localStorage.removeItem('walletCredentials');
          }
        } catch (e) {
          console.error('Failed to parse stored credentials:', e);
          localStorage.removeItem('walletCredentials');
        }
      }
    };

    checkWalletAvailability();
  }, []);

  // Track connection approval state
  const [isApprovalPending, setIsApprovalPending] = useState(false);
  const [approvalTimeout, setApprovalTimeout] = useState<NodeJS.Timeout | null>(null);

  // Handle wallet connection approval
  // Define custom wallet credentials
  const MY_WALLET_CREDENTIALS = {
    walletAddress: "YOUR_WALLET_ADDRESS", // Replace with your actual wallet address
    accessToken: "YOUR_ACCESS_TOKEN", // Replace with your access token
    apiKey: "YOUR_API_KEY", // Replace with your API key
    permissions: [
      "EXECUTE_TRANSACTIONS",
      "VIEW_BALANCE",
      "MANAGE_SUPPLY_CHAIN",
      "ADMIN_ACCESS"
    ],
    expiryTime: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year from now
  };

  // State for access control
  const [hasAccess, setHasAccess] = useState(false);
  const [accessLevel, setAccessLevel] = useState<'admin' | 'user' | 'none'>('none');

  // Verify wallet access
  const verifyWalletAccess = async (address: string): Promise<boolean> => {
    try {
      // Check if the address matches your credentials
      const isAuthorized = address.toLowerCase() === MY_WALLET_CREDENTIALS.walletAddress.toLowerCase();
      
      if (isAuthorized && Date.now() < MY_WALLET_CREDENTIALS.expiryTime) {
        setHasAccess(true);
        setAccessLevel('admin');
        return true;
      }
      
      setHasAccess(false);
      setAccessLevel('none');
      return false;
    } catch (error) {
      console.error('Error verifying wallet access:', error);
      return false;
    }
  };

  const handleConnect = async () => {
    if (error) {
      toast.error(error);
      return;
    }

    try {
      setConnecting(true);
      setError(null);
      setIsApprovalPending(true);
      
      // Verify wallet installation and network
      if (typeof window.petra === 'undefined') {
        throw new Error('Petra wallet is not installed');
      }

      // Show waiting for approval toast
      const approvalToast = toast.loading('Waiting for wallet approval...', {
        duration: Infinity // Keep showing until we get a response
      });

      // Set a timeout for the approval
      const timeout = setTimeout(() => {
        if (isApprovalPending) {
          toast.dismiss(approvalToast);
          toast.error('Connection approval timed out. Please try again.');
          setIsApprovalPending(false);
          setConnecting(false);
        }
      }, 30000); // 30 seconds timeout

      setApprovalTimeout(timeout);

      // Request wallet connection with metadata
      await connect("petra");
      
      // Get account information after connection
      if (account) {
        // Verify wallet access
        const isAuthorized = await verifyWalletAccess(account.address.toString());
        
        if (!isAuthorized) {
          throw new Error('Unauthorized wallet address');
        }

        // Create approval credentials
        const newCredentials: WalletApprovalCredentials = {
          address: account.address.toString(),
          publicKey: account.publicKey?.toString() || '',
          permissions: [...connectionMetadata.permissions, ...MY_WALLET_CREDENTIALS.permissions],
          network: network?.name || 'unknown',
          timestamp: Date.now()
        };

        // Store credentials
        setCredentials(newCredentials);
        localStorage.setItem('walletCredentials', JSON.stringify(newCredentials));

        // Log connection details securely
        console.info('Wallet connected with credentials:', {
          address: newCredentials.address,
          network: newCredentials.network,
          permissions: newCredentials.permissions,
          timestamp: new Date(newCredentials.timestamp).toISOString()
        });
      }

      // Clear the timeout since we got a response
      clearTimeout(timeout);
      toast.dismiss(approvalToast);

      // Show detailed success message
      toast.success(
        <div className="flex flex-col">
          <span>Wallet connected successfully!</span>
          <span className="text-xs mt-1">
            Permissions granted: {connectionMetadata.permissions.join(', ')}
          </span>
        </div>,
        {
          icon: '🔗',
          duration: 5000
        }
      );

      // Store connection info with metadata
      localStorage.setItem('walletConnection', JSON.stringify({
        wallet: 'petra',
        connectionTime: new Date().toISOString(),
        dapp: connectionMetadata.dappName,
        permissions: connectionMetadata.permissions
      }));

    } catch (error) {
      let errorMessage = 'Failed to connect wallet';
      
      if (error instanceof Error) {
        // Handle specific error cases
        if (error.message.includes('User rejected')) {
          errorMessage = 'Connection rejected by user';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Connection timed out';
        } else if (error.message.includes('already connected')) {
          errorMessage = 'Wallet is already connected';
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
      toast.error(errorMessage, {
        icon: '❌',
        duration: 4000
      });
      console.error('Wallet connection error:', {
        error,
        timestamp: new Date().toISOString(),
        walletType: 'petra'
      });

    } finally {
      // Clean up
      setConnecting(false);
      setIsApprovalPending(false);
      if (approvalTimeout) {
        clearTimeout(approvalTimeout);
      }
    }
  };

  // Handle wallet disconnection
  const [disconnecting, setDisconnecting] = useState(false);
  
  const handleDisconnect = async () => {
    if (!connected || !account) {
      toast.error('No wallet is connected');
      return;
    }

    try {
      setDisconnecting(true);
      
      // Save the wallet address for the toast message
      const walletAddress = formatAddress(account.address.toString());
      
      // Get current credentials before disconnecting
      const currentCredentials = credentials;
      
      // Attempt to disconnect
      await disconnect();
      
      // Clear states
      setError(null);
      setCredentials(null);
      
      // Clear all stored wallet data
      localStorage.removeItem('walletConnection');
      localStorage.removeItem('walletCredentials');
      
      // Log revoked permissions
      if (currentCredentials) {
        console.info('Wallet permissions revoked:', {
          address: currentCredentials.address,
          permissions: currentCredentials.permissions,
          disconnectionTime: new Date().toISOString()
        });
      }
      
      // Show detailed success message
      toast.success(
        <div className="flex flex-col">
          <span>Wallet {walletAddress} disconnected successfully!</span>
          <span className="text-xs mt-1">All permissions have been revoked</span>
        </div>,
        {
          duration: 4000,
          icon: '👋'
        }
      );
      
    } catch (error) {
      // Handle specific error types
      let errorMessage = 'Failed to disconnect wallet';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle specific error cases
        if (error.message.includes('User rejected')) {
          errorMessage = 'User rejected disconnection';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Connection timed out while disconnecting';
        }
      }
      
      // Set error state
      setError(errorMessage);
      
      // Show error toast
      toast.error(`Disconnection failed: ${errorMessage}`, {
        duration: 5000,
        icon: '⚠️'
      });
      
      // Log detailed error
      console.error('Wallet disconnection error:', {
        error,
        walletAddress: account?.address.toString(),
        timestamp: new Date().toISOString()
      });
      
    } finally {
      setDisconnecting(false);
      setConnecting(false);
    }
  };

  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="relative">
      <Toaster position="top-right" />
      {connected && account ? (
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
            <span className="text-sm text-gray-600">
              {formatAddress(account.address.toString())}
            </span>
            <span className="text-xs text-gray-500">
              {network?.name || 'Unknown Network'}
            </span>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
          >
            {disconnecting ? (
              <>
                <span className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin mr-2"></span>
                <span>Disconnecting...</span>
              </>
            ) : (
              'Disconnect'
            )}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-start">
          <button
            onClick={handleConnect}
            disabled={connecting || isApprovalPending || !!error}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[150px]"
          >
            {isApprovalPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                <span>Approve in Wallet...</span>
              </>
            ) : connecting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Connect Wallet
              </>
            )}
          </button>
          {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
        </div>
      )}
    </div>
  );
}

interface WalletContextProviderProps {
  children: React.ReactNode;
}

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  return (
    <AptosWalletAdapterProvider>
      {children}
    </AptosWalletAdapterProvider>
  );
}
