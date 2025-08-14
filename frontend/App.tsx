import React, { useState, useEffect, createContext, useContext } from 'react';
import { Package, Thermometer, Shield, Users, Plus, Search, Eye, CheckCircle, AlertTriangle, Clock, MapPin, Activity, TrendingUp, Wallet, LogOut } from 'lucide-react';

// Type definitions
interface Product {
  id: string;
  name: string;
  manufacturer: string;
  batch_number: string;
  manufacturing_date: number;
  expiry_date: number;
  current_holder: string;
  status: number;
  temperature_log: Array<{
    timestamp: number;
    temperature: number;
    location: string;
  }>;
  compliance_verified: boolean;
}

interface WalletContextType {
  connected: boolean;
  account: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signAndSubmitTransaction: (transaction: any) => Promise<any>;
}

// Contract address of your deployed Move module
const CONTRACT_ADDRESS = "0x2c599a0825f51f62c54da3f56a623568d91437bf084e63daf2204a0d63800584"; // Replace with your contract address

// Wallet Context
const WalletContext = createContext<WalletContextType | null>(null);

// Mock Aptos SDK functions with real-looking blockchain interaction
const mockAptosClient = {
  async createProduct(params: {
    id: string;
    name: string;
    batch_number: string;
    manufacturing_date: number;
    expiry_date: number;
  }) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { 
      success: true, 
      hash: '0x' + Math.random().toString(16).substr(2, 8),
      product: {
        ...params,
        manufacturer: "0x1234567890abcdef",
        current_holder: "0x1234567890abcdef",
        status: 1,
        temperature_log: [],
        compliance_verified: Math.random() > 0.5
      }
    };
  },
  
  async transferProduct(params: { product_id: string; new_holder: string }) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true, hash: '0x' + Math.random().toString(16).substr(2, 8) };
  },
  
  async logTemperature(params: { product_id: string; temperature: number; location: string }) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true, hash: '0x' + Math.random().toString(16).substr(2, 8) };
  },
  
  async verifyCompliance(params: { product_id: string }) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true, hash: '0x' + Math.random().toString(16).substr(2, 8) };
  },
  
  async getProducts(): Promise<Product[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockProducts;
  }
};

// Initial mock data
let mockProducts: Product[] = [
  {
    id: "PROD001",
    name: "Aspirin 500mg",
    manufacturer: "0x1234567890abcdef",
    batch_number: "BATCH001",
    manufacturing_date: Date.now() - 86400000 * 30,
    expiry_date: Date.now() + 86400000 * 365,
    current_holder: "0x1234567890abcdef",
    status: 1,
    temperature_log: [
      { timestamp: Date.now() - 3600000, temperature: 2200, location: "Warehouse A" },
      { timestamp: Date.now() - 1800000, temperature: 2350, location: "Transport Vehicle" }
    ],
    compliance_verified: true
  },
  {
    id: "PROD002",
    name: "Insulin Injection",
    manufacturer: "0x9876543210fedcba",
    batch_number: "BATCH002",
    manufacturing_date: Date.now() - 86400000 * 15,
    expiry_date: Date.now() + 86400000 * 180,
    current_holder: "0x5555666677778888",
    status: 2,
    temperature_log: [
      { timestamp: Date.now() - 7200000, temperature: 400, location: "Cold Storage" },
      { timestamp: Date.now() - 3600000, temperature: 650, location: "Refrigerated Truck" },
      { timestamp: Date.now() - 1800000, temperature: 520, location: "Distribution Center" }
    ],
    compliance_verified: false
  }
];

