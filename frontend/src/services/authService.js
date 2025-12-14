import api from './api';

export const authService = {
    // Admin login
    adminLogin: async (username, password) => {
        const response = await api.post('/auth/admin/login', { username, password });
        if (response.data.success) {
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data;
    },

    // Shopkeeper login
    shopkeeperLogin: async (shopId, username, password) => {
        const response = await api.post('/auth/shopkeeper/login', { shopId, username, password });
        if (response.data.success) {
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            localStorage.setItem('session', JSON.stringify(response.data.session));
        }
        return response.data;
    },

    // Get shops (public - for login page)
    getShops: async () => {
        const response = await api.get('/auth/shops');
        return response.data;
    },

    // Logout
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('session');
    },

    // Get current user
    getCurrentUser: () => {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },

    // Check if authenticated
    isAuthenticated: () => {
        return !!localStorage.getItem('token');
    },
};
