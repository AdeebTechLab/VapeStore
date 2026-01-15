import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { connectSocket, joinAdminRoom, onSaleCompleted, onSessionEnded, onProductAdded } from '../../services/socketService';

// Simplified Admin Dashboard with core features
const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [shops, setShops] = useState([]);
    const [analytics, setAnalytics] = useState({ data: [] });
    const [loading, setLoading] = useState(true);

    // Quick Add Product Modal State
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [selectedShopId, setSelectedShopId] = useState('');
    const [productForm, setProductForm] = useState({
        name: '',
        brand: '',
        category: 'Device',
        units: 1,
        pricePerUnit: '',
        costPrice: '',
        shortDescription: '',
        barcode: '',
        mlCapacity: '',
        flavour: '',
    });
    const [imageFile, setImageFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Low stock notifications state
    const [lowStockProducts, setLowStockProducts] = useState({}); // { shopId: [products] }
    const [dismissedNotifications, setDismissedNotifications] = useState(() => {
        // Load dismissed notifications from localStorage
        const saved = localStorage.getItem('dismissedLowStockNotifications');
        return saved ? JSON.parse(saved) : {};
    });
    const [expandedAlerts, setExpandedAlerts] = useState({}); // { shopId: true/false } - show all alerts for shop

    // Barcode scanning state
    const [isScanning, setIsScanning] = useState(false);
    const scanBufferRef = useRef('');
    const lastKeyTimeRef = useRef(0);

    // Global Key Listener for Barcode Scanner
    useEffect(() => {
        if (!isScanning) return;

        const handleKeyDown = (e) => {
            const currentTime = Date.now();
            const timeDiff = currentTime - lastKeyTimeRef.current;

            // Fast typing (scanner) - typically under 50ms between keypresses
            if (timeDiff < 50 || scanBufferRef.current === '') {
                if (e.key === 'Enter') {
                    // Scanner finished - get the barcode
                    if (scanBufferRef.current.length > 3) {
                        setProductForm(prev => ({ ...prev, barcode: scanBufferRef.current }));
                        setIsScanning(false);
                    }
                    scanBufferRef.current = '';
                } else if (e.key.length === 1) {
                    scanBufferRef.current += e.key;
                }
            } else {
                // Too slow, reset buffer
                scanBufferRef.current = e.key.length === 1 ? e.key : '';
            }
            lastKeyTimeRef.current = currentTime;
        };

        window.addEventListener('keydown', handleKeyDown);

        // Auto-stop scanning after 10 seconds
        const timeout = setTimeout(() => {
            setIsScanning(false);
            scanBufferRef.current = '';
        }, 10000);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            clearTimeout(timeout);
        };
    }, [isScanning]);

    useEffect(() => {
        fetchDashboardData();

        // Connect to socket for real-time updates
        connectSocket();
        joinAdminRoom();

        // Listen for sales to auto-refresh stats
        const unsubSale = onSaleCompleted((data) => {
            console.log('🔔 Real-time: Sale completed', data);
            fetchDashboardData(); // Refresh stats
        });

        const unsubSession = onSessionEnded((data) => {
            console.log('🔔 Real-time: Session ended', data);
        });

        const unsubProduct = onProductAdded((data) => {
            console.log('🔔 Real-time: Product added', data);
            fetchDashboardData(); // Refresh stats
        });

        return () => {
            unsubSale?.();
            unsubSession?.();
            unsubProduct?.();
        };
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [shopsRes, analyticsRes] = await Promise.all([
                api.get('/admin/shops'),
                api.get('/admin/analytics?period=daily')
            ]);

            if (shopsRes.data.success) {
                setShops(shopsRes.data.shops);

                // Fetch low stock products for each shop
                const lowStockData = {};
                for (const shop of shopsRes.data.shops) {
                    try {
                        const productsRes = await api.get(`/admin/shops/${shop._id}/products`);
                        if (productsRes.data.success) {
                            // Filter products with low stock (units <= 3)
                            const lowStock = productsRes.data.products.filter(p => p.units <= 3);
                            if (lowStock.length > 0) {
                                lowStockData[shop._id] = lowStock;
                            }
                        }
                    } catch (e) {
                        console.error(`Error fetching products for shop ${shop.name}:`, e);
                    }
                }
                setLowStockProducts(lowStockData);
            }

            if (analyticsRes.data.success) {
                setAnalytics(analyticsRes.data);
            }

            setLoading(false);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Dismiss a low stock notification
    const dismissNotification = (shopId, productId) => {
        const newDismissed = {
            ...dismissedNotifications,
            [`${shopId}-${productId}`]: true
        };
        setDismissedNotifications(newDismissed);
        localStorage.setItem('dismissedLowStockNotifications', JSON.stringify(newDismissed));
    };

    // Get non-dismissed low stock products for a shop
    const getActiveNotifications = (shopId) => {
        const products = lowStockProducts[shopId] || [];
        return products.filter(p => !dismissedNotifications[`${shopId}-${p._id}`]);
    };

    const handleOpenAddProduct = () => {
        setShowAddProduct(true);
        setSelectedShopId('');
        setProductForm({
            name: '',
            brand: '',
            category: 'Device',
            units: 1,
            pricePerUnit: '',
            costPrice: '',
            shortDescription: '',
            barcode: '',
            mlCapacity: '',
            flavour: '',
        });
        setImageFile(null);
    };

    const handleImageChange = (e) => {
        if (e.target.files[0]) {
            setImageFile(e.target.files[0]);
        }
    };

    const handleAddProduct = async (e) => {
        e.preventDefault();
        if (!selectedShopId) {
            alert('Please select a shop first');
            return;
        }

        setSubmitting(true);
        try {
            // Use FormData for file upload
            const data = new FormData();
            Object.keys(productForm).forEach(key => {
                if (productForm[key] !== '' && productForm[key] !== null) {
                    data.append(key, productForm[key]);
                }
            });
            if (imageFile) {
                data.append('image', imageFile);
            }

            const response = await api.post(`/admin/shops/${selectedShopId}/products`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                alert(response.data.merged ? response.data.message : 'Product added successfully!');
                setShowAddProduct(false);
                fetchDashboardData(); // Refresh stats
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to add product');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Top Navigation */}
            <nav className="bg-gray-800 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <img
                                src="/assets/logo.jpg"
                                alt="Al Hadi Vapes"
                                className="w-10 h-10 rounded-lg object-contain"
                            />
                            <h1 className="text-xl font-bold text-white">Al Hadi Vapes Admin</h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-gray-300">Welcome, {user?.username}</span>
                            <button
                                onClick={handleLogout}
                                className="btn-danger text-sm"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header with Quick Add Product Button */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2">Dashboard</h2>
                        <p className="text-gray-400">Manage your vape shop inventory and sales</p>
                    </div>
                    <button
                        onClick={handleOpenAddProduct}
                        className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all shadow-lg"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Quick Add Product
                    </button>
                </div>

                {/* Analytics Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="card">
                        <h3 className="text-sm font-medium text-gray-400 mb-2">Total Shops</h3>
                        <p className="text-3xl font-bold text-white">{shops.length}</p>
                    </div>
                    <div className="card">
                        <h3 className="text-sm font-medium text-gray-400 mb-2">Today's Sales</h3>
                        <p className="text-3xl font-bold text-green-400">
                            Rs {shops.reduce((sum, shop) => sum + (shop.stats?.todaysSales || 0), 0).toFixed(2)}
                        </p>
                    </div>
                    <div className="card">
                        <h3 className="text-sm font-medium text-gray-400 mb-2">Total Products</h3>
                        <p className="text-3xl font-bold text-blue-400">
                            {shops.reduce((sum, shop) => sum + (shop.stats?.productCount || 0), 0)}
                        </p>
                    </div>
                </div>

                {/* Shops List */}
                <div className="card">
                    <h3 className="text-xl font-bold text-white mb-4">Your Shops</h3>
                    <div className="space-y-4">
                        {shops.map((shop) => {
                            const hasLowStock = getActiveNotifications(shop._id).length > 0;
                            return (
                                <div
                                    key={shop._id}
                                    className={`p-4 bg-gray-700 rounded-lg border-2 transition-all ${hasLowStock
                                        ? 'border-red-500 shadow-lg shadow-red-500/20'
                                        : 'border-gray-600 hover:border-primary'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h4 className="text-lg font-semibold text-white">{shop.name}</h4>
                                            <p className="text-sm text-gray-400">{shop.location || 'No location set'}</p>
                                            <div className="flex gap-4 mt-2">
                                                <span className="text-sm text-gray-300">
                                                    Products: <span className="font-semibold">{shop.stats?.productCount || 0}</span>
                                                </span>
                                                <span className="text-sm text-gray-300">
                                                    Today's Sales: <span className="font-semibold text-green-400">
                                                        Rs {(shop.stats?.todaysSales || 0).toFixed(2)}
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Link
                                                to={`/admin/shop/${shop._id}/products`}
                                                className="btn-primary text-sm"
                                            >
                                                Manage Products
                                            </Link>
                                            <Link
                                                to={`/admin/shop/${shop._id}/shopkeepers`}
                                                className="btn-secondary text-sm"
                                            >
                                                Shopkeepers
                                            </Link>
                                            <Link
                                                to={`/admin/shop/${shop._id}/session-reports`}
                                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-all"
                                            >
                                                Shopkeeper Report
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Low Stock Notifications */}
                                    {(() => {
                                        const allNotifications = getActiveNotifications(shop._id);
                                        const isExpanded = expandedAlerts[shop._id];
                                        const displayLimit = 3;
                                        const displayedNotifications = isExpanded ? allNotifications : allNotifications.slice(0, displayLimit);
                                        const hasMore = allNotifications.length > displayLimit;

                                        return allNotifications.length > 0 && (
                                            <div className="mt-3 p-3 bg-red-900/20 border border-red-500 rounded-lg">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-red-400 text-lg">⚠️</span>
                                                        <span className="text-red-400 font-semibold text-sm">Low Stock Alert ({allNotifications.length})</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    {displayedNotifications.map(product => (
                                                        <div
                                                            key={product._id}
                                                            className="flex items-center justify-between bg-red-900/30 px-3 py-2 rounded border border-red-600/50"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${product.units === 0
                                                                    ? 'bg-red-600 text-white'
                                                                    : product.units === 1
                                                                        ? 'bg-orange-600 text-white'
                                                                        : 'bg-yellow-600 text-white'
                                                                    }`}>
                                                                    {product.units} left
                                                                </span>
                                                                <span className="text-white text-sm">{product.name}</span>
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    dismissNotification(shop._id, product._id);
                                                                }}
                                                                className="text-gray-400 hover:text-white p-1"
                                                                title="Dismiss notification"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                {hasMore && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setExpandedAlerts(prev => ({
                                                                ...prev,
                                                                [shop._id]: !prev[shop._id]
                                                            }));
                                                        }}
                                                        className="mt-2 w-full text-center py-1.5 text-sm text-red-300 hover:text-white bg-red-900/30 hover:bg-red-900/50 rounded transition-colors"
                                                    >
                                                        {isExpanded ? `Show Less ▲` : `Show All ${allNotifications.length} Alerts ▼`}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Quick Actions - Original 3 options restored */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link to="/admin/reports" className="card hover:border-primary transition-all cursor-pointer text-center py-8">
                        <svg className="w-12 h-12 mx-auto mb-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-lg font-semibold text-white">View Reports</h3>
                        <p className="text-sm text-gray-400 mt-1">Session reports & analytics</p>
                    </Link>

                    <Link to="/admin/analytics" className="card hover:border-secondary transition-all cursor-pointer text-center py-8">
                        <svg className="w-12 h-12 mx-auto mb-3 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        <h3 className="text-lg font-semibold text-white">Analytics</h3>
                        <p className="text-sm text-gray-400 mt-1">Sales trends & insights</p>
                    </Link>

                    <Link to="/admin/manage-shops" className="card hover:border-accent transition-all cursor-pointer text-center py-8">
                        <svg className="w-12 h-12 mx-auto mb-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <h3 className="text-lg font-semibold text-white">Manage Shops</h3>
                        <p className="text-sm text-gray-400 mt-1">Add or configure shops</p>
                    </Link>
                </div>
            </div>

            {/* Quick Add Product Modal - FULL FEATURED */}
            {showAddProduct && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">Quick Add Product</h2>
                                <button
                                    onClick={() => setShowAddProduct(false)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Step 1: Shop Selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    1. Select Shop *
                                </label>
                                <select
                                    value={selectedShopId}
                                    onChange={(e) => setSelectedShopId(e.target.value)}
                                    className="input w-full"
                                    required
                                >
                                    <option value="">Choose a shop...</option>
                                    {shops.map((shop) => (
                                        <option key={shop._id} value={shop._id}>
                                            {shop.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Step 2: Product Form - Only show when shop is selected */}
                            {selectedShopId && (
                                <form onSubmit={handleAddProduct} className="space-y-4">
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            2. Enter Product Details
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Product Name */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Product Name *</label>
                                            <input
                                                type="text"
                                                value={productForm.name}
                                                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                                                className="input"
                                                placeholder="e.g., SMOK Nord 4"
                                                required
                                            />
                                        </div>

                                        {/* Brand */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Brand</label>
                                            <input
                                                type="text"
                                                value={productForm.brand}
                                                onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                                                className="input"
                                                placeholder="e.g., SMOK"
                                            />
                                        </div>

                                        {/* Category */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Category *</label>
                                            <select
                                                value={productForm.category}
                                                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                                                className="input"
                                                required
                                            >
                                                <option value="Device">Device</option>
                                                <option value="Coil">Coil</option>
                                                <option value="E-Liquid">E-Liquid</option>
                                            </select>
                                        </div>

                                        {/* ML Capacity - only for E-Liquid */}
                                        {productForm.category === 'E-Liquid' && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">ML Capacity *</label>
                                                <input
                                                    type="number"
                                                    value={productForm.mlCapacity}
                                                    onChange={(e) => setProductForm({ ...productForm, mlCapacity: Number(e.target.value) })}
                                                    className="input"
                                                    placeholder="e.g., 100, 500, 1000"
                                                    min="1"
                                                    required
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Total ML per bottle</p>
                                            </div>
                                        )}

                                        {/* Stock Quantity */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Stock Quantity *</label>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setProductForm({ ...productForm, units: Math.max(1, (Number(productForm.units) || 1) - 1) })}
                                                    className="w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold text-xl transition-colors"
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    value={productForm.units}
                                                    onChange={(e) => setProductForm({ ...productForm, units: Number(e.target.value) || '' })}
                                                    className="input text-center flex-1"
                                                    placeholder="1"
                                                    min="1"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setProductForm({ ...productForm, units: (Number(productForm.units) || 0) + 1 })}
                                                    className="w-10 h-10 bg-primary hover:bg-primary-dark text-white rounded-lg font-bold text-xl transition-colors"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>

                                        {/* Cost Price - FIRST (Buying Price) */}
                                        <div>
                                            <label className="block text-sm font-bold text-yellow-400 mb-2">
                                                💰 Cost Price (Rs) - BUYING PRICE *
                                            </label>
                                            <input
                                                type="number"
                                                step="1"
                                                value={productForm.costPrice}
                                                onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                                                className="input"
                                                placeholder="e.g., 500"
                                                min="0"
                                                required
                                            />
                                            <p className="text-xs text-yellow-500 mt-1 font-medium">
                                                ⬆️ Price at which you BUY from supplier (hidden from shopkeepers)
                                            </p>
                                        </div>

                                        {/* Price per Unit - SECOND (Selling Price) */}
                                        <div>
                                            <label className="block text-sm font-bold text-green-400 mb-2">
                                                🏷️ Sell Price (Rs) - SELLING PRICE *
                                            </label>
                                            <input
                                                type="number"
                                                step="1"
                                                value={productForm.pricePerUnit}
                                                onChange={(e) => setProductForm({ ...productForm, pricePerUnit: e.target.value })}
                                                className={`input ${productForm.costPrice && Number(productForm.pricePerUnit) && Number(productForm.pricePerUnit) < Number(productForm.costPrice) ? 'border-red-500 bg-red-900/20' : ''}`}
                                                placeholder="e.g., 800"
                                                required
                                            />
                                            <p className="text-xs text-green-500 mt-1 font-medium">
                                                ⬇️ Price at which you SELL to customers (visible to shopkeepers)
                                            </p>
                                            {Number(productForm.costPrice) && Number(productForm.pricePerUnit) && Number(productForm.pricePerUnit) < Number(productForm.costPrice) && (
                                                <p className="text-xs text-red-400 mt-1 font-bold">
                                                    ⚠️ Warning: Sell price is LESS than cost! You will make a LOSS.
                                                </p>
                                            )}
                                            {Number(productForm.costPrice) && Number(productForm.pricePerUnit) && Number(productForm.pricePerUnit) > Number(productForm.costPrice) && (
                                                <p className="text-xs text-green-400 mt-1">
                                                    ✅ Profit per unit: Rs {(Number(productForm.pricePerUnit) - Number(productForm.costPrice)).toFixed(0)}
                                                </p>
                                            )}
                                        </div>

                                        {/* Barcode with Scanner */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Barcode / Scan Code (Optional)
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={productForm.barcode}
                                                    onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                                                    className="input flex-1"
                                                    placeholder="Enter or scan barcode..."
                                                    disabled={isScanning}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsScanning(!isScanning);
                                                        scanBufferRef.current = '';
                                                    }}
                                                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${isScanning
                                                        ? 'bg-green-600 text-white animate-pulse ring-2 ring-green-400'
                                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                        }`}
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                                    </svg>
                                                    {isScanning ? 'Scanning...' : 'Scan'}
                                                </button>
                                            </div>
                                            {isScanning && (
                                                <p className="text-green-400 text-xs mt-1 animate-pulse">
                                                    🔊 Ready! Scan barcode now... (auto-stops in 10s)
                                                </p>
                                            )}
                                            {productForm.barcode && !isScanning && (
                                                <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                                                    <span className="text-green-400">✓</span> Barcode: {productForm.barcode}
                                                </p>
                                            )}
                                        </div>

                                        {/* Product Image */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Product Image (Optional)</label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                className="block w-full text-sm text-gray-400
                                                    file:mr-4 file:py-2 file:px-4
                                                    file:rounded-full file:border-0
                                                    file:text-sm file:font-semibold
                                                    file:bg-primary file:text-white
                                                    hover:file:bg-primary-dark
                                                "
                                            />
                                            {imageFile && (
                                                <p className="text-xs text-green-400 mt-1">✓ {imageFile.name}</p>
                                            )}
                                        </div>

                                        {/* Description */}
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Description (Optional)</label>
                                            <textarea
                                                value={productForm.shortDescription}
                                                onChange={(e) => setProductForm({ ...productForm, shortDescription: e.target.value })}
                                                className="input"
                                                placeholder="Brief product description..."
                                                rows="3"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-6">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddProduct(false)}
                                            className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                                        >
                                            {submitting ? 'Adding...' : 'Add Product'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {!selectedShopId && (
                                <p className="text-gray-500 text-center py-4">
                                    Select a shop above to enter product details
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
