import http from 'http';
import dotenv from 'dotenv';
import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initSocket } from './config/socket.js';
import { registerSeatSocketGateway } from './sockets/seatSocketGateway.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 1. Connect to MongoDB (ADR-007)
    await connectDB();

    // 2. Create HTTP server wrapping Express app
    const httpServer = http.createServer(app);

    // 3. Initialize Socket.IO server (ADR-003)
    const io = initSocket(httpServer);

    // 4. Register WebSocket seat gateway (§C7.2)
    registerSeatSocketGateway(io);

    // 5. Start listening for HTTP & WebSocket connections
    httpServer.listen(PORT, () => {
      console.log(`[Server] Encore API running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`[Server] Healthcheck available at: http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown handling
    const handleShutdown = async (signal) => {
      console.log(`\n[Server] ${signal} signal received. Closing HTTP server and database connections...`);
      httpServer.close(async () => {
        await disconnectDB();
        console.log('[Server] Graceful shutdown completed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    console.error(`[Server] Startup Failed: ${error.message}`);
    process.exit(1);
  }
}

startServer();
