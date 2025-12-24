const { Server } = require('socket.io');

let io = null;

/**
 * Initialize Socket.io with HTTP server
 */
const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PUT", "DELETE"]
        }
    });

    io.on('connection', (socket) => {
        console.log('🔌 Client connected:', socket.id);

        // Join shop room for targeted updates
        socket.on('join:shop', (shopDbName) => {
            socket.join(`shop:${shopDbName}`);
            console.log(`📍 ${socket.id} joined shop:${shopDbName}`);
        });

        // Join admin room for admin-only updates
        socket.on('join:admin', () => {
            socket.join('admin');
            console.log(`👑 ${socket.id} joined admin room`);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Client disconnected:', socket.id);
        });
    });

    console.log('🔌 Socket.io initialized');
    return io;
};

/**
 * Get the Socket.io instance
 */
const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

// ==================== EMIT EVENTS ====================

/**
 * Emit to a specific shop room
 */
const emitToShop = (shopDbName, event, data) => {
    if (io) {
        io.to(`shop:${shopDbName}`).emit(event, data);
    }
};

/**
 * Emit to admin room
 */
const emitToAdmin = (event, data) => {
    if (io) {
        io.to('admin').emit(event, data);
    }
};

/**
 * Emit to everyone
 */
const emitToAll = (event, data) => {
    if (io) {
        io.emit(event, data);
    }
};

// ==================== SPECIFIC EVENT EMITTERS ====================

// Product events
const emitProductAdded = (shopDbName, product) => {
    emitToShop(shopDbName, 'product:added', product);
    emitToAdmin('product:added', { shopDbName, product });
};

const emitProductUpdated = (shopDbName, product) => {
    emitToShop(shopDbName, 'product:updated', product);
    emitToAdmin('product:updated', { shopDbName, product });
};

const emitProductDeleted = (shopDbName, productId) => {
    emitToShop(shopDbName, 'product:deleted', { productId });
    emitToAdmin('product:deleted', { shopDbName, productId });
};

// Stock update (for decrementing after sale)
const emitStockUpdated = (shopDbName, productId, newStock) => {
    emitToShop(shopDbName, 'stock:updated', { productId, units: newStock });
};

// Sale events
const emitSaleCompleted = (shopDbName, saleData) => {
    emitToShop(shopDbName, 'sale:completed', saleData);
    emitToAdmin('sale:completed', { shopDbName, ...saleData });
};

// Session events
const emitSessionEnded = (shopDbName, sessionReport) => {
    emitToAdmin('session:ended', { shopDbName, report: sessionReport });
};

const emitSessionReconciled = (shopDbName, reportId, reconciliationData) => {
    emitToAdmin('session:reconciled', { shopDbName, reportId, ...reconciliationData });
};

// Opened bottle events
const emitBottleOpened = (shopDbName, bottle) => {
    emitToShop(shopDbName, 'bottle:opened', bottle);
    emitToAdmin('bottle:opened', { shopDbName, bottle });
};

const emitBottleUpdated = (shopDbName, bottle) => {
    emitToShop(shopDbName, 'bottle:updated', bottle);
};

const emitBottleDeleted = (shopDbName, bottleId) => {
    emitToShop(shopDbName, 'bottle:deleted', { bottleId });
};

// Shopkeeper events
const emitShopkeeperAdded = (shopDbName, shopkeeper) => {
    emitToAdmin('shopkeeper:added', { shopDbName, shopkeeper });
};

const emitShopkeeperDeleted = (shopDbName, shopkeeperId) => {
    emitToAdmin('shopkeeper:deleted', { shopDbName, shopkeeperId });
};

// Shop events
const emitShopUpdated = () => {
    emitToAdmin('shop:updated', {});
};

module.exports = {
    initSocket,
    getIO,
    emitToShop,
    emitToAdmin,
    emitToAll,
    // Products
    emitProductAdded,
    emitProductUpdated,
    emitProductDeleted,
    emitStockUpdated,
    // Sales
    emitSaleCompleted,
    // Sessions
    emitSessionEnded,
    emitSessionReconciled,
    // Bottles
    emitBottleOpened,
    emitBottleUpdated,
    emitBottleDeleted,
    // Shopkeepers
    emitShopkeeperAdded,
    emitShopkeeperDeleted,
    // Shops
    emitShopUpdated,
};
