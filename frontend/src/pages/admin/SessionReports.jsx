import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { connectSocket, joinAdminRoom, onSessionEnded, onSaleCompleted } from '../../services/socketService';

const SessionReports = () => {
    const { shopId } = useParams();
    const [reports, setReports] = useState([]);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    const [totalCount, setTotalCount] = useState(0);

    // Filters
    const [selectedShopkeeper, setSelectedShopkeeper] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Deposit input for inline editing
    const [depositInputs, setDepositInputs] = useState({});
    const [depositingId, setDepositingId] = useState(null);

    // Show all or limited
    const [showAll, setShowAll] = useState(false);
    const [showAllSpendings, setShowAllSpendings] = useState(false);
    const DISPLAY_LIMIT = 6;
    const SPENDING_LIMIT = 3;

    // Spending section filters
    const [spendingNameFilter, setSpendingNameFilter] = useState('');
    const [spendingDateFilter, setSpendingDateFilter] = useState('');

    // Selected sold item for viewing details
    const [selectedItem, setSelectedItem] = useState(null);

    // Get unique shopkeepers from reports
    const shopkeepers = useMemo(() => {
        const names = [...new Set(reports.map(r => r.shopkeeperUsername))];
        return names.sort();
    }, [reports]);

    // Filter reports by shopkeeper and date
    const filteredReports = useMemo(() => {
        let filtered = reports;

        // Filter by shopkeeper
        if (selectedShopkeeper !== 'all') {
            filtered = filtered.filter(r => r.shopkeeperUsername === selectedShopkeeper);
        }

        // Filter by date range
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(r => new Date(r.endTime) >= fromDate);
        }
        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(r => new Date(r.endTime) <= toDate);
        }

        return filtered;
    }, [reports, selectedShopkeeper, dateFrom, dateTo]);

    useEffect(() => {
        fetchReports();

        // Connect to socket for real-time updates
        connectSocket();
        joinAdminRoom();

        const unsubSession = onSessionEnded(() => fetchReports());
        const unsubSale = onSaleCompleted(() => fetchReports()); // Refresh on sale for live data

        // Auto-refresh every 30 seconds to keep active sessions live
        const refreshInterval = setInterval(() => {
            fetchReports();
        }, 30000);

        return () => {
            unsubSession?.();
            unsubSale?.();
            clearInterval(refreshInterval);
        };
    }, [shopId]);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/admin/shops/${shopId}/session-reports?limit=100`);
            if (response.data.success) {
                setReports(response.data.reports);
                setShop(response.data.shop);
                setTotalCount(response.data.pagination?.totalCount || response.data.reports.length);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching session reports:', error);
            setLoading(false);
        }
    };

    const handleViewDetails = async (reportId) => {
        try {
            const response = await api.get(`/admin/shops/${shopId}/session-reports/${reportId}`);
            if (response.data.success) {
                setSelectedReport(response.data.report);
            }
        } catch (error) {
            alert('Failed to load report details');
        }
    };

    const handleDelete = async (reportId) => {
        if (!confirm('Are you sure you want to delete this report?')) return;

        try {
            await api.delete(`/admin/shops/${shopId}/session-reports/${reportId}`);
            setReports(reports.filter(r => r._id !== reportId));
            if (selectedReport?._id === reportId) {
                setSelectedReport(null);
            }
        } catch (error) {
            alert('Failed to delete report');
        }
    };

    const handleDeposit = async (session, e) => {
        e.stopPropagation(); // Prevent card click
        const depositAmount = parseFloat(depositInputs[session._id]) || 0;

        if (depositAmount <= 0) {
            alert('Please enter a valid deposit amount');
            return;
        }

        const currentRemaining = session.totalAmount - (session.cashSubmitted || 0);

        if (depositAmount > currentRemaining) {
            alert(`Cannot deposit more than remaining balance (Rs ${currentRemaining.toFixed(2)})`);
            return;
        }

        setDepositingId(session._id);

        try {
            const newCashSubmitted = (session.cashSubmitted || 0) + depositAmount;

            const response = await api.put(
                `/admin/shops/${shopId}/session-reports/${session._id}/reconcile`,
                { cashSubmitted: newCashSubmitted }
            );

            if (response.data.success) {
                setReports(prev =>
                    prev.map(s =>
                        s._id === session._id
                            ? {
                                ...s,
                                cashSubmitted: response.data.report.cashSubmitted,
                                remainingBalance: response.data.report.remainingBalance,
                                isReconciled: response.data.report.isReconciled,
                            }
                            : s
                    )
                );
                setDepositInputs(prev => ({ ...prev, [session._id]: '' }));
            }
        } catch (error) {
            alert('Failed to record deposit');
        } finally {
            setDepositingId(null);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDuration = (start, end) => {
        const ms = new Date(end) - new Date(start);
        const minutes = Math.floor(ms / 60000);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    const displayedReports = showAll ? filteredReports : filteredReports.slice(0, DISPLAY_LIMIT);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

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
                    <h1 className="text-2xl font-bold text-white">
                        Shopkeeper Reports - {shop?.name || 'Shop'}
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Click any session card to view details • Track deposits inline
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Session Cards with Integrated Reconciliation */}
                    <div className="lg:col-span-2">
                        {/* Filter Bar */}
                        <div className="bg-gray-800 rounded-xl p-4 mb-6">
                            <div className="flex flex-wrap items-center gap-4">
                                {/* Title and Count */}
                                <h2 className="text-xl font-bold text-white flex-shrink-0">
                                    📋 Sessions ({filteredReports.length})
                                </h2>

                                <div className="flex-1"></div>

                                {/* Shopkeeper Filter */}
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-gray-400 hidden sm:block">Shopkeeper:</label>
                                    <select
                                        value={selectedShopkeeper}
                                        onChange={(e) => {
                                            setSelectedShopkeeper(e.target.value);
                                            setShowAll(false);
                                        }}
                                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
                                    >
                                        <option value="all">All Shopkeepers</option>
                                        {shopkeepers.map(sk => (
                                            <option key={sk} value={sk}>{sk}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Date From */}
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-gray-400 hidden sm:block">From:</label>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => {
                                            setDateFrom(e.target.value);
                                            setShowAll(false);
                                        }}
                                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
                                    />
                                </div>

                                {/* Date To */}
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-gray-400 hidden sm:block">To:</label>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => {
                                            setDateTo(e.target.value);
                                            setShowAll(false);
                                        }}
                                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
                                    />
                                </div>

                                {/* Clear Filters */}
                                {(selectedShopkeeper !== 'all' || dateFrom || dateTo) && (
                                    <button
                                        onClick={() => {
                                            setSelectedShopkeeper('all');
                                            setDateFrom('');
                                            setDateTo('');
                                            setShowAll(false);
                                        }}
                                        className="px-3 py-2 bg-red-600/20 hover:bg-red-600 border border-red-600 text-red-400 hover:text-white rounded-lg text-sm transition-all"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {reports.length === 0 ? (
                            <div className="card text-center py-12 text-gray-400">
                                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-lg">No session reports yet</p>
                                <p className="text-sm mt-1">Active sessions will appear here in real-time</p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {displayedReports.map((session) => {
                                        const remaining = session.totalAmount - (session.cashSubmitted || 0);
                                        const isFullyPaid = remaining <= 0;
                                        const isActive = session.isActive; // Check if session is active

                                        return (
                                            <div
                                                key={session._id}
                                                className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-lg ${isActive
                                                    ? 'bg-green-900/30 border-green-500 shadow-green-500/20 animate-pulse-subtle'
                                                    : selectedReport?._id === session._id
                                                        ? 'bg-primary/10 border-primary shadow-primary/20'
                                                        : isFullyPaid
                                                            ? 'bg-green-900/20 border-green-600/50 hover:border-green-500'
                                                            : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                                                    }`}
                                                onClick={() => isActive ? setSelectedReport(session) : handleViewDetails(session._id)}
                                            >
                                                {/* Header Row */}
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${isActive
                                                            ? 'bg-green-500 text-white animate-pulse'
                                                            : isFullyPaid
                                                                ? 'bg-green-600 text-white'
                                                                : 'bg-primary/20 text-primary'
                                                            }`}>
                                                            {session.shopkeeperUsername?.charAt(0).toUpperCase() || '?'}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-white">{session.shopkeeperUsername}</p>
                                                            <p className="text-xs text-gray-400">
                                                                {isActive
                                                                    ? `Started: ${formatDate(session.startTime)}`
                                                                    : formatDate(session.endTime)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {isActive ? (
                                                        <span className="px-3 py-1 bg-green-500 text-white text-xs rounded-full font-bold flex items-center gap-1 animate-pulse">
                                                            <span className="w-2 h-2 bg-white rounded-full"></span>
                                                            LIVE
                                                        </span>
                                                    ) : isFullyPaid ? (
                                                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full font-medium">
                                                            ✓ Cleared
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-yellow-600/30 text-yellow-400 text-xs rounded-full font-medium">
                                                            Pending
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Stats Grid */}
                                                <div className="grid grid-cols-3 gap-2 mb-3">
                                                    <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                                                        <p className="text-xs text-gray-400">Sales</p>
                                                        <p className="text-green-400 font-bold">Rs {session.totalAmount?.toFixed(0) || 0}</p>
                                                    </div>
                                                    <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                                                        <p className="text-xs text-gray-400">Deposited</p>
                                                        <p className="text-blue-400 font-bold">Rs {(session.cashSubmitted || 0).toFixed(0)}</p>
                                                    </div>
                                                    <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                                                        <p className="text-xs text-gray-400">Remaining</p>
                                                        <p className={`font-bold ${remaining > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                            Rs {remaining.toFixed(0)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Items Sold Badge */}
                                                <div className="flex justify-between items-center text-xs text-gray-400 mb-3">
                                                    <span>🛒 {session.totalItemsSold || 0} items</span>
                                                    <span>⏱️ {formatDuration(session.startTime, session.endTime)}</span>
                                                </div>

                                                {/* Inline Deposit - Only show if not fully paid */}
                                                {!isFullyPaid && (
                                                    <div
                                                        className="flex items-center gap-2 pt-3 border-t border-gray-700"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <input
                                                            type="number"
                                                            placeholder="Enter deposit..."
                                                            value={depositInputs[session._id] || ''}
                                                            onChange={(e) => setDepositInputs(prev => ({
                                                                ...prev,
                                                                [session._id]: e.target.value
                                                            }))}
                                                            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-green-500 focus:outline-none"
                                                            min="0"
                                                        />
                                                        <button
                                                            onClick={(e) => handleDeposit(session, e)}
                                                            disabled={depositingId === session._id || !depositInputs[session._id]}
                                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                                                        >
                                                            {depositingId === session._id ? '...' : 'Deposit'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* See All / See Less Toggle */}
                                {filteredReports.length > DISPLAY_LIMIT && (
                                    <button
                                        onClick={() => setShowAll(!showAll)}
                                        className="w-full mt-6 py-3 text-center bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors font-medium"
                                    >
                                        {showAll ? '← Show Less' : `See All ${filteredReports.length} Sessions →`}
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {/* Right Column - Instructions when no report selected */}
                    <div className="lg:col-span-1">
                        <div className="card sticky top-4">
                            <h2 className="text-xl font-bold text-white mb-4">📋 Session Details</h2>
                            <div className="text-center py-12 text-gray-500">
                                <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                </svg>
                                <p>Click a session card</p>
                                <p className="text-sm mt-1">to view full details</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* FULL SCREEN SESSION DETAILS MODAL */}
            {selectedReport && (
                <div className="fixed inset-0 bg-gray-900 z-50 overflow-y-auto">
                    <div className="min-h-screen">
                        {/* Modal Header */}
                        <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
                            <div className="max-w-6xl mx-auto px-4 py-4">
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={() => {
                                            setSelectedReport(null);
                                            setSelectedItem(null);
                                        }}
                                        className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white rounded-xl transition-all font-semibold shadow-lg"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                        Back to Sessions
                                    </button>
                                    <div className="text-right">
                                        <p className="text-white font-bold text-lg">{selectedReport.shopkeeperUsername}</p>
                                        <p className="text-gray-400 text-sm">{formatDate(selectedReport.endTime)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="max-w-6xl mx-auto px-4 py-6">
                            {/* Session Info Header */}
                            <div className="bg-gradient-to-r from-primary/20 via-purple-900/20 to-secondary/20 rounded-2xl p-6 mb-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                    <div>
                                        <p className="text-gray-400 text-sm">Started</p>
                                        <p className="text-white font-semibold">{formatDate(selectedReport.startTime)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-sm">Ended</p>
                                        <p className="text-white font-semibold">{formatDate(selectedReport.endTime)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-sm">Duration</p>
                                        <p className="text-primary font-semibold">{formatDuration(selectedReport.startTime, selectedReport.endTime)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-sm">Items Sold</p>
                                        <p className="text-blue-400 font-bold text-xl">{selectedReport.totalItemsSold}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method Breakdown */}
                            {(() => {
                                // Calculate payment method totals
                                const paymentTotals = {
                                    Cash: 0,
                                    EasyPaisa: 0,
                                    JazzCash: 0,
                                    Card: 0,
                                    'Bank Transfer': 0,
                                    Other: 0
                                };

                                selectedReport.soldItems?.forEach(item => {
                                    const method = item.paymentMethod || 'Cash';
                                    if (paymentTotals.hasOwnProperty(method)) {
                                        paymentTotals[method] += item.totalPrice || 0;
                                    } else {
                                        paymentTotals.Other += item.totalPrice || 0;
                                    }
                                });

                                // Filter out zero amounts
                                const activePayments = Object.entries(paymentTotals).filter(([_, amount]) => amount > 0);

                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                        {/* Total Sales - Always First */}
                                        <div className="bg-gradient-to-br from-green-900/50 to-green-700/30 border border-green-500/30 p-5 rounded-2xl">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-2xl">💰</span>
                                                <p className="text-gray-300 font-medium">Total Sales</p>
                                            </div>
                                            <p className="text-3xl font-bold text-green-400">Rs {selectedReport.totalAmount?.toFixed(0)}</p>
                                        </div>

                                        {/* Cash Payments */}
                                        <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-700/20 border border-emerald-500/20 p-5 rounded-2xl">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-2xl">💵</span>
                                                <p className="text-gray-300 font-medium">Cash Received</p>
                                            </div>
                                            <p className="text-2xl font-bold text-emerald-400">Rs {paymentTotals.Cash.toFixed(0)}</p>
                                        </div>

                                        {/* Online Payments Combined */}
                                        <div className="bg-gradient-to-br from-purple-900/40 to-purple-700/20 border border-purple-500/20 p-5 rounded-2xl">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-2xl">📱</span>
                                                <p className="text-gray-300 font-medium">Online Payments</p>
                                            </div>
                                            <p className="text-2xl font-bold text-purple-400">
                                                Rs {(paymentTotals.EasyPaisa + paymentTotals.JazzCash + paymentTotals.Card + paymentTotals['Bank Transfer']).toFixed(0)}
                                            </p>
                                            {/* Breakdown */}
                                            <div className="mt-3 space-y-1 text-sm">
                                                {paymentTotals.EasyPaisa > 0 && (
                                                    <div className="flex justify-between text-purple-300">
                                                        <span>EasyPaisa</span>
                                                        <span>Rs {paymentTotals.EasyPaisa.toFixed(0)}</span>
                                                    </div>
                                                )}
                                                {paymentTotals.JazzCash > 0 && (
                                                    <div className="flex justify-between text-red-300">
                                                        <span>JazzCash</span>
                                                        <span>Rs {paymentTotals.JazzCash.toFixed(0)}</span>
                                                    </div>
                                                )}
                                                {paymentTotals.Card > 0 && (
                                                    <div className="flex justify-between text-blue-300">
                                                        <span>Card</span>
                                                        <span>Rs {paymentTotals.Card.toFixed(0)}</span>
                                                    </div>
                                                )}
                                                {paymentTotals['Bank Transfer'] > 0 && (
                                                    <div className="flex justify-between text-cyan-300">
                                                        <span>Bank Transfer</span>
                                                        <span>Rs {paymentTotals['Bank Transfer'].toFixed(0)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Sold Items Section - Grouped by Checkout */}
                            <div className="bg-gray-800 rounded-2xl p-6">
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span>🛒</span>
                                    Sales ({(() => {
                                        const checkoutIds = new Set(selectedReport.soldItems?.map(item => item.checkoutId).filter(Boolean));
                                        return checkoutIds.size || (selectedReport.soldItems?.length > 0 ? 1 : 0);
                                    })()})
                                </h3>

                                {selectedReport.soldItems?.length > 0 ? (
                                    <div className="space-y-4">
                                        {(() => {
                                            // Group items by checkoutId
                                            const checkoutGroups = {};
                                            selectedReport.soldItems.forEach(item => {
                                                const checkoutKey = item.checkoutId || 'legacy-' + (item.soldAt || 'unknown');
                                                if (!checkoutGroups[checkoutKey]) {
                                                    checkoutGroups[checkoutKey] = {
                                                        items: [],
                                                        customerName: item.customerName,
                                                        customerPhone: item.customerPhone,
                                                        customerEmail: item.customerEmail,
                                                        paymentMethod: item.paymentMethod,
                                                        soldAt: item.soldAt,
                                                    };
                                                }
                                                checkoutGroups[checkoutKey].items.push(item);
                                            });

                                            // Convert to array and sort by date (most recent first)
                                            const checkouts = Object.entries(checkoutGroups)
                                                .sort((a, b) => new Date(b[1].soldAt) - new Date(a[1].soldAt));

                                            return checkouts.map(([checkoutId, checkout], checkoutIdx) => {
                                                // Calculate totals for this checkout
                                                const cartTotal = checkout.items.reduce((sum, item) => {
                                                    const basePrice = item.cartPrice || item.originalPrice || item.pricePerUnit;
                                                    return sum + (basePrice * item.qty);
                                                }, 0);
                                                const paidTotal = checkout.items.reduce((sum, item) => sum + item.totalPrice, 0);
                                                const checkoutDiscount = cartTotal - paidTotal;
                                                const discountPercent = cartTotal > 0 ? ((checkoutDiscount / cartTotal) * 100).toFixed(1) : 0;

                                                return (
                                                    <div key={checkoutId} className="bg-gray-700/50 rounded-xl border border-gray-600/50 overflow-hidden">
                                                        {/* Checkout Header */}
                                                        <div className="bg-gray-700 px-4 py-3 flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg">🧾</span>
                                                                <span className="text-white font-semibold">Sale #{checkouts.length - checkoutIdx}</span>
                                                                {checkout.soldAt && (
                                                                    <span className="text-gray-400 text-sm">
                                                                        • {new Date(checkout.soldAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-green-400 font-bold text-lg">Rs {paidTotal.toFixed(0)}</span>
                                                        </div>

                                                        {/* Items in this checkout */}
                                                        <div className="p-4 space-y-2">
                                                            {checkout.items.map((item, itemIdx) => {
                                                                const hasManualEdit = item.cartPrice && item.originalPrice && item.cartPrice !== item.originalPrice;
                                                                const isMarkup = hasManualEdit && item.cartPrice > item.originalPrice;

                                                                return (() => {
                                                                    // Calculate actual paid unit price
                                                                    const paidUnitPrice = item.totalPrice ? (item.totalPrice / item.qty) : (item.pricePerUnit || item.cartPrice || item.originalPrice);
                                                                    const cartUnitPrice = item.cartPrice || item.originalPrice || item.pricePerUnit;
                                                                    const hasCheckoutDiscount = paidUnitPrice < cartUnitPrice;

                                                                    return (
                                                                        <div key={itemIdx} className="flex justify-between items-center py-2 border-b border-gray-600/30 last:border-0">
                                                                            <div>
                                                                                <p className="text-white">{item.productName}</p>
                                                                                <div className="text-sm">
                                                                                    {hasManualEdit ? (
                                                                                        <span className={isMarkup ? 'text-blue-400' : 'text-green-400'}>
                                                                                            <span className="text-gray-500 line-through mr-1">Rs {item.originalPrice?.toFixed(0)}</span>
                                                                                            → Rs {item.cartPrice?.toFixed(0)}
                                                                                        </span>
                                                                                    ) : hasCheckoutDiscount ? (
                                                                                        <span className="text-purple-400">
                                                                                            <span className="text-gray-500 line-through mr-1">Rs {cartUnitPrice?.toFixed(0)}</span>
                                                                                            → Rs {paidUnitPrice?.toFixed(0)} × {item.qty}
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-gray-400">{item.qty}x @ Rs {paidUnitPrice?.toFixed(0)}</span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <span className={`font-medium ${hasCheckoutDiscount ? 'text-purple-400' : 'text-gray-300'}`}>Rs {(item.totalPrice || (cartUnitPrice * item.qty)).toFixed(0)}</span>
                                                                        </div>
                                                                    );
                                                                })();
                                                            })}
                                                        </div>

                                                        {/* Checkout Summary */}
                                                        <div className="bg-gray-800/50 px-4 py-3 space-y-1">
                                                            {checkoutDiscount > 1 && (
                                                                <>
                                                                    <div className="flex justify-between text-sm text-gray-400">
                                                                        <span>Cart Total</span>
                                                                        <span>Rs {cartTotal.toFixed(0)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-sm text-purple-400">
                                                                        <span>Discount ({discountPercent}%)</span>
                                                                        <span>-Rs {checkoutDiscount.toFixed(0)}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                            <div className="flex justify-between font-bold text-green-400 pt-1 border-t border-gray-600/30">
                                                                <span>Total Paid</span>
                                                                <span>Rs {paidTotal.toFixed(0)}</span>
                                                            </div>
                                                        </div>

                                                        {/* Customer & Payment Info */}
                                                        <div className="px-4 py-3 flex justify-between items-center bg-gray-800/30">
                                                            <span className={`text-xs px-3 py-1 rounded-full font-medium ${checkout.paymentMethod === 'Cash' ? 'bg-green-900/50 text-green-300 border border-green-700' :
                                                                checkout.paymentMethod === 'EasyPaisa' ? 'bg-purple-900/50 text-purple-300 border border-purple-700' :
                                                                    checkout.paymentMethod === 'JazzCash' ? 'bg-red-900/50 text-red-300 border border-red-700' :
                                                                        'bg-blue-900/50 text-blue-300 border border-blue-700'
                                                                }`}>
                                                                {checkout.paymentMethod || 'Cash'}
                                                            </span>
                                                            {checkout.customerName && (
                                                                <span className="text-gray-400 text-sm">👤 {checkout.customerName}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        <p>No items sold in this session</p>
                                    </div>
                                )}

                                {/* Delete Button */}
                                <div className="mt-6 flex justify-center">
                                    <button
                                        onClick={() => {
                                            handleDelete(selectedReport._id);
                                            setSelectedReport(null);
                                        }}
                                        className="px-8 py-3 bg-red-600/20 hover:bg-red-600 border border-red-600 text-red-400 hover:text-white rounded-xl font-medium transition-all"
                                    >
                                        🗑️ Delete This Report
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Separate Spendings Section - Session Based Cards */}
            {(() => {
                // Get sessions with spendings
                const sessionsWithSpendings = reports
                    .filter(r => r.spendings && r.spendings.length > 0)
                    .sort((a, b) => new Date(b.endTime) - new Date(a.endTime));

                if (sessionsWithSpendings.length === 0) return null;

                // Get unique shopkeepers from spending sessions
                const spendingShopkeepers = [...new Set(sessionsWithSpendings.map(s => s.shopkeeperUsername))].sort();

                // Apply spending section filters
                let filteredSpendingSessions = sessionsWithSpendings;
                if (spendingNameFilter) {
                    filteredSpendingSessions = filteredSpendingSessions.filter(s =>
                        s.shopkeeperUsername === spendingNameFilter
                    );
                }
                if (spendingDateFilter) {
                    const filterDate = new Date(spendingDateFilter);
                    filteredSpendingSessions = filteredSpendingSessions.filter(s => {
                        const sessionDate = new Date(s.endTime);
                        return sessionDate.toDateString() === filterDate.toDateString();
                    });
                }

                const displayedSessions = showAllSpendings
                    ? filteredSpendingSessions
                    : filteredSpendingSessions.slice(0, SPENDING_LIMIT);

                const totalSpending = filteredSpendingSessions.reduce((sum, s) => sum + (s.totalSpending || 0), 0);

                return (
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
                        <div className="bg-gray-800/50 rounded-xl border border-orange-600/30 p-4">
                            {/* Header with Filters */}
                            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                                <h2 className="text-lg font-bold text-white">
                                    💰 Today's Spendings ({filteredSpendingSessions.length})
                                </h2>

                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Shopkeeper Dropdown */}
                                    <select
                                        value={spendingNameFilter}
                                        onChange={(e) => {
                                            setSpendingNameFilter(e.target.value);
                                            setShowAllSpendings(false);
                                        }}
                                        className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none"
                                    >
                                        <option value="">All Shopkeepers</option>
                                        {spendingShopkeepers.map(sk => (
                                            <option key={sk} value={sk}>{sk}</option>
                                        ))}
                                    </select>

                                    {/* Date Filter */}
                                    <input
                                        type="date"
                                        value={spendingDateFilter}
                                        onChange={(e) => {
                                            setSpendingDateFilter(e.target.value);
                                            setShowAllSpendings(false);
                                        }}
                                        className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none"
                                    />

                                    {/* Clear Button */}
                                    {(spendingNameFilter || spendingDateFilter) && (
                                        <button
                                            onClick={() => {
                                                setSpendingNameFilter('');
                                                setSpendingDateFilter('');
                                            }}
                                            className="px-2 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-xs transition-all"
                                        >
                                            Clear
                                        </button>
                                    )}

                                    <span className="text-orange-400 font-bold text-sm">
                                        Total: Rs {totalSpending.toFixed(0)}
                                    </span>
                                </div>
                            </div>

                            {/* Session Spending Cards - Grid */}
                            {filteredSpendingSessions.length === 0 ? (
                                <p className="text-center text-gray-500 py-6">No sessions with spendings found</p>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {displayedSessions.map((session) => (
                                            <div
                                                key={session._id}
                                                className="bg-gray-900 rounded-xl p-4 border border-gray-700 hover:border-orange-600/50 transition-colors"
                                            >
                                                {/* Session Header */}
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-9 h-9 rounded-full bg-orange-600/20 flex items-center justify-center text-orange-400 font-bold">
                                                            {session.shopkeeperUsername?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-white font-semibold">{session.shopkeeperUsername}</p>
                                                            <p className="text-xs text-gray-400">
                                                                {new Date(session.endTime).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric'
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-orange-400 font-bold text-lg">Rs {session.totalSpending?.toFixed(0)}</p>
                                                        <p className="text-xs text-gray-500">{session.spendings.length} items</p>
                                                    </div>
                                                </div>

                                                {/* Session Time */}
                                                <div className="text-xs text-gray-500 mb-3">
                                                    ⏱️ {new Date(session.startTime).toLocaleTimeString('en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })} - {new Date(session.endTime).toLocaleTimeString('en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>

                                                {/* Spending Items List */}
                                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                                    {session.spendings.map((spending, idx) => (
                                                        <div key={idx} className="flex justify-between items-center px-2 py-1.5 bg-gray-800 rounded text-sm">
                                                            <span className="text-gray-300">{spending.reason}</span>
                                                            <span className="text-orange-400 font-medium">Rs {spending.amount?.toFixed(0)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* See All Button */}
                                    {filteredSpendingSessions.length > SPENDING_LIMIT && (
                                        <button
                                            onClick={() => setShowAllSpendings(!showAllSpendings)}
                                            className="w-full mt-4 py-2 text-center bg-orange-600/10 hover:bg-orange-600/30 text-orange-400 rounded-lg transition-all text-sm font-medium"
                                        >
                                            {showAllSpendings ? '← Show Less' : `See All ${filteredSpendingSessions.length} Sessions →`}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default SessionReports;

