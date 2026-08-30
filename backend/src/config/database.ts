import mongoose from 'mongoose';
import dns from 'dns';
import { env } from './env';
import { logger } from '../utils/logger';
import { DatabaseHealth } from '../types';

// Ensure Node.js uses standard reliable DNS resolvers for MongoDB Atlas SRV lookups on Windows
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {
  // Ignore if not permitted
}

// Disable unhandled long buffering
mongoose.set('bufferCommands', false);
// Automatically bind every Mongoose operation inside connection.transaction()
// to its transaction session, preventing accidental out-of-transaction writes.
mongoose.set('transactionAsyncLocalStorage', true);

export const getDatabaseHealth = (): DatabaseHealth => {
  const readyState = mongoose.connection.readyState;
  let status: DatabaseHealth['status'];

  switch (readyState) {
    case 0:
      status = 'disconnected';
      break;
    case 1:
      status = 'connected';
      break;
    case 2:
      status = 'connecting';
      break;
    case 3:
      status = 'disconnecting';
      break;
    default:
      status = 'disconnected';
  }

  return {
    status,
    readyState,
    host: mongoose.connection.host || undefined,
    name: mongoose.connection.name || undefined,
  };
};

let isConnecting = false;

export const connectDatabase = async (): Promise<boolean> => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (isConnecting) {
    return false;
  }

  isConnecting = true;
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info('MongoDB connected successfully to Atlas', {
      host: mongoose.connection.host,
      db: mongoose.connection.name,
    });
    isConnecting = false;
    return true;
  } catch (error: any) {
    isConnecting = false;
    logger.error('Failed to connect to MongoDB Atlas:', {
      message: error.message,
    });
    return false;
  }
};

// Set up event listeners once
mongoose.connection.on('connected', () => {
  logger.info('MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB runtime connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection lost. Auto-reconnect will retry in background.');
});

// Periodic background auto-reconnect attempt every 15 seconds if in degraded state
setInterval(async () => {
  if (mongoose.connection.readyState === 0) {
    await connectDatabase();
  }
}, 15000);

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected gracefully');
  }
};
