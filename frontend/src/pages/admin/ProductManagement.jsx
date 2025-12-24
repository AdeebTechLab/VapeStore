import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { BACKEND_URL } from '../../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ProductManagement = () => {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [shopName, setShopName] = useState('Shop');
    const [hideEmptyProducts, setHideEmptyProducts] = useState(false);

    // Barcode scanning state
    const [isScanning, setIsScanning] = useState(false);
    const scanBufferRef = useRef('');
    const lastKeyTimeRef = useRef(0);

    // Form state
    const [formData, setFormData] = useState({
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
    const [customFlavour, setCustomFlavour] = useState('');

    // Common E-Liquid flavours
    const commonFlavours = [
        'Mint',
        'Menthol',
        'Tobacco',
        'Strawberry',
        'Mango',
        'Grape',
        'Watermelon',
        'Blueberry',
        'Apple',
        'Peach',
        'Cherry',
        'Vanilla',
        'Coffee',
        'Chocolate',
        'Banana',
        'Lemon',
        'Orange',
        'Pineapple',
        'Mixed Fruit',
        'Ice Cream',
        'Bubblegum',
        'Cola',
        'Energy Drink',
        'Caramel',
        'Other',
    ];

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
                        setFormData(prev => ({ ...prev, barcode: scanBufferRef.current }));
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
        fetchProducts();
        fetchOpenedBottles();
        fetchShopInfo();
    }, [shopId]);

    const fetchShopInfo = async () => {
        try {
            const response = await api.get('/admin/shops');
            if (response.data.success) {
                const shop = response.data.shops.find(s => s._id === shopId);
                if (shop) {
                    setShopName(shop.name);
                }
            }
        } catch (error) {
            console.error('Error fetching shop info:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await api.get(`/admin/shops/${shopId}/products`);
            if (response.data.success) {
                setProducts(response.data.products);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching products:', error);
            setLoading(false);
        }
    };

    // PDF Download Function
    const downloadProductsPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const today = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Header - Shop Name
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(79, 70, 229); // Purple color
        doc.text(shopName, pageWidth / 2, 20, { align: 'center' });

        // Subtitle
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Product Inventory Report', pageWidth / 2, 30, { align: 'center' });

        // Date
        doc.setFontSize(10);
        doc.text(`Generated: ${today}`, pageWidth / 2, 38, { align: 'center' });

        // Line separator
        doc.setDrawColor(79, 70, 229);
        doc.setLineWidth(0.5);
        doc.line(20, 42, pageWidth - 20, 42);

        // Summary Stats
        const totalProducts = products.length;
        const totalUnits = products.reduce((sum, p) => sum + (p.units || 0), 0);
        const totalValue = products.reduce((sum, p) => sum + ((p.units || 0) * (p.pricePerUnit || 0)), 0);
        const categories = [...new Set(products.map(p => p.category))];

        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text(`Total Products: ${totalProducts}`, 20, 52);
        doc.text(`Total Units: ${totalUnits}`, 80, 52);
        doc.text(`Total Value: Rs ${totalValue.toFixed(2)}`, 140, 52);

        // Products Table
        const tableData = products.map((product, index) => [
            index + 1,
            product.name,
            product.brand || '-',
            product.category,
            product.units || 0,
            `Rs ${(product.pricePerUnit || 0).toFixed(2)}`,
            `Rs ${((product.units || 0) * (product.pricePerUnit || 0)).toFixed(2)}`
        ]);

        // Products Section Title
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text('Products Inventory', 14, 58);

        autoTable(doc, {
            startY: 62,
            head: [['#', 'Product Name', 'Brand', 'Category', 'Units', 'Price', 'Total Value']],
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: [79, 70, 229],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 9,
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { cellWidth: 45 },
                2: { cellWidth: 25 },
                3: { halign: 'center', cellWidth: 25 },
                4: { halign: 'center', cellWidth: 15 },
                5: { halign: 'right', cellWidth: 25 },
                6: { halign: 'right', cellWidth: 30 }
            },
            alternateRowStyles: {
                fillColor: [245, 245, 250]
            },
            margin: { left: 10, right: 10 }
        });

        // Get Y position after products table
        let currentY = doc.previousAutoTable?.finalY || 150;

        // Opened Bottles Section (if any)
        if (openedBottles && openedBottles.length > 0) {
            currentY += 15;

            // Check if we need a new page
            if (currentY > 250) {
                doc.addPage();
                currentY = 20;
            }

            // Opened Bottles Section Title
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(16, 185, 129); // Green color
            doc.text('Opened E-Liquid Bottles', 14, currentY);

            const bottlesData = openedBottles.map((bottle, index) => [
                index + 1,
                bottle.productName || '-',
                bottle.productBrand || '-',
                `${bottle.mlCapacity || 0}ml`,
                `${bottle.remainingMl || 0}ml`,
                `${(((bottle.remainingMl || 0) / (bottle.mlCapacity || 1)) * 100).toFixed(0)}%`,
                new Date(bottle.openedAt).toLocaleDateString()
            ]);

            autoTable(doc, {
                startY: currentY + 4,
                head: [['#', 'Product Name', 'Brand', 'Capacity', 'Remaining', '% Left', 'Opened Date']],
                body: bottlesData,
                theme: 'striped',
                headStyles: {
                    fillColor: [16, 185, 129],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center'
                },
                bodyStyles: {
                    fontSize: 9,
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 30 },
                    3: { halign: 'center', cellWidth: 22 },
                    4: { halign: 'center', cellWidth: 22 },
                    5: { halign: 'center', cellWidth: 18 },
                    6: { halign: 'center', cellWidth: 28 }
                },
                alternateRowStyles: {
                    fillColor: [240, 253, 244]
                },
                margin: { left: 10, right: 10 }
            });

            currentY = doc.previousAutoTable?.finalY || currentY + 50;
        }

        // Footer
        const finalY = currentY + 15;
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('Al Hadi Vapes - Product Inventory Report', pageWidth / 2, finalY, { align: 'center' });

        // Save PDF
        doc.save(`${shopName.replace(/\s+/g, '_')}_Products_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    // Opened bottles state and functions
    const [openedBottles, setOpenedBottles] = useState([]);

    const fetchOpenedBottles = async () => {
        try {
            const response = await api.get(`/admin/shops/${shopId}/opened-bottles`);
            if (response.data.success) {
                setOpenedBottles(response.data.openedBottles);
            }
        } catch (error) {
            console.error('Error fetching opened bottles:', error);
        }
    };

    const handleDeleteBottle = async (bottleId) => {
        if (!confirm('Are you sure you want to delete this opened bottle?')) return;

        try {
            await api.delete(`/admin/shops/${shopId}/opened-bottles/${bottleId}`);
            setOpenedBottles(openedBottles.filter(b => b._id !== bottleId));
            // Refresh products to update hasOpenedBottle flag
            fetchProducts();
            alert('Opened bottle deleted successfully!');
        } catch (error) {
            alert('Failed to delete opened bottle');
        }
    };

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setImageFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const data = new FormData();
        data.append('name', formData.name);
        data.append('brand', formData.brand);
        data.append('category', formData.category);
        data.append('units', formData.units);
        data.append('pricePerUnit', formData.pricePerUnit);
        data.append('costPrice', formData.costPrice);
        data.append('shortDescription', formData.shortDescription);
        data.append('barcode', formData.barcode);
        if (formData.category === 'E-Liquid') {
            data.append('mlCapacity', formData.mlCapacity);
            data.append('flavour', formData.flavour);
        }

        if (imageFile) {
            data.append('image', imageFile);
        }

        try {
            const response = await api.post(`/admin/shops/${shopId}/products`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                const returnedProduct = response.data.product;

                if (response.data.merged) {
                    // Product was merged - update existing product in list
                    setProducts(products.map(p =>
                        p._id === returnedProduct._id ? returnedProduct : p
                    ));
                    alert(response.data.message);
                } else {
                    // New product created - add to list
                    setProducts([returnedProduct, ...products]);
                    alert('Product added successfully!');
                }

                // Reset form
                setFormData({
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
                setShowAddForm(false);
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to add product');
        }
    };

    const handleDelete = async (productId) => {
        if (!confirm('Are you sure you want to delete this product?')) return;

        try {
            await api.delete(`/admin/shops/${shopId}/products/${productId}`);
            setProducts(products.filter(p => p._id !== productId));
            alert('Product deleted successfully!');
        } catch (error) {
            alert('Failed to delete product');
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <Link
                            to="/admin"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg mb-4 transition-all font-medium"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Dashboard
                        </Link>
                        <h1 className="text-2xl font-bold text-white">Product Management</h1>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={downloadProductsPDF}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download PDF
                        </button>
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="btn-primary"
                        >
                            {showAddForm ? 'Cancel' : '+ Add Product'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                {/* Add Product Form */}
                {showAddForm && (
                    <div className="card mb-6">
                        <h2 className="text-xl font-bold text-white mb-4">Add New Product</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Product Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="input"
                                        placeholder="e.g., SMOK Nord 4"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Brand</label>
                                    <input
                                        type="text"
                                        value={formData.brand}
                                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                        className="input"
                                        placeholder="e.g., SMOK"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Category *</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="input"
                                        required
                                    >
                                        <option value="Device">Device</option>
                                        <option value="Coil">Coil</option>
                                        <option value="E-Liquid">E-Liquid</option>
                                    </select>
                                </div>
                                {/* ML Capacity - only for E-Liquid */}
                                {formData.category === 'E-Liquid' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">ML Capacity *</label>
                                        <input
                                            type="number"
                                            value={formData.mlCapacity}
                                            onChange={(e) => setFormData({ ...formData, mlCapacity: Number(e.target.value) })}
                                            className="input"
                                            placeholder="e.g., 100, 500, 1000"
                                            min="1"
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Total ML per bottle</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Stock Quantity *</label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, units: Math.max(1, (Number(formData.units) || 1) - 1) })}
                                            className="w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold text-xl transition-colors"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            value={formData.units}
                                            onChange={(e) => setFormData({ ...formData, units: Number(e.target.value) || '' })}
                                            className="input text-center flex-1"
                                            placeholder="1"
                                            min="1"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, units: (Number(formData.units) || 0) + 1 })}
                                            className="w-10 h-10 bg-primary hover:bg-primary-dark text-white rounded-lg font-bold text-xl transition-colors"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Price per Unit ($) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.pricePerUnit}
                                        onChange={(e) => setFormData({ ...formData, pricePerUnit: Number(e.target.value) })}
                                        className="input"
                                        placeholder="e.g., 29.99"
                                        min="0"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Selling price (visible to shopkeepers)</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Cost Price (Rs)
                                        <span className="text-xs text-yellow-400 ml-1">📊 For Analytics</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.costPrice}
                                        onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                                        className="input"
                                        placeholder="e.g., 15.00"
                                        min="0"
                                    />
                                    <p className="text-xs text-yellow-500 mt-1">🔒 Hidden from shopkeepers - used for profit calculation</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Barcode / Scan Code (Optional)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={formData.barcode}
                                            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
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
                                    {formData.barcode && !isScanning && (
                                        <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                                            <span className="text-green-400">✓</span> Barcode: {formData.barcode}
                                        </p>
                                    )}
                                </div>
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
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Description (Optional)</label>
                                    <textarea
                                        value={formData.shortDescription}
                                        onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                                        className="input"
                                        placeholder="Brief product description..."
                                        rows="3"
                                    />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary">Add Product</button>
                        </form>
                    </div>
                )
                }

                {/* Products List */}
                <div className="card">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">Products ({(hideEmptyProducts ? products.filter(p => p.units > 0) : products).length})</h2>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-sm text-gray-400">Hide Empty</span>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={hideEmptyProducts}
                                    onChange={(e) => setHideEmptyProducts(e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-10 h-5 rounded-full transition-colors ${hideEmptyProducts ? 'bg-primary' : 'bg-gray-600'}`}></div>
                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${hideEmptyProducts ? 'translate-x-5' : ''}`}></div>
                            </div>
                        </label>
                    </div>

                    {products.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <p className="text-gray-400 text-lg mb-2">No products yet</p>
                            <p className="text-gray-500 text-sm">Click "Add Product" to create your first product</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-gray-300">Image</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Name</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Brand</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Category</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Stock</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Price</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Barcode</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {(hideEmptyProducts ? products.filter(p => p.units > 0) : products).map((product) => (
                                        <tr key={product._id} className="hover:bg-gray-700/50">
                                            <td className="px-4 py-3">
                                                {product.imageUrl ? (
                                                    <img
                                                        src={product.imageUrl.startsWith('http') ? product.imageUrl : `${BACKEND_URL}${product.imageUrl}`}
                                                        alt={product.name}
                                                        className="w-10 h-10 object-cover rounded"
                                                        onError={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <div
                                                    className="w-10 h-10 bg-gray-600 rounded items-center justify-center text-xs text-gray-400"
                                                    style={{ display: product.imageUrl ? 'none' : 'flex' }}
                                                >
                                                    No Img
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-white font-medium">{product.name}</td>
                                            <td className="px-4 py-3 text-gray-300">{product.brand || '-'}</td>
                                            <td className="px-4 py-3">
                                                <span className="badge badge-info">{product.category}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`badge ${product.units > 10 ? 'badge-success' :
                                                    product.units > 0 ? 'badge-warning' : 'badge-danger'
                                                    }`}>
                                                    {product.units} units
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-green-400 font-semibold">${product.pricePerUnit.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-gray-400 font-mono text-xs">{product.barcode || '-'}</td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleDelete(product._id)}
                                                    className="btn-danger text-sm px-3 py-1"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div >

            {/* Opened Bottles Section */}
            {
                openedBottles.length > 0 && (
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
                        <div className="card">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                Opened Bottles ({openedBottles.length})
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-gray-300">Product</th>
                                            <th className="px-4 py-3 text-left text-gray-300">Brand</th>
                                            <th className="px-4 py-3 text-left text-gray-300">Remaining</th>
                                            <th className="px-4 py-3 text-left text-gray-300">Status</th>
                                            <th className="px-4 py-3 text-left text-gray-300">Opened By</th>
                                            <th className="px-4 py-3 text-left text-gray-300">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {openedBottles.map((bottle) => (
                                            <tr key={bottle._id} className="hover:bg-gray-700/50">
                                                <td className="px-4 py-3 text-white font-medium">{bottle.productName}</td>
                                                <td className="px-4 py-3 text-gray-400">{bottle.productBrand}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`font-bold ${bottle.remainingMl > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                                        {bottle.remainingMl}ml / {bottle.mlCapacity}ml
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`badge ${bottle.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                                                        {bottle.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-400">{bottle.openedBy}</td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => handleDeleteBottle(bottle._id)}
                                                        className="btn-danger text-sm px-3 py-1"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ProductManagement;
