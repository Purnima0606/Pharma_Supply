import { useState, useEffect } from 'react';
import { AptosWalletAdapterProvider, useWallet } from '@aptos-labs/wallet-adapter-react';
import { Toaster, toast } from 'react-hot-toast';

// Security utility functions
const generateSessionToken = async (): Promise<string> => {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const hashBuffer = await crypto.subtle.digest('SHA-256', randomBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const getDeviceFingerprint = async (): Promise<string> => {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset().toString(),
    screen.width.toString(),
    screen.height.toString(),
    (navigator.hardwareConcurrency || 0).toString()
  ];
  const encoder = new TextEncoder();
  const data = encoder.encode(components.join('|'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const fetchIPAddress = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Failed to fetch IP address:', error);
    return 'unknown';
  }
};

// Add window type for Petra wallet
declare global {
  interface Window {
    petra?: any;
  }
}

// Define security types and interfaces
// Supply Chain State Types
interface SupplyChainMetrics {
  totalProducts: number;
  compliantProducts: number;
  inTransitProducts: number;
  nonCompliantProducts: number;
}

interface WalletApprovalCredentials {
  address: string;
  publicKey: string;
  permissions: string[];
  network: string;
  timestamp: number;
  securityLevel: 'high' | 'medium' | 'low';
  lastActivityTimestamp: number;
  deviceId: string;
  ipAddress: string;
  sessionToken: string;
}

interface ConnectionMetadata {
  dappName: string;
  dappUrl: string;
  iconUrl?: string;
  permissions: string[];
  version: string;
  requiredSecurityLevel: 'high' | 'medium' | 'low';
}

export function WalletConnection() {
  const { connect, account, connected, disconnect, network, signAndSubmitTransaction } = useWallet();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<WalletApprovalCredentials | null>(null);

  // Simple connect function for basic connectivity
  const handleSimpleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      
      if (typeof window.petra === 'undefined') {
        window.open('https://petra.app/', '_blank');
        throw new Error('Please install Petra wallet first');
      }

      await connect("petra");
      toast.success('Successfully connected to wallet!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      toast.error(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  const [metrics, setMetrics] = useState<SupplyChainMetrics>({
    totalProducts: 0,
    compliantProducts: 0,
    inTransitProducts: 0,
    nonCompliantProducts: 0
  });

  // Effect to check session status
  useEffect(() => {
    if (credentials) {
      const checkSession = () => {
        const now = Date.now();
        const sessionTimeout = 30 * 60 * 1000; // 30 minutes
        
        if (now - credentials.lastActivityTimestamp > sessionTimeout) {
          handleDisconnect();
        }
      };

      const interval = setInterval(checkSession, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [credentials]);

  // Connection metadata for the dApp
  const connectionMetadata: ConnectionMetadata = {
    dappName: "Pharma Supply Chain",
    dappUrl: window.location.origin,
    permissions: [
      "view_account",
      "sign_transaction",
      "sign_message",
      "view_balance"
    ],
    version: "1.0.0",
    requiredSecurityLevel: "high"
  };

  // Define custom wallet credentials
  // Enhanced security credentials with role-based access control
  interface SecurityCredentials {
    walletAddress: string;
    accessToken: string;
    apiKey: string;
    securityLevel: string;
    maxRetries: number;
    timeoutDuration: number;
    permissions: string[];
    roles: string[];
    ipWhitelist: string[];
    expiryTime: number;
    lastLoginTimestamp: number | null;
    failedAttempts: number;
  }

  const MY_WALLET_CREDENTIALS: SecurityCredentials = {
    walletAddress: "0x19d3828d73b632f813cdc5c3ef2823268b7001011992a003cb0ca02916a2021b",
    accessToken: process.env.VITE_ACCESS_TOKEN || "pharma_access_token",
    apiKey: process.env.VITE_API_KEY || "pharma_api_key",
    securityLevel: "high",
    maxRetries: 3,
    timeoutDuration: 30000, // 30 seconds
    permissions: [
      "EXECUTE_TRANSACTIONS",
      "VIEW_BALANCE",
      "MANAGE_SUPPLY_CHAIN",
      "ADMIN_ACCESS"
    ],
    roles: ["ADMIN", "MANUFACTURER"],
    ipWhitelist: process.env.VITE_IP_WHITELIST?.split(',') || [],
    expiryTime: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year from now
    lastLoginTimestamp: null,
    failedAttempts: 0
  };

  // State for access control
  const [accessLevel, setAccessLevel] = useState<'admin' | 'user' | 'none'>('none');
  const [isApprovalPending, setIsApprovalPending] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Enhanced wallet access verification with security checks
  const verifyWalletAccess = async (address: string): Promise<boolean> => {
    try {
      // Check if the wallet is locked out due to too many failed attempts
      if (MY_WALLET_CREDENTIALS.failedAttempts >= MY_WALLET_CREDENTIALS.maxRetries) {
        const lockoutTime = 15 * 60 * 1000; // 15 minutes
        const lastAttempt = MY_WALLET_CREDENTIALS.lastLoginTimestamp || 0;
        
        if (Date.now() - lastAttempt < lockoutTime) {
          throw new Error('Account temporarily locked due to too many failed attempts');
        }
        // Reset failed attempts after lockout period
        MY_WALLET_CREDENTIALS.failedAttempts = 0;
      }

      // Basic address verification
      const isAuthorized = address.toLowerCase() === MY_WALLET_CREDENTIALS.walletAddress.toLowerCase();
      
      if (!isAuthorized) {
        MY_WALLET_CREDENTIALS.failedAttempts++;
        MY_WALLET_CREDENTIALS.lastLoginTimestamp = Date.now();
        setAccessLevel('none');
        return false;
      }

      // Additional security checks
      const isNotExpired = Date.now() < MY_WALLET_CREDENTIALS.expiryTime;
      const hasValidRole = MY_WALLET_CREDENTIALS.roles.includes('ADMIN');

      if (isAuthorized && isNotExpired && hasValidRole) {
        // Reset security counters on successful auth
        MY_WALLET_CREDENTIALS.failedAttempts = 0;
        MY_WALLET_CREDENTIALS.lastLoginTimestamp = Date.now();
        setAccessLevel('admin');
        
        // Log successful access
        console.info('Secure wallet access granted:', {
          timestamp: new Date().toISOString(),
          address: address.slice(0, 6) + '...' + address.slice(-4),
          roles: MY_WALLET_CREDENTIALS.roles,
          network: network?.name
        });
        
        return true;
      }
      
      setAccessLevel('none');
      return false;
    } catch (error) {
      console.error('Error verifying wallet access:', error);
      setError(error instanceof Error ? error.message : 'Wallet verification failed');
      return false;
    }
  };

  // Function to update supply chain metrics
  const handleSupplyChainTransaction = async () => {
    if (!connected || !account || !signAndSubmitTransaction) {
      toast.error('Wallet not connected');
      return;
    }

    try {
      // Show transaction pending toast
      const pendingToast = toast.loading('Processing transaction...', {
        duration: Infinity
      });

      // Create and submit transaction
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: `${account.address}::pharma::add_product`,
          typeArguments: [],
          functionArguments: [
            `Product_${Date.now()}`,
            "COMPLIANT",
            Date.now().toString()
          ]
        }
      });
      
      // Wait for transaction confirmation
      if (response) {
        // Update metrics
        setMetrics(prev => ({
          ...prev,
          totalProducts: prev.totalProducts + 1,
          compliantProducts: prev.compliantProducts + 1
        }));

        // Show success message
        toast.dismiss(pendingToast);
        toast.success('Product added successfully!', {
          icon: '✅',
          duration: 5000
        });

        // Log transaction
        console.info('Transaction successful:', {
          hash: response.hash,
          sender: account.address,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Transaction failed:', error);
      toast.error('Transaction failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleConnect = async () => {
    if (error) {
      toast.error(error);
      return;
    }

    let approvalToast: string | undefined;

    try {
      setConnecting(true);
      setError(null);
      setIsApprovalPending(true);
      
      // Check if Petra wallet is installed
      if (typeof window.petra === 'undefined') {
        window.open('https://petra.app/', '_blank');
        throw new Error('Petra wallet is not installed. Please install Petra wallet and try again.');
      }

      approvalToast = toast.loading('Waiting for wallet approval...', {
        duration: Infinity
      });

      await connect("petra");
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (approvalToast) {
        toast.dismiss(approvalToast);
      }

      if (!account) {
        throw new Error('Failed to get account information');
      }

      const address = account.address.toString();
      const isAuthorized = await verifyWalletAccess(address);
      
      if (!isAuthorized) {
        await disconnect();
        toast.error('Unauthorized wallet address. Access denied.');
        setConnecting(false);
        setIsApprovalPending(false);
        return;
      }

      // Generate secure session token
      const sessionToken = await generateSessionToken();
      const deviceId = await getDeviceFingerprint();
      const ipAddress = await fetchIPAddress();

      const newCredentials: WalletApprovalCredentials = {
        address: address,
        publicKey: account.publicKey?.toString() || '',
        permissions: [...connectionMetadata.permissions, ...MY_WALLET_CREDENTIALS.permissions],
        network: network?.name || 'unknown',
        timestamp: Date.now(),
        securityLevel: connectionMetadata.requiredSecurityLevel,
        lastActivityTimestamp: Date.now(),
        deviceId: deviceId,
        ipAddress: ipAddress,
        sessionToken: sessionToken
      };

      setCredentials(newCredentials);
      localStorage.setItem('walletCredentials', JSON.stringify(newCredentials));

      toast.success(
        `Wallet connected successfully! (${accessLevel} access)`,
        {
          icon: '🔗',
          duration: 5000,
          style: {
            borderLeft: '4px solid #10B981'
          }
        }
      );

      toast(
        `Permissions: ${newCredentials.permissions.join(', ')}`,
        {
          icon: '🔑',
          duration: 7000
        }
      );

    } catch (error) {
      let errorMessage = 'Failed to connect wallet';
      
      if (error instanceof Error) {
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

    } finally {
      setConnecting(false);
      setIsApprovalPending(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connected || !account) {
      toast.error('No wallet is connected');
      return;
    }

    try {
      setDisconnecting(true);
      const walletAddress = account.address.toString().slice(0, 6) + '...' + account.address.toString().slice(-4);
      
      await disconnect();
      
      setError(null);
      setCredentials(null);
      setAccessLevel('none');
      
      localStorage.removeItem('walletConnection');
      localStorage.removeItem('walletCredentials');
      
      toast.success(
        `Wallet ${walletAddress} disconnected successfully!`,
        {
          duration: 4000,
          icon: '👋'
        }
      );
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect wallet';
      setError(errorMessage);
      toast.error(`Disconnection failed: ${errorMessage}`, {
        duration: 5000,
        icon: '⚠️'
      });
      
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="relative">
      <Toaster position="top-right" />
      {connected && account ? (
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">
                {account.address.toString().slice(0, 6)}...{account.address.toString().slice(-4)}
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

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleSupplyChainTransaction()}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Add Product
            </button>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Supply Chain Metrics</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Total Products: {metrics.totalProducts}</div>
                <div>Compliant: {metrics.compliantProducts}</div>
                <div>In Transit: {metrics.inTransitProducts}</div>
                <div>Non-Compliant: {metrics.nonCompliantProducts}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start">
          <button
            onClick={handleSimpleConnect}
            disabled={connecting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[150px]"
          >
            {connecting ? (
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

export function WalletContextProvider({ children }: { children: React.ReactNode }) {
  return (
    <AptosWalletAdapterProvider>
      {children}
    </AptosWalletAdapterProvider>
  );
}
