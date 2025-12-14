import { createContext, useState, useContext, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load user from localStorage on mount - only once
        const savedUser = authService.getCurrentUser();
        if (savedUser) {
            setUser(savedUser);
        }
        setLoading(false);
    }, []); // Empty dependency array - run only once on mount

    const login = async (credentials, role) => {
        try {
            let data;
            if (role === 'admin') {
                data = await authService.adminLogin(credentials.username, credentials.password);
            } else {
                data = await authService.shopkeeperLogin(
                    credentials.shopId,
                    credentials.username,
                    credentials.password
                );
            }

            if (data.success) {
                setUser(data.user);
                return { success: true, user: data.user, session: data.session };
            }

            return { success: false, message: data.message };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed',
            };
        }
    };

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    const value = {
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
