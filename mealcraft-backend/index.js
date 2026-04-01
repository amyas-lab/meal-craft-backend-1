require('dotenv').config();

const app = require('./src/app');
const { testDatabaseConnection } = require('./src/config/db');

const port = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await testDatabaseConnection();
    console.log('✅ Database connected successfully!');
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.error('❌ Connection failed:', message);
  }

  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
  });
}

startServer();
