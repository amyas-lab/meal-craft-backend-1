const express = require('express'); // Most popular Node.js framework for building web servers/ APIs 
const cors = require('cors'); // Middleware for handling Cross-Origin Resource Sharing (CORS)
// cors(): mobile app on different IP/ domain needs permission to connect

// Application instance -- it contains all the configurations
const app = express();

// Middleware: functions that intercept every request before it reaches your route
/*
request 
-> cors
-> express.json
-> route handler
*/
/* Workflow: Requests come in -> Server -> HTTP response -> client
*/
app.use(cors());
app.use(express.json()); // The mobile app sends JSON

// A route handler -- health check 
app.get('/health', (_req, res) => {
    // .get: HTTP GET request method
  res.status(200).json({ status: 'ok' });
});
// Routes: Make URL calls and route them to the appropriate file (js files) handling it
    // Express instance routs the URL call 
app.use('/api/auth', require('./routes/auth'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/group', require('./routes/group'));

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
// Export the app instance so it can be used in other files
module.exports = app;

// _req: not using the request not this variable
// res: respond object, used to send data back
// res.status(200)