import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';

const SessionReports = () => {
    const { shopId } = useParams();
    const [reports, setReports] = useState([]);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });

    useEffect(() => {
        fetchReports();
    }, [shopId, pagination.page]);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/admin/shops/${shopId}/session-reports?page=${pagination.page}&limit=10`);
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
            alert('Report deleted successfully');
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
                        to="/admin"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg mb-4 transition-all font-medium"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold text-white">
                        Session Reports - {shop?.name || 'Shop'}
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        View all shopkeeper work sessions and sales reports
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Reports List */}
                    <div className="lg:col-span-2">
                        <div className="card">
                            <h2 className="text-xl font-bold text-white mb-4">
                                All Session Reports ({pagination.totalCount || 0})
                            </h2>

                            {reports.length === 0 ? (
                                <div className="text-center py-8">
                                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-gray-400">No session reports yet</p>
                                    <p className="text-gray-500 text-sm mt-1">Reports are generated when shopkeepers logout</p>
                                </div>
                            ) : (
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
                                                    <h3 className="font-semibold text-white">
                                                        {report.shopkeeperUsername}
                                                    </h3>
                                                    <p className="text-sm text-gray-400">
                                                        {formatDate(report.startTime)}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Duration: {formatDuration(report.startTime, report.endTime)}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-bold text-green-400">
                                                        Rs {report.totalAmount?.toFixed(2) || '0.00'}
                                                    </p>
                                                    <p className="text-sm text-gray-400">
                                                        {report.totalItemsSold || 0} items
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Pagination */}
                            {pagination.totalPages > 1 && (
                                <div className="flex justify-center gap-2 mt-4">
                                    <button
                                        onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                        disabled={pagination.page === 1}
                                        className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-3 py-1 text-gray-400">
                                        Page {pagination.page} of {pagination.totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                        disabled={pagination.page === pagination.totalPages}
                                        className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Report Details */}
                    <div className="lg:col-span-1">
                        <div className="card sticky top-4">
                            <h2 className="text-xl font-bold text-white mb-4">Report Details</h2>

                            {selectedReport ? (
                                <div>
                                    {/* Header Info */}
                                    <div className="bg-gray-700 rounded-lg p-4 mb-4">
                                        <p className="text-lg font-semibold text-white">
                                            {selectedReport.shopkeeperUsername}
                                        </p>
                                        <p className="text-sm text-gray-400 mt-1">
                                            Started: {formatDate(selectedReport.startTime)}
                                        </p>
                                        <p className="text-sm text-gray-400">
                                            Ended: {formatDate(selectedReport.endTime)}
                                        </p>
                                        <p className="text-sm text-primary mt-1">
                                            Duration: {selectedReport.duration || formatDuration(selectedReport.startTime, selectedReport.endTime)}
                                        </p>
                                    </div>

                                    {/* Summary */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-green-900/30 p-3 rounded-lg text-center">
                                            <p className="text-2xl font-bold text-green-400">
                                                Rs {selectedReport.totalAmount?.toFixed(2)}
                                            </p>
                                            <p className="text-xs text-gray-400">Total Sales</p>
                                        </div>
                                        <div className="bg-blue-900/30 p-3 rounded-lg text-center">
                                            <p className="text-2xl font-bold text-blue-400">
                                                {selectedReport.totalItemsSold}
                                            </p>
                                            <p className="text-xs text-gray-400">Items Sold</p>
                                        </div>
                                    </div>

                                    {/* Sold Items */}
                                    <h3 className="font-semibold text-white mb-2">Sold Items</h3>
                                    <div className="max-h-64 overflow-y-auto space-y-2">
                                        {selectedReport.soldItems?.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-2 bg-gray-700 rounded text-sm">
                                                <div>
                                                    <p className="text-white">{item.productName}</p>
                                                    <p className="text-xs text-gray-400">
                                                        {item.qty}x @ Rs {item.pricePerUnit?.toFixed(2)}
                                                    </p>
                                                </div>
                                                <p className="text-green-400 font-medium">
                                                    Rs {item.totalPrice?.toFixed(2)}
                                                </p>
                                            </div>
                                        ))}
                                        {(!selectedReport.soldItems || selectedReport.soldItems.length === 0) && (
                                            <p className="text-gray-500 text-sm text-center py-2">No items sold</p>
                                        )}
                                    </div>

                                    {/* Print & Delete Buttons */}
                                    <div className="flex gap-2 mt-4">
                                        <button
                                            onClick={() => {
                                                // Create print content for thermal printer
                                                const printWindow = window.open('', '_blank', 'width=300,height=600');
                                                printWindow.document.write(`
                                                    <html>
                                                    <head>
                                                        <title>Session Report</title>
                                                        <style>
                                                            body {
                                                                font-family: 'Courier New', monospace;
                                                                font-size: 12px;
                                                                width: 280px;
                                                                margin: 0 auto;
                                                                padding: 10px;
                                                            }
                                                            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; }
                                                            .title { font-size: 14px; font-weight: bold; }
                                                            .row { display: flex; justify-content: space-between; margin: 4px 0; }
                                                            .divider { border-top: 1px dashed #000; margin: 10px 0; }
                                                            .item { margin: 5px 0; padding: 3px 0; border-bottom: 1px dotted #ccc; }
                                                            .total { font-weight: bold; font-size: 14px; }
                                                            .footer { text-align: center; margin-top: 15px; font-size: 10px; }
                                                        </style>
                                                    </head>
                                                    <body>
                                                        <div class="header">
                                                            <div class="title">SESSION REPORT</div>
                                                            <div>${shop?.name || 'Shop'}</div>
                                                        </div>
                                                        <div class="divider"></div>
                                                        <div class="row"><span>Shopkeeper:</span><span>${selectedReport.shopkeeperUsername}</span></div>
                                                        <div class="row"><span>Start:</span><span>${formatDate(selectedReport.startTime)}</span></div>
                                                        <div class="row"><span>End:</span><span>${formatDate(selectedReport.endTime)}</span></div>
                                                        <div class="row"><span>Duration:</span><span>${selectedReport.duration || formatDuration(selectedReport.startTime, selectedReport.endTime)}</span></div>
                                                        <div class="divider"></div>
                                                        <div><strong>ITEMS SOLD:</strong></div>
                                                        ${selectedReport.soldItems?.map(item => `
                                                            <div class="item">
                                                                <div>${item.productName}</div>
                                                                <div class="row"><span>${item.qty}x @ $${item.pricePerUnit?.toFixed(2)}</span><span>$${item.totalPrice?.toFixed(2)}</span></div>
                                                            </div>
                                                        `).join('') || '<div>No items</div>'}
                                                        <div class="divider"></div>
                                                        <div class="row total"><span>TOTAL ITEMS:</span><span>${selectedReport.totalItemsSold}</span></div>
                                                        <div class="row total"><span>TOTAL SALES:</span><span>$${selectedReport.totalAmount?.toFixed(2)}</span></div>
                                                        <div class="footer">
                                                            <div>--- End of Report ---</div>
                                                            <div>Printed: ${new Date().toLocaleString()}</div>
                                                        </div>
                                                    </body>
                                                    </html>
                                                `);
                                                printWindow.document.close();
                                                printWindow.focus();
                                                setTimeout(() => {
                                                    printWindow.print();
                                                    printWindow.close();
                                                }, 250);
                                            }}
                                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                            </svg>
                                            Print
                                        </button>
                                        <button
                                            onClick={() => handleDelete(selectedReport._id)}
                                            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
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

export default SessionReports;
