import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';

const AllReconciliationList = () => {
    const { shopId } = useParams();
    const [reports, setReports] = useState([]);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [depositInputs, setDepositInputs] = useState({});
    const [depositingId, setDepositingId] = useState(null);

    useEffect(() => {
        fetchReports();
    }, [shopId]);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/admin/shops/${shopId}/session-reports?limit=100`);
            if (response.data.success) {
                setReports(response.data.reports);
                setShop(response.data.shop);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching session reports:', error);
            setLoading(false);
        }
    };

    const handleDepositInputChange = (reportId, value) => {
        setDepositInputs(prev => ({
            ...prev,
            [reportId]: value
        }));
    };

    const handleDeposit = async (session) => {
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
                setDepositInputs(prev => ({
                    ...prev,
                    [session._id]: ''
                }));
            }
        } catch (error) {
            alert('Failed to record deposit');
        } finally {
            setDepositingId(null);
        }
    };

    const handleDelete = async (reportId) => {
        if (!confirm('Are you sure you want to delete this session?')) return;

        try {
            await api.delete(`/admin/shops/${shopId}/session-reports/${reportId}`);
            setReports(reports.filter(r => r._id !== reportId));
        } catch (error) {
            alert('Failed to delete report');
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

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    // Calculate totals
    const totalSales = reports.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    const totalDeposited = reports.reduce((sum, r) => sum + (r.cashSubmitted || 0), 0);
    const totalRemaining = totalSales - totalDeposited;

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4">
                <div className="max-w-7xl mx-auto">
                    <Link
                        to={`/admin/shop/${shopId}/session-reports`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg mb-4 transition-all font-medium"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Session Reports
                    </Link>
                    <h1 className="text-2xl font-bold text-white">
                        💰 All Reconciliation - {shop?.name || 'Shop'}
                    </h1>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="card text-center">
                        <p className="text-sm text-gray-400">Total Sales</p>
                        <p className="text-2xl font-bold text-green-400">Rs {totalSales.toFixed(0)}</p>
                    </div>
                    <div className="card text-center">
                        <p className="text-sm text-gray-400">Total Deposited</p>
                        <p className="text-2xl font-bold text-blue-400">Rs {totalDeposited.toFixed(0)}</p>
                    </div>
                    <div className="card text-center">
                        <p className="text-sm text-gray-400">Total Remaining</p>
                        <p className={`text-2xl font-bold ${totalRemaining > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            Rs {totalRemaining.toFixed(0)}
                        </p>
                    </div>
                </div>

                {/* Reconciliation List */}
                <div className="card">
                    {reports.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <p>No sessions to reconcile</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {reports.map((session) => {
                                const remaining = session.totalAmount - (session.cashSubmitted || 0);
                                const isFullyPaid = remaining <= 0;

                                return (
                                    <div
                                        key={session._id}
                                        className={`p-4 rounded-lg border ${isFullyPaid ? 'bg-green-900/20 border-green-700' : 'bg-gray-700/50 border-gray-600'}`}
                                    >
                                        {/* Header */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold">
                                                    {session.shopkeeperUsername?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <span className="text-white font-medium">{session.shopkeeperUsername}</span>
                                                    <p className="text-sm text-gray-500">{formatDate(session.endTime)}</p>
                                                </div>
                                            </div>
                                            {isFullyPaid && (
                                                <span className="px-3 py-1 bg-green-600 text-white text-sm rounded">✓ Fully Paid</span>
                                            )}
                                        </div>

                                        {/* Amounts */}
                                        <div className="grid grid-cols-3 gap-3 text-center mb-3">
                                            <div className="bg-gray-800 p-3 rounded">
                                                <p className="text-xs text-gray-400">Sales</p>
                                                <p className="text-green-400 font-bold">Rs {session.totalAmount?.toFixed(0) || '0'}</p>
                                            </div>
                                            <div className="bg-gray-800 p-3 rounded">
                                                <p className="text-xs text-gray-400">Deposited</p>
                                                <p className="text-blue-400 font-bold">Rs {(session.cashSubmitted || 0).toFixed(0)}</p>
                                            </div>
                                            <div className="bg-gray-800 p-3 rounded">
                                                <p className="text-xs text-gray-400">Remaining</p>
                                                <p className={`font-bold ${remaining > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                    Rs {remaining.toFixed(0)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            {!isFullyPaid && (
                                                <>
                                                    <input
                                                        type="number"
                                                        placeholder="Deposit amount"
                                                        value={depositInputs[session._id] || ''}
                                                        onChange={(e) => handleDepositInputChange(session._id, e.target.value)}
                                                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
                                                        min="0"
                                                        max={remaining}
                                                    />
                                                    <button
                                                        onClick={() => handleDeposit(session)}
                                                        disabled={depositingId === session._id || !depositInputs[session._id]}
                                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded transition-colors"
                                                    >
                                                        {depositingId === session._id ? '...' : 'Deposit'}
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => handleDelete(session._id)}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AllReconciliationList;
