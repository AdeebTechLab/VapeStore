import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const Reports = () => {
    const [shops, setShops] = useState([]);
    const [selectedShop, setSelectedShop] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchShops();
        // Set default dates (last 7 days)
        const today = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        setToDate(today.toISOString().split('T')[0]);
        setFromDate(weekAgo.toISOString().split('T')[0]);
    }, []);

    const fetchShops = async () => {
        try {
            const response = await api.get('/admin/shops');
            if (response.data.success) {
                setShops(response.data.shops);
                if (response.data.shops.length > 0) {
                    setSelectedShop(response.data.shops[0]._id);
                }
            }
        } catch (error) {
            console.error('Error fetching shops:', error);
        }
    };

    const handlePreview = async () => {
        if (!selectedShop || !fromDate || !toDate) {
            setError('Please select shop and date range');
            return;
        }

        setLoading(true);
        setError('');
        setPreview(null);

        try {
            const response = await api.get(
                `/admin/shops/${selectedShop}/sales-report?from=${fromDate}&to=${toDate}&format=json`
            );
            if (response.data.success) {
                setPreview(response.data);
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!selectedShop || !fromDate || !toDate) {
            setError('Please select shop and date range');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await api.get(
                `/admin/shops/${selectedShop}/sales-report?from=${fromDate}&to=${toDate}&format=excel`,
                { responseType: 'blob' }
            );

            // Create download link for Excel file
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            const shop = shops.find(s => s._id === selectedShop);
            const filename = `${shop?.name || 'Shop'}_sales_${fromDate}_to_${toDate}.xlsx`;
            link.setAttribute('download', filename);

            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            setError('Failed to download report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4">
                <div className="max-w-7xl mx-auto">
                    <Link
                        to="/admin"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg mb-4 transition-all font-medium"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold text-white">📊 Sales Reports</h1>
                    <p className="text-gray-400 text-sm">Download detailed sales reports for any shop</p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                {/* Report Configuration */}
                <div className="card mb-6">
                    <h2 className="text-xl font-bold text-white mb-4">Generate Report</h2>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        {/* Shop Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Select Shop</label>
                            <select
                                value={selectedShop}
                                onChange={(e) => setSelectedShop(e.target.value)}
                                className="input"
                            >
                                {shops.map((shop) => (
                                    <option key={shop._id} value={shop._id}>
                                        {shop.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* From Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">From Date</label>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="input"
                            />
                        </div>

                        {/* To Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">To Date</label>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="input"
                            />
                        </div>

                        {/* Quick Date Presets */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Quick Select</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const today = new Date();
                                        const weekAgo = new Date();
                                        weekAgo.setDate(weekAgo.getDate() - 7);
                                        setFromDate(weekAgo.toISOString().split('T')[0]);
                                        setToDate(today.toISOString().split('T')[0]);
                                    }}
                                    className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm"
                                >
                                    7 Days
                                </button>
                                <button
                                    onClick={() => {
                                        const today = new Date();
                                        const monthAgo = new Date();
                                        monthAgo.setDate(monthAgo.getDate() - 30);
                                        setFromDate(monthAgo.toISOString().split('T')[0]);
                                        setToDate(today.toISOString().split('T')[0]);
                                    }}
                                    className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm"
                                >
                                    30 Days
                                </button>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-400 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button
                            onClick={handlePreview}
                            disabled={loading}
                            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            {loading ? 'Loading...' : 'Preview Report'}
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={loading}
                            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {loading ? 'Downloading...' : 'Download CSV'}
                        </button>
                    </div>
                </div>

                {/* Report Preview */}
                {preview && (
                    <div className="card">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Report Preview</h2>
                            <div className="text-right">
                                <p className="text-gray-400">
                                    {preview.shop.name} | {preview.period.from} to {preview.period.to}
                                </p>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                                <p className="text-gray-400 text-sm">Total Transactions</p>
                                <p className="text-3xl font-bold text-white">{preview.summary.totalTransactions}</p>
                            </div>
                            <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                                <p className="text-gray-400 text-sm">Items Sold</p>
                                <p className="text-3xl font-bold text-blue-400">{preview.summary.totalItems}</p>
                            </div>
                            <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                                <p className="text-gray-400 text-sm">Total Sales</p>
                                <p className="text-3xl font-bold text-green-400">${preview.summary.totalSales.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Transactions Table */}
                        {preview.transactions.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-gray-300">Date</th>
                                            <th className="px-4 py-3 text-left text-gray-300">Time</th>
                                            <th className="px-4 py-3 text-left text-gray-300">Product</th>
                                            <th className="px-4 py-3 text-left text-gray-300">Category</th>
                                            <th className="px-4 py-3 text-left text-gray-300">Qty</th>
                                            <th className="px-4 py-3 text-left text-gray-300">Unit Price</th>
                                            <th className="px-4 py-3 text-left text-gray-300">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {preview.transactions.slice(0, 50).map((tx, index) => (
                                            <tr key={index} className="hover:bg-gray-700/50">
                                                <td className="px-4 py-3 text-gray-300">{tx.date}</td>
                                                <td className="px-4 py-3 text-gray-400">{tx.time}</td>
                                                <td className="px-4 py-3 text-white font-medium">{tx.productName}</td>
                                                <td className="px-4 py-3">
                                                    <span className="badge badge-info">{tx.category}</span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">{tx.quantity}</td>
                                                <td className="px-4 py-3 text-gray-300">${tx.unitPrice.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-green-400 font-semibold">${tx.totalPrice.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {preview.transactions.length > 50 && (
                                    <p className="text-center text-gray-500 py-4">
                                        Showing first 50 of {preview.transactions.length} transactions. Download CSV for full data.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-400">
                                No transactions found for this date range.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;
