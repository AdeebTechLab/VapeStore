import { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

// Simplified Admin Dashboard with core features
const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [shops, setShops] = useState([]);
    const [analytics, setAnalytics] = useState({ data: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [shopsRes, analyticsRes] = await Promise.all([
                api.get('/admin/shops'),
                api.get('/admin/analytics?period=daily')
            ]);

            if (shopsRes.data.success) {
                setShops(shopsRes.data.shops);
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
                {/* Page Header */}
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">Dashboard</h2>
                    <p className="text-gray-400">Manage your vape shop inventory and sales</p>
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
                        {shops.map((shop) => (
                            <div
                                key={shop._id}
                                className="p-4 bg-gray-700 rounded-lg border border-gray-600 hover:border-primary transition-all"
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
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
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
        </div>
    );
};

export default Dashboard;
