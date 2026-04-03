// Import required modules
const mysql = require('mysql2/promise');
require('dotenv').config();

const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PORT'];
const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}
// Pool is a reusable database connections
// connection limtis: 10
// queue limit: 0
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10, // Maximum number of connections in the pool
  queueLimit: 0,
});

// Asynchronous function returns 
// await pauses execution  until the promise is resolved 
async function testDatabaseConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping(); // send a lightweight signal to the database to test the connection
    return true;
  } finally {
    connection.release();
  }
}

module.exports = { // export the pool and the functions so other files can use them
  pool,
  testDatabaseConnection,
};


/*
Big picture
.env file: stores sensitive data like passwords
-> dotenv loads it
-> process.env accesses it
-> mysql2/promise: database connection pool 
-> pool: reusable connections

-> testDatabaseConnection: tests the connection
-> module.exports: exports the pool and the functions so other files can use them
*/

