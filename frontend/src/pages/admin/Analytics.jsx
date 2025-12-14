import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

const Analytics = () => {
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedShop, setSelectedShop] = useState(null); // null = All Shops
    const [selectedTimeline, setSelectedTimeline] = useState('all'); // 1w, 2w, 1m, 3m, 1y, all
    const [shopProducts, setShopProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);

    useEffect(() => {
        fetchAnalyticsData();
    }, []);

    useEffect(() => {
        if (selectedShop) {
            fetchShopProducts(selectedShop._id);
        } else {
            setShopProducts([]);
        }
    }, [selectedShop]);

    const fetchAnalyticsData = async () => {
        try {
            const response = await api.get('/admin/shops');
            if (response.data.success) {
                setShops(response.data.shops);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching analytics:', error);
            setLoading(false);
        }
    };

    const fetchShopProducts = async (shopId) => {
        setLoadingProducts(true);
        try {
            const response = await api.get(`/admin/shops/${shopId}/products`);
            if (response.data.success) {
                setShopProducts(response.data.products);
            }
        } catch (error) {
            console.error('Error fetching shop products:', error);
        }
        setLoadingProducts(false);
    };

    // Timeline options
    const timelineOptions = [
        { value: '1w', label: '1 Week' },
        { value: '2w', label: '2 Weeks' },
        { value: '1m', label: '1 Month' },
        { value: '3m', label: '3 Months' },
        { value: '1y', label: '1 Year' },
        { value: 'all', label: 'All Time' },
    ];

    // Generate colors for charts
    const colors = [
        { bg: 'rgba(139, 92, 246, 0.7)', border: 'rgb(139, 92, 246)' },
        { bg: 'rgba(59, 130, 246, 0.7)', border: 'rgb(59, 130, 246)' },
        { bg: 'rgba(16, 185, 129, 0.7)', border: 'rgb(16, 185, 129)' },
        { bg: 'rgba(245, 158, 11, 0.7)', border: 'rgb(245, 158, 11)' },
        { bg: 'rgba(239, 68, 68, 0.7)', border: 'rgb(239, 68, 68)' },
        { bg: 'rgba(236, 72, 153, 0.7)', border: 'rgb(236, 72, 153)' },
        { bg: 'rgba(6, 182, 212, 0.7)', border: 'rgb(6, 182, 212)' },
        { bg: 'rgba(251, 146, 60, 0.7)', border: 'rgb(251, 146, 60)' },
    ];

    // Calculate profit data
    const calculateShopProfit = (shop) => {
        const sales = shop.stats?.allTimeSales || 0;
        const stockValue = shop.stats?.totalStockValue || 0;
        // For now, profit is sales (we'll need transaction history for accurate profit)
        return sales;
    };

    // Calculate product-level profit
    const calculateProductProfit = (product) => {
        const sellPrice = product.pricePerUnit || 0;
        const costPrice = product.costPrice || 0;
        const profitPerUnit = sellPrice - costPrice;
        const units = product.units || 0;
        return {
            profitPerUnit,
            potentialProfit: profitPerUnit * units,
            margin: costPrice > 0 ? ((profitPerUnit / sellPrice) * 100).toFixed(1) : 0
        };
    };

    // Get data for selected shop or all shops
    const getAnalyticsData = () => {
        if (selectedShop) {
            return {
                totalSales: selectedShop.stats?.allTimeSales || 0,
                todaysSales: selectedShop.stats?.todaysSales || 0,
                productCount: selectedShop.stats?.productCount || 0,
                stockValue: selectedShop.stats?.totalStockValue || 0,
                totalCost: shopProducts.reduce((sum, p) => sum + ((p.costPrice || 0) * (p.units || 0)), 0),
                potentialProfit: shopProducts.reduce((sum, p) => {
                    const profit = calculateProductProfit(p);
                    return sum + profit.potentialProfit;
                }, 0),
            };
        } else {
            return {
                totalSales: shops.reduce((sum, s) => sum + (s.stats?.allTimeSales || 0), 0),
                todaysSales: shops.reduce((sum, s) => sum + (s.stats?.todaysSales || 0), 0),
                productCount: shops.reduce((sum, s) => sum + (s.stats?.productCount || 0), 0),
                stockValue: shops.reduce((sum, s) => sum + (s.stats?.totalStockValue || 0), 0),
                totalCost: 0,
                potentialProfit: 0,
            };
        }
    };

    const analyticsData = getAnalyticsData();

    // Chart data for selected shop's products by category
    const productsByCategoryData = {
        labels: ['Device', 'Coil', 'E-Liquid'],
        datasets: [
            {
                label: 'Products',
                data: [
                    shopProducts.filter(p => p.category === 'Device').length,
                    shopProducts.filter(p => p.category === 'Coil').length,
                    shopProducts.filter(p => p.category === 'E-Liquid').length,
                ],
                backgroundColor: [colors[0].bg, colors[1].bg, colors[2].bg],
                borderColor: [colors[0].border, colors[1].border, colors[2].border],
                borderWidth: 2,
            },
        ],
    };

    // Profit by product (top 10)
    const topProfitProducts = [...shopProducts]
        .map(p => ({ ...p, profit: calculateProductProfit(p) }))
        .sort((a, b) => b.profit.potentialProfit - a.profit.potentialProfit)
        .slice(0, 10);

    const profitByProductData = {
        labels: topProfitProducts.map(p => p.name.substring(0, 15)),
        datasets: [
            {
                label: 'Potential Profit (Rs)',
                data: topProfitProducts.map(p => p.profit.potentialProfit),
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: 'rgb(16, 185, 129)',
                borderWidth: 2,
                borderRadius: 8,
            },
        ],
    };

    // Chart options
    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#fff' } },
        },
        scales: {
            x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(75, 85, 99, 0.3)' } },
            y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(75, 85, 99, 0.3)' } },
        },
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { color: '#fff', padding: 15 } },
        },
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading Analytics...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/admin"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all font-medium"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back
                        </Link>
                        <h1 className="text-2xl font-bold text-white">📊 Analytics Dashboard</h1>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                {/* Shop Selector */}
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-white mb-3">Select Shop</h2>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setSelectedShop(null)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${selectedShop === null
                                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            🏪 All Shops
                        </button>
                        {shops.map((shop, index) => (
                            <button
                                key={shop._id}
                                onClick={() => setSelectedShop(shop)}
                                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${selectedShop?._id === shop._id
                                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: colors[index % colors.length].border }}
                                />
                                {shop.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Timeline Selector (shown when shop selected) */}
                {selectedShop && (
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-white mb-3">Timeline</h2>
                        <div className="flex flex-wrap gap-2">
                            {timelineOptions.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => setSelectedTimeline(option.value)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedTimeline === option.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Note: Timeline filter will work with transaction history (coming soon)
                        </p>
                    </div>
                )}

                {/* Summary Cards */}
                <div className={`grid gap-4 mb-8 ${selectedShop ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-1 md:grid-cols-4'}`}>
                    {!selectedShop && (
                        <div className="card bg-gradient-to-br from-purple-900/50 to-purple-600/30 border border-purple-500/30">
                            <p className="text-gray-400 text-sm">Total Shops</p>
                            <p className="text-3xl font-bold text-purple-400">{shops.length}</p>
                        </div>
                    )}
                    <div className="card bg-gradient-to-br from-blue-900/50 to-blue-600/30 border border-blue-500/30">
                        <p className="text-gray-400 text-sm">Today's Sales</p>
                        <p className="text-2xl font-bold text-blue-400">Rs {analyticsData.todaysSales.toFixed(2)}</p>
                    </div>
                    <div className="card bg-gradient-to-br from-green-900/50 to-green-600/30 border border-green-500/30">
                        <p className="text-gray-400 text-sm">All-Time Sales</p>
                        <p className="text-2xl font-bold text-green-400">Rs {analyticsData.totalSales.toFixed(2)}</p>
                    </div>
                    <div className="card bg-gradient-to-br from-cyan-900/50 to-cyan-600/30 border border-cyan-500/30">
                        <p className="text-gray-400 text-sm">Products</p>
                        <p className="text-2xl font-bold text-cyan-400">{analyticsData.productCount}</p>
                    </div>
                    <div className="card bg-gradient-to-br from-yellow-900/50 to-yellow-600/30 border border-yellow-500/30">
                        <p className="text-gray-400 text-sm">Stock Value</p>
                        <p className="text-2xl font-bold text-yellow-400">Rs {analyticsData.stockValue.toFixed(2)}</p>
                    </div>
                    {selectedShop && (
                        <>
                            <div className="card bg-gradient-to-br from-red-900/50 to-red-600/30 border border-red-500/30">
                                <p className="text-gray-400 text-sm">Total Cost</p>
                                <p className="text-2xl font-bold text-red-400">Rs {analyticsData.totalCost.toFixed(2)}</p>
                            </div>
                            <div className="card bg-gradient-to-br from-emerald-900/50 to-emerald-600/30 border border-emerald-500/30">
                                <p className="text-gray-400 text-sm">💰 Potential Profit</p>
                                <p className="text-2xl font-bold text-emerald-400">Rs {analyticsData.potentialProfit.toFixed(2)}</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Shop-specific content */}
                {selectedShop ? (
                    <>
                        {/* Charts for selected shop */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            <div className="card">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-2xl">📦</span>
                                    Products by Category
                                </h2>
                                <div className="h-64">
                                    <Doughnut data={productsByCategoryData} options={doughnutOptions} />
                                </div>
                            </div>

                            <div className="card">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-2xl">💹</span>
                                    Top Products by Potential Profit
                                </h2>
                                <div className="h-64">
                                    {topProfitProducts.length > 0 ? (
                                        <Bar data={profitByProductData} options={barOptions} />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-gray-500">
                                            Add cost prices to products to see profit data
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Products Table */}
                        <div className="card">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <span className="text-2xl">📋</span>
                                Product Details - {selectedShop.name}
                            </h2>
                            {loadingProducts ? (
                                <p className="text-gray-400">Loading products...</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-700">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-gray-300">Product</th>
                                                <th className="px-4 py-3 text-left text-gray-300">Category</th>
                                                <th className="px-4 py-3 text-right text-gray-300">Units</th>
                                                <th className="px-4 py-3 text-right text-gray-300">Cost Price</th>
                                                <th className="px-4 py-3 text-right text-gray-300">Sell Price</th>
                                                <th className="px-4 py-3 text-right text-gray-300">Profit/Unit</th>
                                                <th className="px-4 py-3 text-right text-gray-300">Margin</th>
                                                <th className="px-4 py-3 text-right text-gray-300">Potential Profit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-700">
                                            {shopProducts.map(product => {
                                                const profit = calculateProductProfit(product);
                                                return (
                                                    <tr key={product._id} className="hover:bg-gray-700/50">
                                                        <td className="px-4 py-3 text-white font-medium">{product.name}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`badge ${product.category === 'Device' ? 'badge-info' :
                                                                    product.category === 'Coil' ? 'badge-warning' : 'badge-success'
                                                                }`}>
                                                                {product.category}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-gray-300">{product.units || 0}</td>
                                                        <td className="px-4 py-3 text-right text-red-400">
                                                            Rs {(product.costPrice || 0).toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-blue-400">
                                                            Rs {(product.pricePerUnit || 0).toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-green-400 font-semibold">
                                                            Rs {profit.profitPerUnit.toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className={`${profit.margin > 30 ? 'text-green-400' : profit.margin > 15 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                                {profit.margin}%
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                                                            Rs {profit.potentialProfit.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* All Shops Overview */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            <div className="card">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-2xl">💰</span>
                                    Today's Sales by Shop
                                </h2>
                                <div className="h-64">
                                    <Bar
                                        data={{
                                            labels: shops.map(s => s.name),
                                            datasets: [{
                                                label: "Today's Sales (Rs)",
                                                data: shops.map(s => s.stats?.todaysSales || 0),
                                                backgroundColor: shops.map((_, i) => colors[i % colors.length].bg),
                                                borderColor: shops.map((_, i) => colors[i % colors.length].border),
                                                borderWidth: 2,
                                                borderRadius: 8,
                                            }],
                                        }}
                                        options={barOptions}
                                    />
                                </div>
                            </div>

                            <div className="card">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-2xl">🏆</span>
                                    All-Time Sales Distribution
                                </h2>
                                <div className="h-64">
                                    <Doughnut
                                        data={{
                                            labels: shops.map(s => s.name),
                                            datasets: [{
                                                label: 'All-Time Sales (Rs)',
                                                data: shops.map(s => s.stats?.allTimeSales || 0),
                                                backgroundColor: shops.map((_, i) => colors[i % colors.length].bg),
                                                borderColor: shops.map((_, i) => colors[i % colors.length].border),
                                                borderWidth: 2,
                                            }],
                                        }}
                                        options={doughnutOptions}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Shop Details Table */}
                        <div className="card">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <span className="text-2xl">🏪</span>
                                Shop Performance
                            </h2>
                            <p className="text-sm text-gray-400 mb-4">Click a shop button above to see detailed analytics with profit calculations</p>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-gray-300">Shop</th>
                                            <th className="px-4 py-3 text-left text-gray-300">Location</th>
                                            <th className="px-4 py-3 text-right text-gray-300">Products</th>
                                            <th className="px-4 py-3 text-right text-gray-300">Today's Sales</th>
                                            <th className="px-4 py-3 text-right text-gray-300">All-Time Sales</th>
                                            <th className="px-4 py-3 text-right text-gray-300">Stock Value</th>
                                            <th className="px-4 py-3 text-center text-gray-300">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {shops.map((shop, index) => (
                                            <tr key={shop._id} className="hover:bg-gray-700/50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-4 h-4 rounded-full"
                                                            style={{ backgroundColor: colors[index % colors.length].border }}
                                                        />
                                                        <span className="text-white font-medium">{shop.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-400">{shop.location || 'N/A'}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="badge badge-info">{shop.stats?.productCount || 0}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-blue-400 font-semibold">
                                                    Rs {(shop.stats?.todaysSales || 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-green-400 font-semibold">
                                                    Rs {(shop.stats?.allTimeSales || 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-yellow-400 font-semibold">
                                                    Rs {(shop.stats?.totalStockValue || 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => setSelectedShop(shop)}
                                                        className="px-3 py-1 bg-primary/20 text-primary hover:bg-primary hover:text-white rounded-lg text-sm font-medium transition-all"
                                                    >
                                                        View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Analytics;
