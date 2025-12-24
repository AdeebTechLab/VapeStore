const app = require('./app');
const { connectAdminDB, closeAllConnections } = require('./config/database');
const config = require('./config/environment');
const seedDatabase = require('./utils/seedDatabase');
const { initSocket } = require('./services/socketService');

const PORT = config.port;

// Start server
const startServer = async () => {
    try {
        console.log('\n🚀 Starting VapeShop Server...\n');

        // Connect to admin database
        await connectAdminDB();

        // Seed database with initial data
        await seedDatabase();

        // Start Express server
        const server = app.listen(PORT, () => {
            console.log(`\n✅ Server running on port ${PORT}`);
            console.log(`📍 API: http://localhost:${PORT}`);
            console.log(`🏥 Health: http://localhost:${PORT}/health`);
            console.log(`🌍 Environment: ${config.nodeEnv}\n`);
        });

        // Initialize Socket.io for real-time updates
        initSocket(server);
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('\n⚠️  SIGTERM signal received: closing HTTP server');
            server.close(async () => {
                console.log('HTTP server closed');
                await closeAllConnections();
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('\n⚠️  SIGINT signal received: closing HTTP server');
            server.close(async () => {
                console.log('HTTP server closed');
                await closeAllConnections();
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