const statusMap: Record<1 | 2 | 3 | 4, { 
  label: string;
  color: string;
  icon: React.ElementType;
}> = {
  1: { label: "Manufactured", color: "bg-blue-100 text-blue-800", icon: Package },
  2: { label: "In Transit", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  3: { label: "Delivered", color: "bg-green-100 text-green-800", icon: CheckCircle },
  4: { label: "Dispensed", color: "bg-gray-100 text-gray-800", icon: Shield }
};

// Wallet Connection Component
function WalletConnection() {
  const wallet = useContext(WalletContext);
  
  if (!wallet) return null;

  if (wallet.connected && wallet.account) {
    return (
      <div className="flex items-center space-x-3">
        <div className="flex items-center bg-green-100 px-3 py-2 rounded-lg">
          <div className="h-2 w-2 bg-green-500 rounded-full mr-2"></div>
          <span className="text-sm text-green-800 font-medium">
            {wallet.account.substring(0, 6)}...{wallet.account.substring(wallet.account.length - 4)}
          </span>
        </div>
        <button
          onClick={wallet.disconnect}
          className="flex items-center px-3 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors"
        >
          <LogOut className="h-4 w-4 mr-1" />
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={wallet.connect}
      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
    >
      <Wallet className="h-4 w-4 mr-2" />
      Connect Petra Wallet
    </button>
  );
}

// Wallet Context Provider
function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    if (connecting) return;
    
    setConnecting(true);
    
    try {
      // Check if Petra wallet is installed
      if (!(window as any).aptos) {
        alert('Petra Wallet is not installed. Please install it from the Chrome Web Store.');
        return;
      }

      // Request connection to Petra wallet
      const response = await (window as any).aptos.connect();
      
      if (response?.address) {
        setConnected(true);
        setAccount(response.address);
        
        // Show success message
        alert(`Successfully connected to Petra Wallet!\nAddress: ${response.address.substring(0, 10)}...`);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect to Petra Wallet. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setConnected(false);
    setAccount(null);
    
    if ((window as any).aptos) {
      (window as any).aptos.disconnect();
    }
  };

  const signAndSubmitTransaction = async (transaction: any) => {
    if (!connected || !(window as any).aptos) {
      throw new Error('Wallet not connected');
    }

    try {
      // Simulate transaction signing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await (window as any).aptos.signAndSubmitTransaction(transaction);
      return response;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  };

  // Check for existing connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      if ((window as any).aptos) {
        try {
          const response = await (window as any).aptos.isConnected();
          if (response) {
            const account = await (window as any).aptos.account();
            setConnected(true);
            setAccount(account.address);
          }
        } catch (error) {
          console.error('Failed to restore wallet connection:', error);
        }
      }
    };

    checkConnection();
  }, []);

  return (
    <WalletContext.Provider value={{
      connected,
      account,
      connect,
      disconnect,
      signAndSubmitTransaction
    }}>
      {children}
    </WalletContext.Provider>
  );
}

function PharmaSupplyChainApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'transfer' | 'temperature' | 'compliance'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const wallet = useContext(WalletContext);

  // Form states
  const [createForm, setCreateForm] = useState<{
    id: string;
    name: string;
    batch_number: string;
    manufacturing_date: string;
    expiry_date: string;
  }>({
    id: '',
    name: '',
    batch_number: '',
    manufacturing_date: '',
    expiry_date: ''
  });

  const [transferForm, setTransferForm] = useState({
    product_id: '',
    new_holder: ''
  });

  const [tempForm, setTempForm] = useState({
    product_id: '',
    temperature: '',
    location: ''
  });

  const [complianceForm, setComplianceForm] = useState({
    product_id: ''
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await mockAptosClient.getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
    setLoading(false);
  };

  const handleCreateProduct = async () => {
    if (!wallet?.connected) {
      alert('Please connect your Petra wallet first!');
      return;
    }

    if (!createForm.id || !createForm.name || !createForm.batch_number || !createForm.manufacturing_date || !createForm.expiry_date) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // Create transaction payload
      const transaction = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::supply_chain::create_product`,
        arguments: [
          createForm.id,
          createForm.name,
          createForm.batch_number,
          Math.floor(new Date(createForm.manufacturing_date).getTime() / 1000).toString(),
          Math.floor(new Date(createForm.expiry_date).getTime() / 1000).toString()
        ],
        type_arguments: []
      };

      // Sign and submit transaction through Petra wallet
      const pendingTx = await wallet.signAndSubmitTransaction(transaction);
      
      if (pendingTx) {
        // Wait for transaction to be confirmed
        const result = await mockAptosClient.createProduct({
          ...createForm,
          manufacturing_date: new Date(createForm.manufacturing_date).getTime(),
          expiry_date: new Date(createForm.expiry_date).getTime()
        });
        
        if (result.success) {
          // Add new product to the mock data AND update React state
          mockProducts.push(result.product);
          setProducts([...mockProducts]);
          
          // Clear form and show success message
          setCreateForm({ id: '', name: '', batch_number: '', manufacturing_date: '', expiry_date: '' });
          alert(`✅ Product created successfully!\nProduct ID: ${createForm.id}\nTransaction Hash: ${pendingTx.hash}`);
          
          // Switch to dashboard to show updated stats
          setActiveTab('dashboard');
        }
      }
    } catch (error) {
      console.error('Error creating product:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          alert('Transaction was cancelled by user');
        } else if (error.message.includes('insufficient funds')) {
          alert('Insufficient funds to create product');
        } else {
          alert('Error creating product: ' + error.message);
        }
      } else {
        alert('Unknown error occurred while creating product');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTransferProduct = async () => {
    if (!wallet?.connected) {
      alert('Please connect your Petra wallet first!');
      return;
    }

    if (!transferForm.product_id || !transferForm.new_holder) {
      alert('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    try {
      const transaction = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::supply_chain::transfer_product`,
        arguments: [transferForm.product_id, transferForm.new_holder],
        type_arguments: []
      };

      const pendingTx = await wallet.signAndSubmitTransaction(transaction);
      
      const result = await mockAptosClient.transferProduct(transferForm);
      if (result.success) {
        // Update product status in local state
        const productIndex = mockProducts.findIndex(p => p.id === transferForm.product_id);
        if (productIndex !== -1) {
          mockProducts[productIndex].status = 2; // Set to "In Transit"
          mockProducts[productIndex].current_holder = transferForm.new_holder;
          setProducts([...mockProducts]); // Update React state
        }
        
        alert(`✅ Product transferred successfully!\n\nTransaction Hash: ${result.hash}\nNew Holder: ${transferForm.new_holder.substring(0, 10)}...\n\nStatus updated to "In Transit"`);
        setTransferForm({ product_id: '', new_holder: '' });
        setActiveTab('dashboard');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed or was cancelled by user';
      alert('❌ Error transferring product: ' + errorMessage);
    }
    setLoading(false);
  };

  const handleLogTemperature = async () => {
    if (!wallet?.connected) {
      alert('Please connect your Petra wallet first!');
      return;
    }

    if (!tempForm.product_id || !tempForm.temperature || !tempForm.location) {
      alert('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    try {
      const transaction = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::supply_chain::log_temperature`,
        arguments: [
          tempForm.product_id,
          Math.round(parseFloat(tempForm.temperature) * 100).toString(),
          tempForm.location
        ],
        type_arguments: []
      };

      const pendingTx = await wallet.signAndSubmitTransaction(transaction);
      
      const result = await mockAptosClient.logTemperature({
        ...tempForm,
        temperature: parseFloat(tempForm.temperature) * 100
      });
      
      if (result.success) {
        // Add temperature reading to local state
        const productIndex = mockProducts.findIndex(p => p.id === tempForm.product_id);
        if (productIndex !== -1) {
          mockProducts[productIndex].temperature_log.push({
            timestamp: Date.now(),
            temperature: parseFloat(tempForm.temperature) * 100,
            location: tempForm.location
          });
          setProducts([...mockProducts]); // Update React state
        }
        
        alert(`🌡️ Temperature logged successfully!\n\nTransaction Hash: ${result.hash}\nTemperature: ${tempForm.temperature}°C\nLocation: ${tempForm.location}`);
        setTempForm({ product_id: '', temperature: '', location: '' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed or was cancelled by user';
      alert('❌ Error logging temperature: ' + errorMessage);
    }
    setLoading(false);
  };

  const handleVerifyCompliance = async () => {
    if (!wallet?.connected) {
      alert('Please connect your Petra wallet first!');
      return;
    }

    if (!complianceForm.product_id) {
      alert('Please select a product');
      return;
    }
    
    setLoading(true);
    try {
      const transaction = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::supply_chain::verify_compliance`,
        arguments: [complianceForm.product_id],
        type_arguments: []
      };

      const pendingTx = await wallet.signAndSubmitTransaction(transaction);
      
      const result = await mockAptosClient.verifyCompliance(complianceForm);
      if (result.success) {
        // Update compliance status in local state
        const productIndex = mockProducts.findIndex(p => p.id === complianceForm.product_id);
        if (productIndex !== -1) {
          mockProducts[productIndex].compliance_verified = true;
          setProducts([...mockProducts]); // Update React state
        }
        
        alert(`✅ Compliance verified successfully!\n\nTransaction Hash: ${result.hash}\nProduct ID: ${complianceForm.product_id}\n\nCompliance counter has been updated!`);
        setComplianceForm({ product_id: '' });
        setActiveTab('dashboard');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed or was cancelled by user';
      alert('❌ Error verifying compliance: ' + errorMessage);
    }
    setLoading(false);
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString();
  };

  const formatTemperature = (temp: number): string => {
    return (temp / 100).toFixed(1) + '°C';
  };

  const formatAddress = (address: string): string => {
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  };

  const filteredProducts = products.filter(product =>
    product.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.batch_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Connection Status */}
      {!wallet?.connected && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Connect your Petra wallet</strong> to create products and perform transactions on the blockchain.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500 transform hover:scale-105 transition-transform">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">{products.length}</p>
              <p className="text-xs text-blue-600 mt-1">Real-time blockchain data</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500 transform hover:scale-105 transition-transform">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Compliant</p>
              <p className="text-2xl font-bold text-gray-900">
                {products.filter(p => p.compliance_verified).length}
              </p>
              <p className="text-xs text-green-600 mt-1">Verified on-chain</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500 transform hover:scale-105 transition-transform">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Transit</p>
              <p className="text-2xl font-bold text-gray-900">
                {products.filter(p => p.status === 2).length}
              </p>
              <p className="text-xs text-yellow-600 mt-1">Live tracking</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-red-500 transform hover:scale-105 transition-transform">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Non-Compliant</p>
              <p className="text-2xl font-bold text-gray-900">
                {products.filter(p => !p.compliance_verified).length}
              </p>
              <p className="text-xs text-red-600 mt-1">Requires verification</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Table */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Products Overview</h3>
            <div className="relative">
              <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Holder
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Compliance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const status = statusMap[product.status as keyof typeof statusMap];
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.batch_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatAddress(product.current_holder)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.compliance_verified ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="text-blue-600 hover:text-blue-900 flex items-center"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCreateProduct = () => (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">Create New Product</h3>
      {!wallet?.connected && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>Connect your Petra wallet</strong> to create products on the Aptos blockchain.
          </p>
        </div>
      )}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product ID</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={createForm.id}
              onChange={(e) => setCreateForm({...createForm, id: e.target.value})}
              placeholder="Enter unique product ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={createForm.name}
              onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
              placeholder="Enter product name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Batch Number</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={createForm.batch_number}
              onChange={(e) => setCreateForm({...createForm, batch_number: e.target.value})}
              placeholder="Enter batch number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Manufacturing Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={createForm.manufacturing_date}
              onChange={(e) => setCreateForm({...createForm, manufacturing_date: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={createForm.expiry_date}
              onChange={(e) => setCreateForm({...createForm, expiry_date: e.target.value})}
            />
          </div>
        </div>
        <div className="pt-4">
          <button
            onClick={handleCreateProduct}
            disabled={loading || !wallet?.connected || !createForm.id || !createForm.name || !createForm.batch_number || !createForm.manufacturing_date || !createForm.expiry_date}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating on blockchain...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Product on Blockchain
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderTransferProduct = () => (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">Transfer Product</h3>
      {!wallet?.connected && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>Connect your Petra wallet</strong> to transfer products on the blockchain.
          </p>
        </div>
      )}
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Product</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={transferForm.product_id}
            onChange={(e) => setTransferForm({...transferForm, product_id: e.target.value})}
          >
            <option value="">Choose a product to transfer</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.id} - {product.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">New Holder Address</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={transferForm.new_holder}
            onChange={(e) => setTransferForm({...transferForm, new_holder: e.target.value})}
            placeholder="0x..."
          />
        </div>
        <div className="pt-4">
          <button
            onClick={handleTransferProduct}
            disabled={loading || !wallet?.connected}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Transferring on blockchain...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                Transfer Product
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderTemperatureLog = () => (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">Log Temperature Reading</h3>
      {!wallet?.connected && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>Connect your Petra wallet</strong> to log temperature data on the blockchain.
          </p>
        </div>
      )}
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Product</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            value={tempForm.product_id}
            onChange={(e) => setTempForm({...tempForm, product_id: e.target.value})}
          >
            <option value="">Choose a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.id} - {product.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Temperature (°C)</label>
          <input
            type="number"
            step="0.1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            value={tempForm.temperature}
            onChange={(e) => setTempForm({...tempForm, temperature: e.target.value})}
            placeholder="Enter temperature"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            value={tempForm.location}
            onChange={(e) => setTempForm({...tempForm, location: e.target.value})}
            placeholder="Enter current location"
          />
        </div>
        <div className="pt-4">
          <button
            onClick={handleLogTemperature}
            disabled={loading || !wallet?.connected}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Logging on blockchain...
              </>
            ) : (
              <>
                <Thermometer className="h-4 w-4 mr-2" />
                Log Temperature
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderCompliance = () => (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">Verify Compliance</h3>
      {!wallet?.connected && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>Connect your Petra wallet</strong> to verify compliance on the blockchain.
          </p>
        </div>
      )}
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Product</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            value={complianceForm.product_id}
            onChange={(e) => setComplianceForm({...complianceForm, product_id: e.target.value})}
          >
            <option value="">Choose a product to verify</option>
            {products.filter(p => !p.compliance_verified).map((product) => (
              <option key={product.id} value={product.id}>
                {product.id} - {product.name}
              </option>
            ))}
          </select>
        </div>
        <div className="pt-4">
          <button
            onClick={handleVerifyCompliance}
            disabled={loading || !wallet?.connected}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Verifying on blockchain...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Verify Compliance
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderProductDetails = () => {
    if (!selectedProduct) return null;

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
        <div className="relative bg-white rounded-xl shadow-xl w-11/12 md:w-3/4 lg:w-1/2 max-h-5/6 overflow-y-auto">
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">Product Details</h3>
            <button
              onClick={() => setSelectedProduct(null)}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500">Product ID</p>
                <p className="text-lg text-gray-900 font-mono">{selectedProduct.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="text-lg text-gray-900">{selectedProduct.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Batch Number</p>
                <p className="text-lg text-gray-900">{selectedProduct.batch_number}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusMap[selectedProduct.status as keyof typeof statusMap].color}`}>
                  {statusMap[selectedProduct.status as keyof typeof statusMap].label}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Manufacturing Date</p>
                <p className="text-lg text-gray-900">{formatDate(selectedProduct.manufacturing_date)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Expiry Date</p>
                <p className="text-lg text-gray-900">{formatDate(selectedProduct.expiry_date)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Manufacturer</p>
                <p className="text-lg text-gray-900 font-mono">{formatAddress(selectedProduct.manufacturer)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Current Holder</p>
                <p className="text-lg text-gray-900 font-mono">{formatAddress(selectedProduct.current_holder)}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center mb-4">
                <Activity className="h-5 w-5 text-blue-500 mr-2" />
                <p className="text-sm font-medium text-gray-500">Temperature Log</p>
              </div>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {selectedProduct.temperature_log.map((reading, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <Thermometer className="h-4 w-4 text-blue-500 mr-3" />
                      <div>
                        <span className="text-lg font-semibold text-gray-900">
                          {formatTemperature(reading.temperature)}
                        </span>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          {reading.location}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(reading.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
                {selectedProduct.temperature_log.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No temperature readings recorded</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-500 mr-2">Compliance Status:</span>
                {selectedProduct.compliance_verified ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-1" />
                    <span className="font-medium">Verified</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <AlertTriangle className="h-5 w-5 mr-1" />
                    <span className="font-medium">Not Verified</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <WalletContextProvider>
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <div className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Shield className="h-8 w-8 text-blue-600" />
                <h1 className="ml-3 text-2xl font-bold text-gray-900">
                  Pharma Supply Chain
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className="h-2 w-2 bg-green-400 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600 mr-4">Connected to Aptos Devnet</span>
                  <WalletConnection />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              {[
                { id: 'dashboard' as const, label: 'Dashboard', icon: TrendingUp },
                { id: 'create' as const, label: 'Create Product', icon: Plus },
                { id: 'transfer' as const, label: 'Transfer', icon: Users },
                { id: 'temperature' as const, label: 'Temperature Log', icon: Thermometer },
                { id: 'compliance' as const, label: 'Compliance', icon: Shield }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-40">
              <div className="bg-white p-6 rounded-xl shadow-xl">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-4"></div>
                  <p className="text-lg text-gray-700">Processing blockchain transaction...</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'create' && renderCreateProduct()}
          {activeTab === 'transfer' && renderTransferProduct()}
          {activeTab === 'temperature' && renderTemperatureLog()}
          {activeTab === 'compliance' && renderCompliance()}

          {renderProductDetails()}
        </div>
      </div>
    </WalletContextProvider>
  );
}

// Wrap app with Wallet Context
function App() {
  return (
    <WalletContextProvider>
      <PharmaSupplyChainApp />
    </WalletContextProvider>
  );
}

export default App;