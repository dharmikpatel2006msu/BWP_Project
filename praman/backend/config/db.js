const mongoose = require('mongoose');

let mongodInstance = null;

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/praman_db';

  try {
    // Attempt standard connection first with 3 second serverSelectionTimeout
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`[PRAMAN] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.warn(`[PRAMAN] Could not connect to local MongoDB at ${uri}: ${err.message}`);
    
    // In development/demo, fall back to MongoMemoryServer if available
    try {
      console.log('[PRAMAN] Attempting to start in-memory MongoDB fallback...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      const memUri = mongodInstance.getUri();
      
      const conn = await mongoose.connect(memUri);
      console.log(`[PRAMAN] Connected to In-Memory MongoDB at: ${memUri}`);
      console.log('[PRAMAN] Running in standalone demo mode with temporary in-memory database.');
      return conn;
    } catch (memErr) {
      console.error('[PRAMAN] MongoDB connection failed completely:');
      console.error(err.message);
      console.error('Please ensure MongoDB is running or install mongodb-memory-server.');
      throw err;
    }
  }
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
};

module.exports = { connectDB, disconnectDB };
