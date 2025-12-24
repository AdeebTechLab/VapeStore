import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import ProductManagement from './pages/admin/ProductManagement';
import ShopkeeperManagement from './pages/admin/ShopkeeperManagement';
import Reports from './pages/admin/Reports';
import SessionReports from './pages/admin/SessionReports';
import AllSessionsList from './pages/admin/AllSessionsList';
import AllReconciliationList from './pages/admin/AllReconciliationList';
import Analytics from './pages/admin/Analytics';
import ManageShops from './pages/admin/ManageShops';
import ShopHome from './pages/shop/Home';
import './index.css';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

function AppRoutes() {
    const { user, loading } = useAuth();

    // Wait for auth to load before rendering routes
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <Routes>
            <Route
                path="/login"
                element={
                    user ? (
                        <Navigate to={user.role === 'admin' ? '/admin' : '/shop'} replace />
                    ) : (
                        <Login />
                    )
                }
            />

            {/* Admin Routes */}
            <Route
                path="/admin"
                element={
                    <ProtectedRoute requiredRole="admin">
                        <AdminDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/shop/:shopId/products"
                element={
                    <ProtectedRoute requiredRole="admin">
                        <ProductManagement />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/shop/:shopId/shopkeepers"
                element={
                    <ProtectedRoute requiredRole="admin">
                        <ShopkeeperManagement />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/reports"
                element={
                    <ProtectedRoute requiredRole="admin">
                        <Reports />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/shop/:shopId/session-reports"
                element={
                    <ProtectedRoute requiredRole="admin">
                        <SessionReports />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/shop/:shopId/all-sessions"
                element={
                    <ProtectedRoute requiredRole="admin">
                        <AllSessionsList />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/shop/:shopId/all-reconciliation"
                element={
                    <ProtectedRoute requiredRole="admin">
                        <AllReconciliationList />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/analytics"
                element={
                    <ProtectedRoute requiredRole="admin">
                        <Analytics />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/manage-shops"
                element={
                    <ProtectedRoute requiredRole="admin">
                        <ManageShops />
                    </ProtectedRoute>
                }
            />

            {/* Shopkeeper Routes */}
            <Route
                path="/shop"
                element={
                    <ProtectedRoute requiredRole="shopkeeper">
                        <ShopHome />
                    </ProtectedRoute>
                }
            />

            {/* Default redirect */}
            <Route
                path="/"
                element={<Navigate to="/login" replace />}
            />

            {/* Catch all - redirect to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <AppRoutes />
            </Router>
        </AuthProvider>
    );
}

export default App;
