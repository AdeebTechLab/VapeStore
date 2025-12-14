import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const ManageShops = () => {
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        location: '',
    });
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, shop: null });

    useEffect(() => {
        fetchShops();
    }, []);

    const fetchShops = async () => {
        try {
            const response = await api.get('/admin/shops');
            if (response.data.success) {
                setShops(response.data.shops);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching shops:', error);
            setLoading(false);
        }
    };

    const handleCreateShop = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/admin/shops', formData);
            if (response.data.success) {
                setShops([...shops, response.data.shop]);
                setFormData({ name: '', location: '' });
                setShowAddForm(false);
                alert('Shop created successfully!');
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to create shop');
        }
    };

    const handleDeleteShop = async () => {
        if (!deleteConfirm.shop) return;

        try {
            const response = await api.delete(`/admin/shops/${deleteConfirm.shop._id}`);
            if (response.data.success) {
                setShops(shops.filter(s => s._id !== deleteConfirm.shop._id));
                setDeleteConfirm({ show: false, shop: null });
                alert('Shop and all its data deleted successfully!');
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to delete shop');
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
                        <h1 className="text-2xl font-bold text-white">🏪 Manage Shops</h1>
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add New Shop
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                {/* Add Shop Form */}
                {showAddForm && (
                    <div className="card mb-6">
                        <h2 className="text-xl font-bold text-white mb-4">Create New Shop</h2>
                        <form onSubmit={handleCreateShop} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Shop Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="input"
                                        placeholder="e.g., Main Branch"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className="input"
                                        placeholder="e.g., Downtown Mall"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" className="btn-primary">
                                    Create Shop
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Shops List */}
                <div className="card">
                    <h2 className="text-xl font-bold text-white mb-4">All Shops ({shops.length})</h2>
                    {shops.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">No shops found. Create your first shop!</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-gray-300">Shop Name</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Location</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Database</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Products</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Today's Sales</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {shops.map((shop) => (
                                        <tr key={shop._id} className="hover:bg-gray-700/50">
                                            <td className="px-4 py-3 text-white font-medium">{shop.name}</td>
                                            <td className="px-4 py-3 text-gray-400">{shop.location || 'N/A'}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs font-mono text-blue-400 bg-blue-900/30 px-2 py-1 rounded">
                                                    {shop.dbName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="badge badge-info">{shop.stats?.productCount || 0}</span>
                                            </td>
                                            <td className="px-4 py-3 text-green-400 font-semibold">
                                                Rs {(shop.stats?.todaysSales || 0).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <Link
                                                        to={`/admin/shop/${shop._id}/products`}
                                                        className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                                                    >
                                                        Products
                                                    </Link>
                                                    <button
                                                        onClick={() => setDeleteConfirm({ show: true, shop })}
                                                        className="btn-danger text-sm px-3 py-1"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {
                deleteConfirm.show && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-red-500/50">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">⚠️ Warning: Delete Shop</h3>
                                <p className="text-gray-400 mb-4">
                                    Are you sure you want to delete <span className="text-white font-semibold">"{deleteConfirm.shop?.name}"</span>?
                                </p>
                                <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3 mb-6 text-left">
                                    <p className="text-red-400 text-sm font-medium mb-2">This will permanently delete:</p>
                                    <ul className="text-red-300 text-sm list-disc list-inside space-y-1">
                                        <li>All products ({deleteConfirm.shop?.stats?.productCount || 0} items)</li>
                                        <li>All shopkeeper accounts</li>
                                        <li>All sales records & transactions</li>
                                        <li>All session reports</li>
                                        <li>The shop's database</li>
                                    </ul>
                                </div>
                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => setDeleteConfirm({ show: false, shop: null })}
                                        className="btn-secondary px-6"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDeleteShop}
                                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-all"
                                    >
                                        Yes, Delete Shop
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ManageShops;
