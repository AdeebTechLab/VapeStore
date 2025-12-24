import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';

const AllSessionsList = () => {
    const { shopId } = useParams();
    const [reports, setReports] = useState([]);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });

    useEffect(() => {
        fetchReports();
    }, [shopId, pagination.page]);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/admin/shops/${shopId}/session-reports?page=${pagination.page}&limit=20`);
            if (response.data.success) {
                setReports(response.data.reports);
                setShop(response.data.shop);
                setPagination(prev => ({
                    ...prev,
                    totalPages: response.data.pagination.totalPages,
                    totalCount: response.data.pagination.totalCount,
                }));
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

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
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
                        to={`/admin/shop/${shopId}/session-reports`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg mb-4 transition-all font-medium"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Session Reports
                    </Link>
                    <h1 className="text-2xl font-bold text-white">
                        All Session Reports - {shop?.name || 'Shop'}
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        {pagination.totalCount} total sessions
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Reports List */}
                    <div className="lg:col-span-2">
                        <div className="card">
                            {reports.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-gray-400">No session reports found</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        {reports.map((report) => (
                                            <div
                                                key={report._id}
                                                className={`p-4 rounded-lg border transition-all cursor-pointer ${selectedReport?._id === report._id
                                                    ? 'bg-primary/20 border-primary'
                                                    : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                                                    }`}
                                                onClick={() => handleViewDetails(report._id)}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-semibold text-white">{report.shopkeeperUsername}</h3>
                                                        <p className="text-sm text-gray-400">{formatDate(report.startTime)}</p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Duration: {formatDuration(report.startTime, report.endTime)}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-bold text-green-400">Rs {report.totalAmount?.toFixed(2) || '0.00'}</p>
                                                        <p className="text-sm text-gray-400">{report.totalItemsSold || 0} items</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Pagination */}
                                    {pagination.totalPages > 1 && (
                                        <div className="flex justify-center gap-2 mt-6">
                                            <button
                                                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                                disabled={pagination.page === 1}
                                                className="px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
                                            >
                                                Previous
                                            </button>
                                            <span className="px-4 py-2 text-gray-400">
                                                Page {pagination.page} of {pagination.totalPages}
                                            </span>
                                            <button
                                                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                                disabled={pagination.page === pagination.totalPages}
                                                className="px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Report Details */}
                    <div className="lg:col-span-1">
                        <div className="card sticky top-4">
                            <h2 className="text-xl font-bold text-white mb-4">Report Details</h2>

                            {selectedReport ? (
                                <div>
                                    <div className="bg-gray-700 rounded-lg p-4 mb-4">
                                        <p className="text-lg font-semibold text-white">{selectedReport.shopkeeperUsername}</p>
                                        <p className="text-sm text-gray-400 mt-1">Started: {formatDate(selectedReport.startTime)}</p>
                                        <p className="text-sm text-gray-400">Ended: {formatDate(selectedReport.endTime)}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-green-900/30 p-3 rounded-lg text-center">
                                            <p className="text-2xl font-bold text-green-400">Rs {selectedReport.totalAmount?.toFixed(2)}</p>
                                            <p className="text-xs text-gray-400">Total Sales</p>
                                        </div>
                                        <div className="bg-blue-900/30 p-3 rounded-lg text-center">
                                            <p className="text-2xl font-bold text-blue-400">{selectedReport.totalItemsSold}</p>
                                            <p className="text-xs text-gray-400">Items Sold</p>
                                        </div>
                                    </div>

                                    <h3 className="font-semibold text-white mb-2">Sold Items</h3>
                                    <div className="max-h-64 overflow-y-auto space-y-2">
                                        {selectedReport.soldItems?.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-2 bg-gray-700 rounded text-sm">
                                                <div>
                                                    <p className="text-white">{item.productName}</p>
                                                    <p className="text-xs text-gray-400">{item.qty}x @ Rs {item.pricePerUnit?.toFixed(2)}</p>
                                                </div>
                                                <p className="text-green-400 font-medium">Rs {item.totalPrice?.toFixed(2)}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => handleDelete(selectedReport._id)}
                                        className="w-full mt-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                                    >
                                        Delete Report
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <p>Select a report to view details</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AllSessionsList;
