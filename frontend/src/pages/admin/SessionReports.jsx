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
        const unsubSale = onSaleCompleted(() => { });

        return () => {
            unsubSession?.();
            unsubSale?.();
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
                                <p className="text-sm mt-1">Reports will appear here when shopkeepers log out</p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {displayedReports.map((session) => {
                                        const remaining = session.totalAmount - (session.cashSubmitted || 0);
                                        const isFullyPaid = remaining <= 0;

                                        return (
                                            <div
                                                key={session._id}
                                                className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-lg ${selectedReport?._id === session._id
                                                    ? 'bg-primary/10 border-primary shadow-primary/20'
                                                    : isFullyPaid
                                                        ? 'bg-green-900/20 border-green-600/50 hover:border-green-500'
                                                        : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                                                    }`}
                                                onClick={() => handleViewDetails(session._id)}
                                            >
                                                {/* Header Row */}
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${isFullyPaid ? 'bg-green-600 text-white' : 'bg-primary/20 text-primary'
                                                            }`}>
                                                            {session.shopkeeperUsername?.charAt(0).toUpperCase() || '?'}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-white">{session.shopkeeperUsername}</p>
                                                            <p className="text-xs text-gray-400">{formatDate(session.endTime)}</p>
                                                        </div>
                                                    </div>
                                                    {isFullyPaid ? (
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

                    {/* Right Column - Report Details */}
                    <div className="lg:col-span-1">
                        <div className="card sticky top-4">
                            <h2 className="text-xl font-bold text-white mb-4">📋 Session Details</h2>

                            {selectedReport ? (
                                <div>
                                    <div className="bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg p-4 mb-4">
                                        <p className="font-bold text-xl text-white">{selectedReport.shopkeeperUsername}</p>
                                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                                            <div>
                                                <p className="text-gray-400">Started</p>
                                                <p className="text-white">{formatDate(selectedReport.startTime)}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400">Ended</p>
                                                <p className="text-white">{formatDate(selectedReport.endTime)}</p>
                                            </div>
                                        </div>
                                        <p className="text-primary font-medium mt-2">
                                            ⏱️ Duration: {formatDuration(selectedReport.startTime, selectedReport.endTime)}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-green-900/30 p-4 rounded-xl text-center">
                                            <p className="text-2xl font-bold text-green-400">Rs {selectedReport.totalAmount?.toFixed(0)}</p>
                                            <p className="text-xs text-gray-400 mt-1">Total Sales</p>
                                        </div>
                                        <div className="bg-blue-900/30 p-4 rounded-xl text-center">
                                            <p className="text-2xl font-bold text-blue-400">{selectedReport.totalItemsSold}</p>
                                            <p className="text-xs text-gray-400 mt-1">Items Sold</p>
                                        </div>
                                    </div>

                                    <h3 className="font-semibold text-white mb-2">🛒 Sold Items</h3>
                                    <div className="max-h-64 overflow-y-auto space-y-2">
                                        {selectedReport.soldItems?.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="p-3 bg-gray-700/50 rounded-lg text-sm cursor-pointer hover:bg-gray-700 transition-all"
                                                onClick={() => setSelectedItem(selectedItem === item ? null : item)}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="flex-1">
                                                        <p className="text-white font-medium">{item.productName}</p>
                                                        <p className="text-gray-400 text-xs">{item.qty}x @ Rs {item.pricePerUnit?.toFixed(0)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-green-400 font-bold">Rs {item.totalPrice?.toFixed(0)}</p>
                                                        {item.paymentMethod && (
                                                            <span className={`text-xs px-2 py-0.5 rounded-full ${item.paymentMethod === 'Cash' ? 'bg-green-900/50 text-green-300' : item.paymentMethod === 'EasyPaisa' ? 'bg-purple-900/50 text-purple-300' : item.paymentMethod === 'JazzCash' ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'}`}>
                                                                {item.paymentMethod}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Show customer details when clicked */}
                                                {selectedItem === item && item.customerName && (
                                                    <div className="mt-2 pt-2 border-t border-gray-600 text-xs space-y-1">
                                                        <div className="flex items-center gap-2 text-gray-300">
                                                            <span>👤</span>
                                                            <span>{item.customerName}</span>
                                                        </div>
                                                        {item.customerPhone && (
                                                            <div className="flex items-center gap-2 text-gray-400">
                                                                <span>📱</span>
                                                                <span>{item.customerPhone}</span>
                                                            </div>
                                                        )}
                                                        {item.customerEmail && (
                                                            <div className="flex items-center gap-2 text-gray-400">
                                                                <span>📧</span>
                                                                <span>{item.customerEmail}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {selectedItem === item && !item.customerName && (
                                                    <p className="mt-2 pt-2 border-t border-gray-600 text-xs text-gray-500">No customer info recorded</p>
                                                )}
                                            </div>
                                        ))}
                                        {(!selectedReport.soldItems || selectedReport.soldItems.length === 0) && (
                                            <p className="text-gray-500 text-sm text-center py-4">No items sold in this session</p>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleDelete(selectedReport._id)}
                                        className="w-full mt-4 py-3 bg-red-600/20 hover:bg-red-600 border border-red-600 text-red-400 hover:text-white rounded-xl font-medium text-sm transition-all"
                                    >
                                        🗑️ Delete Report
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                    </svg>
                                    <p>Click a session card</p>
                                    <p className="text-sm mt-1">to view sold items</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

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
