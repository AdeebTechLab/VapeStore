import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';

const ShopkeeperManagement = () => {
    const { shopId } = useParams();
    const [shopkeepers, setShopkeepers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newShopkeeper, setNewShopkeeper] = useState({ username: '', password: '' });
    const [copiedId, setCopiedId] = useState(null);
    const [createdShopkeeper, setCreatedShopkeeper] = useState(null); // For showing password modal
    const [passwordCopied, setPasswordCopied] = useState(false);

    useEffect(() => {
        fetchShopkeepers();
    }, [shopId]);

    const fetchShopkeepers = async () => {
        try {
            const response = await api.get(`/admin/shops/${shopId}/shopkeepers`);
            if (response.data.success) {
                setShopkeepers(response.data.shopkeepers);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching shopkeepers:', error);
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post(`/admin/shops/${shopId}/shopkeepers`, newShopkeeper);
            if (response.data.success) {
                // Show created password modal
                setCreatedShopkeeper({
                    username: response.data.shopkeeper?.username || newShopkeeper.username,
                    password: newShopkeeper.password // Use the password we submitted
                });
                setPasswordCopied(false);
                // Refresh list
                fetchShopkeepers();
                setNewShopkeeper({ username: '', password: '' });
                setShowAddForm(false);
            }
        } catch (error) {
            const data = error.response?.data;
            let errorMessage = data?.message || 'Failed to create shopkeeper';

            if (data?.errors && Array.isArray(data.errors)) {
                errorMessage += ':\n' + data.errors.join('\n');
            }

            alert(errorMessage);
        }
    };

    const handleDelete = async (shopkeeperId) => {
        if (!confirm('Are you sure you want to delete this shopkeeper?')) return;

        try {
            await api.delete(`/admin/shops/${shopId}/shopkeepers/${shopkeeperId}`);
            setShopkeepers(shopkeepers.filter(s => s._id !== shopkeeperId));
            alert('Shopkeeper deleted successfully!');
        } catch (error) {
            alert('Failed to delete shopkeeper');
        }
    };

    // Copy to clipboard function that works on non-HTTPS
    const copyToClipboard = (text, callback) => {
        // Try modern API first
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(() => callback())
                .catch(() => fallbackCopy(text, callback));
        } else {
            fallbackCopy(text, callback);
        }
    };

    const fallbackCopy = (text, callback) => {
        // Create a temporary textarea
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            callback();
        } catch (err) {
            console.error('Fallback copy failed', err);
            alert('Copy failed. Please select and copy manually: ' + text);
        }

        document.body.removeChild(textArea);
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
                        <h1 className="text-2xl font-bold text-white">Shopkeeper Management</h1>
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="btn-primary"
                    >
                        {showAddForm ? 'Cancel' : '+ Add Shopkeeper'}
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                {/* Add Shopkeeper Form */}
                {showAddForm && (
                    <div className="card mb-6">
                        <h2 className="text-xl font-bold text-white mb-4">Add New Shopkeeper</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Username *</label>
                                <input
                                    type="text"
                                    value={newShopkeeper.username}
                                    onChange={(e) => setNewShopkeeper({ ...newShopkeeper, username: e.target.value })}
                                    className="input max-w-md"
                                    placeholder="e.g., shopkeeper1"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Password *</label>
                                <input
                                    type="text"
                                    value={newShopkeeper.password}
                                    onChange={(e) => setNewShopkeeper({ ...newShopkeeper, password: e.target.value })}
                                    className="input max-w-md"
                                    placeholder="Enter password for shopkeeper"
                                    required
                                    minLength={6}
                                />
                                <p className="text-sm text-gray-400 mt-1">Minimum 6 characters. Shopkeeper will use this to login.</p>
                            </div>
                            <button type="submit" className="btn-primary">Create Shopkeeper</button>
                        </form>
                    </div>
                )}

                {/* Shopkeepers List */}
                <div className="card">
                    <h2 className="text-xl font-bold text-white mb-4">Shopkeepers ({shopkeepers.length})</h2>

                    {shopkeepers.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">No shopkeepers found. Add your first shopkeeper!</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-gray-300">Username</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Password</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Status</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Created</th>
                                        <th className="px-4 py-3 text-left text-gray-300">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {shopkeepers.map((shopkeeper) => (
                                        <tr key={shopkeeper._id} className="hover:bg-gray-700/50">
                                            <td className="px-4 py-3 text-white font-medium">{shopkeeper.username}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {shopkeeper.plainPassword ? (
                                                        <>
                                                            <span className="font-mono text-green-400 bg-gray-800 px-2 py-1 rounded">
                                                                {shopkeeper.plainPassword}
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    if (shopkeeper.plainPassword) {
                                                                        copyToClipboard(shopkeeper.plainPassword, () => {
                                                                            setCopiedId(shopkeeper._id);
                                                                            setTimeout(() => setCopiedId(null), 2000);
                                                                        });
                                                                    }
                                                                }}
                                                                className={`px-2 py-1 rounded transition-all text-xs font-medium flex items-center gap-1 ${copiedId === shopkeeper._id
                                                                    ? 'bg-green-600 text-white'
                                                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                                                    }`}
                                                                title="Copy password"
                                                            >
                                                                {copiedId === shopkeeper._id ? (
                                                                    <>
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                        Copied!
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                                        </svg>
                                                                        Copy
                                                                    </>
                                                                )}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-500 text-sm italic">Password not stored</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`badge ${shopkeeper.isActive ? 'badge-success' : 'badge-danger'}`}>
                                                    {shopkeeper.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-300">
                                                {new Date(shopkeeper.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleDelete(shopkeeper._id)}
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
            </div>

            {/* Password Created Modal */}
            {createdShopkeeper && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-700">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Shopkeeper Created!</h3>
                            <p className="text-gray-400 text-sm">Save these credentials - password cannot be viewed again</p>
                        </div>

                        <div className="bg-gray-900 rounded-lg p-4 mb-4">
                            <div className="mb-3">
                                <label className="text-xs text-gray-500 uppercase tracking-wide">Username</label>
                                <p className="text-lg font-mono text-white">{createdShopkeeper.username}</p>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wide">Password</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-lg font-mono text-green-400 flex-1 select-all">{createdShopkeeper.password}</p>
                                    <button
                                        onClick={() => {
                                            copyToClipboard(createdShopkeeper.password, () => {
                                                setPasswordCopied(true);
                                            });
                                        }}
                                        className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${passwordCopied
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-700 hover:bg-gray-600 text-white'
                                            }`}
                                    >
                                        {passwordCopied ? (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                </svg>
                                                Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setCreatedShopkeeper(null)}
                            className="w-full py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-semibold transition-all"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShopkeeperManagement;
