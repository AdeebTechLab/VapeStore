import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api, { BACKEND_URL } from '../../services/api';
import PrintReceipt from '../../components/PrintReceipt';

const Home = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Print Receipt state
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState(null);

    // Opened Bottles state (E-Liquid)
    const [openedBottles, setOpenedBottles] = useState([]);
    const [showSellMlModal, setShowSellMlModal] = useState(false);
    const [selectedBottle, setSelectedBottle] = useState(null);
    const [mlToSell, setMlToSell] = useState(0);

    // Cart state
    const [cart, setCart] = useState([]);
    const [showCart, setShowCart] = useState(false);
    const [discountPercent, setDiscountPercent] = useState(0);

    // QR Scan Mode state
    const [isScanMode, setIsScanMode] = useState(false);
    const scanBufferRef = useRef('');
    const lastKeyTimeRef = useRef(0);

    useEffect(() => {
        loadSessionAndProducts();
        loadOpenedBottles();
    }, []);

    useEffect(() => {
        filterProducts();
    }, [searchQuery, categoryFilter, products]);

    // Global Key Listener for Barcode Scanner
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Only process if in scan mode or if it looks like scanner input (fast typing)
            const currentTime = Date.now();
            const isScannerInput = currentTime - lastKeyTimeRef.current < 50;
            lastKeyTimeRef.current = currentTime;

            if (isScanMode || isScannerInput) {
                // If Enter is pressed, process the buffer
                if (e.key === 'Enter') {
                    if (scanBufferRef.current) {
                        handleScan(scanBufferRef.current);
                        scanBufferRef.current = '';
                    }
                } else if (e.key.length === 1) {
                    // Append printable characters to buffer
                    scanBufferRef.current += e.key;
                }

                // If in explicit scan mode, prevent default to avoid typing in random inputs
                if (isScanMode) {
                    // e.preventDefault(); // Optional: might block normal typing if not careful
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isScanMode, products]);

    const loadSessionAndProducts = async () => {
        try {
            const sessionData = JSON.parse(localStorage.getItem('session') || '{}');
            setSession(sessionData);

            // Get shopDbName from user token
            const shopDbName = user?.shopDbName || 'shop_db_1';
            const response = await api.get(`/shop/${shopDbName}/products`);

            if (response.data.success) {
                setProducts(response.data.products);
                setFilteredProducts(response.data.products);
            }

            setLoading(false);
        } catch (error) {
            console.error('Error loading data:', error);
            setLoading(false);
        }
    };

    const filterProducts = () => {
        let filtered = products;

        // Filter out products with 0 stock (hide from shopkeeper view but keep in records)
        filtered = filtered.filter(p => p.units > 0);

        // Apply category filter
        if (categoryFilter !== 'All') {
            filtered = filtered.filter(p => p.category === categoryFilter);
        }

        // Apply search filter
        if (searchQuery.trim()) {
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.brand.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        setFilteredProducts(filtered);
    };

    const handleScan = async (code) => {
        console.log('Scanned Code:', code);

        try {
            const shopDbName = user?.shopDbName || 'shop_db_1';
            const response = await api.post(`/shop/${shopDbName}/scan`, { barcode: code });

            if (response.data.success && response.data.product) {
                const scannedProduct = response.data.product;

                // Check if product is in our local list (it should be)
                const localProduct = products.find(p => p._id === scannedProduct._id);

                if (localProduct) {
                    // Filter to show ONLY this product
                    setFilteredProducts([localProduct]);
                    setSearchQuery(''); // Clear text search
                    setCategoryFilter('All'); // Clear category
                    showMessage('success', `Product Found: ${localProduct.name}`);
                } else {
                    showMessage('error', 'Product found but not in current list (refresh needed?)');
                }
            } else {
                showMessage('error', 'Product not found');
            }
        } catch (error) {
            console.error('Scan Error:', error);
            showMessage('error', 'Product not found or scan failed');
        }
    };

    // Add product to cart
    const addToCart = (product) => {
        if (product.units <= 0) {
            showMessage('error', 'Product out of stock!');
            return;
        }

        // Check if already in cart
        const existingItem = cart.find(item => item.productId === product._id && item.type === 'product');
        if (existingItem) {
            // Check if we can add more
            if (existingItem.qty >= product.units) {
                showMessage('error', 'No more stock available!');
                return;
            }
            setCart(cart.map(item =>
                item.productId === product._id && item.type === 'product'
                    ? { ...item, qty: item.qty + 1 }
                    : item
            ));
        } else {
            setCart([...cart, {
                productId: product._id,
                productName: product.name,
                qty: 1,
                price: product.pricePerUnit,
                type: 'product',
                maxQty: product.units,
            }]);
        }
        showMessage('success', `Added ${product.name} to cart`);
    };

    // Add ML to cart from opened bottle
    const addMlToCart = (bottle, ml) => {
        if (ml <= 0 || ml > bottle.remainingMl) {
            showMessage('error', 'Invalid ML amount!');
            return;
        }

        // Calculate price
        const product = products.find(p => p._id === bottle.productId);
        const mlPrice = product ? (product.pricePerUnit / product.mlCapacity) * ml : 0;

        setCart([...cart, {
            productId: bottle.productId,
            openedBottleId: bottle._id,
            productName: `${bottle.productName} (${ml}ml)`,
            qty: 1,
            mlAmount: ml,
            price: mlPrice,
            type: 'ml',
        }]);

        setShowSellMlModal(false);
        setSelectedBottle(null);
        setMlToSell(0);
        showMessage('success', `Added ${ml}ml of ${bottle.productName} to cart`);
    };

    // Remove item from cart
    const removeFromCart = (index) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    // Update item quantity in cart
    const updateCartQty = (index, newQty) => {
        if (newQty <= 0) {
            removeFromCart(index);
            return;
        }
        const item = cart[index];
        if (item.type === 'product' && newQty > item.maxQty) {
            showMessage('error', 'Not enough stock!');
            return;
        }
        setCart(cart.map((item, i) => i === index ? { ...item, qty: newQty } : item));
    };

    // Update item price in cart
    const updateCartPrice = (index, newPrice) => {
        if (newPrice < 0) return;
        setCart(cart.map((item, i) => i === index ? { ...item, price: newPrice } : item));
    };

    // Calculate discount amount
    const getDiscountAmount = () => {
        const subtotal = getCartTotal();
        return (subtotal * discountPercent) / 100;
    };

    // Get final total after discount
    const getFinalTotal = () => {
        return getCartTotal() - getDiscountAmount();
    };

    // Calculate cart total
    const getCartTotal = () => {
        return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    };

    // Checkout - sell all items in cart
    const handleCheckout = async () => {
        if (cart.length === 0) {
            showMessage('error', 'Cart is empty!');
            return;
        }

        try {
            const shopDbName = user?.shopDbName || 'shop_db_1';
            const items = cart.map(item => ({
                productId: item.productId,
                productName: item.productName,
                qty: item.qty,
                type: item.type,
                mlAmount: item.mlAmount,
                openedBottleId: item.openedBottleId,
            }));

            const response = await api.post(`/shop/${shopDbName}/sell-bulk`, { items });

            if (response.data.success) {
                // Update local product state
                cart.forEach(item => {
                    if (item.type === 'product') {
                        setProducts(prevProducts =>
                            prevProducts.map(p =>
                                p._id === item.productId ? { ...p, units: p.units - item.qty } : p
                            )
                        );
                    }
                });

                // Reload opened bottles
                loadOpenedBottles();

                // Calculate final amounts with discount
                const subtotal = response.data.totalAmount;
                const discountAmount = (subtotal * discountPercent) / 100;
                const finalTotal = subtotal - discountAmount;

                // Prepare and show receipt
                const receipt = {
                    shopName: user?.shopName || 'Al Hadi Vapes',
                    date: new Date(),
                    receiptNo: `RCP-${Date.now().toString(36).toUpperCase()}`,
                    cashier: user?.username || 'Staff',
                    items: response.data.soldItems,
                    subtotal: subtotal,
                    discount: discountPercent > 0 ? { percent: discountPercent, amount: discountAmount } : null,
                    total: finalTotal,
                };
                setReceiptData(receipt);
                setShowReceipt(true);

                // Clear cart and reset discount
                setCart([]);
                setDiscountPercent(0);
                setShowCart(false);
                showMessage('success', `Sold ${response.data.soldItems.length} item(s)`);
            }
        } catch (error) {
            showMessage('error', error.response?.data?.message || 'Checkout failed');
        }
    };

    const handleLogout = async () => {
        try {
            const shopDbName = user?.shopDbName || 'shop_db_1';
            await api.post(`/shop/${shopDbName}/logout`);
            logout();
            navigate('/login');
        } catch (error) {
            console.error('Error during logout:', error);
            logout();
            navigate('/login');
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    };

    // Load opened bottles
    const loadOpenedBottles = async () => {
        try {
            const shopDbName = user?.shopDbName || 'shop_db_1';
            const response = await api.get(`/shop/${shopDbName}/opened-bottles?status=open`);
            if (response.data.success) {
                setOpenedBottles(response.data.openedBottles);
            }
        } catch (error) {
            console.error('Error loading opened bottles:', error);
        }
    };

    // Open a new bottle from sealed stock
    const handleOpenBottle = async (product) => {
        if (product.hasOpenedBottle) {
            showMessage('error', 'This product already has an opened bottle!');
            return;
        }
        if (product.units <= 0) {
            showMessage('error', 'No sealed bottles available!');
            return;
        }

        try {
            const shopDbName = user?.shopDbName || 'shop_db_1';
            const response = await api.post(`/shop/${shopDbName}/open-bottle`, {
                productId: product._id,
            });

            if (response.data.success) {
                // Update product in list
                setProducts(prevProducts =>
                    prevProducts.map(p =>
                        p._id === product._id ? response.data.product : p
                    )
                );
                // Add to opened bottles
                setOpenedBottles(prev => [response.data.openedBottle, ...prev]);
                showMessage('success', response.data.message);
            }
        } catch (error) {
            showMessage('error', error.response?.data?.message || 'Failed to open bottle');
        }
    };

    // Sell ML from opened bottle
    const handleSellMl = async () => {
        if (!selectedBottle || mlToSell <= 0) return;

        try {
            const shopDbName = user?.shopDbName || 'shop_db_1';
            const response = await api.post(`/shop/${shopDbName}/sell-ml`, {
                openedBottleId: selectedBottle._id,
                mlToSell: mlToSell,
            });

            if (response.data.success) {
                // Update opened bottle in list
                const updatedBottle = response.data.openedBottle;
                if (updatedBottle.status === 'empty') {
                    // Mark product as no longer having opened bottle
                    setProducts(prevProducts =>
                        prevProducts.map(p =>
                            p._id === updatedBottle.productId ? { ...p, hasOpenedBottle: false } : p
                        )
                    );
                    // Remove from active opened bottles
                    setOpenedBottles(prev => prev.filter(b => b._id !== updatedBottle._id));
                } else {
                    setOpenedBottles(prev =>
                        prev.map(b => b._id === updatedBottle._id ? updatedBottle : b)
                    );
                }

                showMessage('success', response.data.message);
                setShowSellMlModal(false);
                setSelectedBottle(null);
                setMlToSell(0);
            }
        } catch (error) {
            showMessage('error', error.response?.data?.message || 'Failed to sell ML');
        }
    };

    const toggleScanMode = () => {
        setIsScanMode(!isScanMode);
        if (!isScanMode) {
            showMessage('success', 'Scan Mode ON: Ready to scan barcodes');
            scanBufferRef.current = ''; // Reset buffer
        } else {
            showMessage('success', 'Scan Mode OFF');
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
                            <div>
                                <h1 className="text-xl font-bold text-white">Al Hadi Vapes</h1>
                                <p className="text-xs text-gray-400">{user?.shopName || 'Shop'}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            {session && (
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm text-gray-300">Session Active</p>
                                    <p className="text-xs text-gray-500">
                                        Started: {new Date(session.startTime).toLocaleTimeString()}
                                    </p>
                                </div>
                            )}
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
                {/* Message Notification */}
                {message.text && (
                    <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-900/50 border border-green-700 text-green-400' :
                        'bg-red-900/50 border border-red-700 text-red-400'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* Search and Filter */}
                <div className="card mb-6">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex-1 w-full">
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input"
                            />
                        </div>

                        {/* Scan Button */}
                        <button
                            onClick={toggleScanMode}
                            className={`px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 whitespace-nowrap ${isScanMode
                                ? 'bg-green-600 text-white animate-pulse ring-2 ring-green-400'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            {isScanMode ? 'SCANNING...' : 'Scan Barcode'}
                        </button>

                        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                            {['All', 'Device', 'Coil', 'E-Liquid'].map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setCategoryFilter(category)}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${categoryFilter === category
                                        ? 'bg-primary text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Opened Bottles Section - At Top (filter out empty bottles) */}
                {openedBottles.filter(b => b.remainingMl > 0).length > 0 && (
                    <div className="mb-6 bg-blue-900/20 rounded-xl p-4 border border-blue-500/30">
                        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            Opened Bottles ({openedBottles.filter(b => b.remainingMl > 0).length})
                        </h2>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {openedBottles.filter(b => b.remainingMl > 0).map((bottle) => (
                                <div
                                    key={bottle._id}
                                    className="flex-shrink-0 w-64 bg-gray-800 rounded-lg p-3 border border-blue-500/50"
                                >
                                    <div className="flex gap-3">
                                        {/* Bottle Image */}
                                        <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {bottle.imageUrl ? (
                                                <img
                                                    src={bottle.imageUrl.startsWith('http') ? bottle.imageUrl : `${BACKEND_URL}${bottle.imageUrl}`}
                                                    alt={bottle.productName}
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-white text-sm truncate">{bottle.productName}</h3>
                                            <div className="text-lg font-bold text-blue-400">
                                                {bottle.remainingMl}ml
                                                <span className="text-xs text-gray-500 font-normal ml-1">/ {bottle.mlCapacity}ml</span>
                                            </div>
                                            {/* Progress bar */}
                                            <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                                                <div
                                                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                                                    style={{ width: `${(bottle.remainingMl / bottle.mlCapacity) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedBottle(bottle);
                                            setMlToSell(0);
                                            setShowSellMlModal(true);
                                        }}
                                        className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-all"
                                    >
                                        + Add ML to Cart
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Products Grid */}
                {filteredProducts.length === 0 ? (
                    <div className="card text-center py-12">
                        <p className="text-gray-400 text-lg">No products found</p>
                        {isScanMode && <p className="text-green-400 mt-2">Ready to scan...</p>}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {filteredProducts.map((product) => (
                            <div
                                key={product._id}
                                className="bg-gray-800 rounded-lg p-2 border border-gray-700 hover:border-primary transition-all"
                            >
                                {/* Product Image - Smaller */}
                                <div className="h-24 bg-gray-700 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                                    {product.imageUrl ? (
                                        <img
                                            src={product.imageUrl.startsWith('http') ? product.imageUrl : `${BACKEND_URL}${product.imageUrl}`}
                                            alt={product.name}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                    )}
                                </div>

                                {/* Product Info - Compact */}
                                <h3 className="text-sm font-semibold text-white truncate" title={product.name}>{product.name}</h3>
                                <p className="text-xs text-gray-400 truncate">{product.brand}</p>

                                <div className="flex items-center justify-between mt-1 mb-2">
                                    <span className="text-base font-bold text-primary">Rs {product.pricePerUnit.toFixed(2)}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${product.units > 10 ? 'bg-green-900 text-green-400' :
                                        product.units > 0 ? 'bg-yellow-900 text-yellow-400' : 'bg-red-900 text-red-400'
                                        }`}>
                                        {product.units}
                                    </span>
                                </div>

                                {/* Add to Cart Button - Compact */}
                                <button
                                    onClick={() => addToCart(product)}
                                    disabled={product.units <= 0}
                                    className={`w-full py-1.5 rounded text-xs font-medium transition-all flex items-center justify-center gap-1 ${product.units > 0
                                        ? 'bg-gradient-primary text-white hover:opacity-90'
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    {product.units > 0 ? 'Add' : 'Out'}
                                </button>

                                {/* Open Bottle Button - E-Liquid only */}
                                {product.category === 'E-Liquid' && (
                                    <button
                                        onClick={() => handleOpenBottle(product)}
                                        disabled={product.hasOpenedBottle || product.units <= 0}
                                        className={`w-full mt-1 py-1 rounded text-xs font-medium transition-all ${!product.hasOpenedBottle && product.units > 0
                                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            }`}
                                    >
                                        {product.hasOpenedBottle ? '✓ Opened' : `Open ${product.mlCapacity}ml`}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Sell ML Modal */}
            {showSellMlModal && selectedBottle && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-4">Sell ML</h3>
                        <p className="text-gray-400 mb-2">
                            {selectedBottle.productName} - {selectedBottle.productBrand}
                        </p>
                        <p className="text-blue-400 font-bold mb-4">
                            Available: {selectedBottle.remainingMl}ml
                        </p>

                        <div className="mb-4">
                            <label className="block text-sm text-gray-300 mb-2">ML to Sell</label>
                            <input
                                type="number"
                                value={mlToSell}
                                onChange={(e) => setMlToSell(Number(e.target.value))}
                                className="input w-full"
                                placeholder="Enter ML amount"
                                min="1"
                                max={selectedBottle.remainingMl}
                            />
                        </div>

                        {/* Quick ML buttons */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {[10, 25, 50, 100, 200].map((ml) => (
                                <button
                                    key={ml}
                                    onClick={() => setMlToSell(Math.min(ml, selectedBottle.remainingMl))}
                                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                                >
                                    {ml}ml
                                </button>
                            ))}
                            <button
                                onClick={() => setMlToSell(selectedBottle.remainingMl)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                            >
                                All
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowSellMlModal(false);
                                    setSelectedBottle(null);
                                    setMlToSell(0);
                                }}
                                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => addMlToCart(selectedBottle, mlToSell)}
                                disabled={mlToSell <= 0 || mlToSell > selectedBottle.remainingMl}
                                className={`flex-1 py-2 rounded-lg font-medium ${mlToSell > 0 && mlToSell <= selectedBottle.remainingMl
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                Add {mlToSell}ml to Cart
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Cart Button */}
            <button
                onClick={() => setShowCart(true)}
                className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-primary rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-all z-40"
            >
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-sm font-bold rounded-full flex items-center justify-center">
                        {cart.length}
                    </span>
                )}
            </button>

            {/* Cart Sidebar - Now a side panel that coexists with main content */}
            {showCart && (
                <div className="fixed right-0 top-0 h-full w-80 bg-gray-800 shadow-xl z-40 border-l border-gray-700">
                    <div className="flex flex-col h-full">
                        {/* Cart Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-700">
                            <h2 className="text-xl font-bold text-white">Shopping Cart ({cart.length})</h2>
                            <button
                                onClick={() => setShowCart(false)}
                                className="p-2 hover:bg-gray-700 rounded-lg"
                            >
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <p>Cart is empty</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {cart.map((item, index) => (
                                        <div key={index} className="bg-gray-700 rounded-lg p-2">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex-1">
                                                    <h4 className="text-white font-medium text-sm">{item.productName}</h4>
                                                </div>
                                                <button
                                                    onClick={() => removeFromCart(index)}
                                                    className="p-1 text-red-400 hover:text-red-300"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                            {/* Editable Price */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs text-gray-400">Price:</span>
                                                <input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={(e) => updateCartPrice(index, Number(e.target.value))}
                                                    className="w-20 px-2 py-1 bg-gray-800 text-yellow-400 font-medium text-sm rounded border border-gray-600 focus:border-yellow-500 focus:outline-none"
                                                    min="0"
                                                    step="0.01"
                                                />
                                                <span className="text-xs text-gray-500">Rs</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                {item.type === 'product' ? (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => updateCartQty(index, item.qty - 1)}
                                                            className="w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded-lg flex items-center justify-center"
                                                        >
                                                            <span className="text-white text-lg">-</span>
                                                        </button>
                                                        <span className="text-white px-3">{item.qty}</span>
                                                        <button
                                                            onClick={() => updateCartQty(index, item.qty + 1)}
                                                            disabled={item.qty >= item.maxQty}
                                                            className="w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded-lg flex items-center justify-center disabled:opacity-50"
                                                        >
                                                            <span className="text-white text-lg">+</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-blue-400">{item.mlAmount}ml</span>
                                                )}
                                                <span className="text-lg font-bold text-green-400">
                                                    Rs {(item.price * item.qty).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Cart Footer */}
                        <div className="p-4 border-t border-gray-700">
                            {/* Subtotal */}
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-400">Subtotal</span>
                                <span className="text-lg font-medium text-white">Rs {getCartTotal().toFixed(2)}</span>
                            </div>

                            {/* Discount Input */}
                            {cart.length > 0 && (
                                <div className="mb-3 p-3 bg-gray-700/50 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-gray-300">Discount</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={discountPercent}
                                                onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                                                className="w-16 px-2 py-1 bg-gray-800 text-white text-center rounded border border-gray-600 focus:border-primary focus:outline-none"
                                            />
                                            <span className="text-gray-400">%</span>
                                        </div>
                                    </div>
                                    {/* Quick discount buttons */}
                                    <div className="flex gap-2 flex-wrap">
                                        {[0, 5, 10, 15, 20, 25].map(percent => (
                                            <button
                                                key={percent}
                                                onClick={() => setDiscountPercent(percent)}
                                                className={`px-2 py-1 text-xs rounded transition-all ${discountPercent === percent
                                                    ? 'bg-primary text-white'
                                                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                                    }`}
                                            >
                                                {percent === 0 ? 'None' : `${percent}%`}
                                            </button>
                                        ))}
                                    </div>
                                    {discountPercent > 0 && (
                                        <div className="flex justify-between items-center mt-2 text-red-400">
                                            <span className="text-sm">Discount ({discountPercent}%)</span>
                                            <span className="font-medium">-Rs {getDiscountAmount().toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Final Total */}
                            <div className="flex justify-between items-center mb-4 py-2 border-t border-gray-600">
                                <span className="text-lg font-semibold text-white">Total</span>
                                <span className="text-2xl font-bold text-green-400">Rs {getFinalTotal().toFixed(2)}</span>
                            </div>

                            <button
                                onClick={handleCheckout}
                                disabled={cart.length === 0}
                                className={`w-full py-3 rounded-lg font-semibold text-lg transition-all ${cart.length > 0
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                Checkout ({cart.length} items) - Rs {getFinalTotal().toFixed(2)}
                            </button>
                            {cart.length > 0 && (
                                <button
                                    onClick={() => { setCart([]); setDiscountPercent(0); }}
                                    className="w-full mt-2 py-2 text-red-400 hover:text-red-300 text-sm"
                                >
                                    Clear Cart
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Print Receipt Modal */}
            {showReceipt && receiptData && (
                <PrintReceipt
                    receipt={receiptData}
                    onClose={() => setShowReceipt(false)}
                />
            )}
        </div>
    );
};

export default Home;
