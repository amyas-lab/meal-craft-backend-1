require('dotenv').config();

const { testDatabaseConnection } = require('./src/config/db');

async function startServer() {
  try {
    await testDatabaseConnection();
    console.log('✅ Database connected successfully!');
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.error('❌ Connection failed:', message);
  }

  require('./src/app');
}

startServer();
