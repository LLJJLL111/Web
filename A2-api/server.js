/**
 * server.js  -  PROG2002 Web Development II, Assessment 2
 * ---------------------------------------------------------------------------
 * The Express application that serves the RESTful API. It does five things:
 *
 *   1. Create the Express application.
 *   2. Register the middleware: JSON body parsing, CORS (so a browser page
 *      served from another origin is allowed to call this API) and a short
 *      request log.
 *   3. Mount the routes exported by api-controller.js under /api.
 *   4. Answer unknown URLs with a JSON 404 and any thrown error with a JSON
 *      500, so a client always receives JSON and never an HTML error page.
 *   5. Listen on a port (3060 by default, or process.env.PORT).
 *
 * Run it with:  node server.js      (or: npm start)
 * ---------------------------------------------------------------------------
 */

const express = require('express');
const apiController = require('./api-controller');
const db = require('./event_db');

const app = express();
const PORT = Number(process.env.PORT) || 3060;

// ---------------------------------------------------------------------------
// 1. Middleware
// ---------------------------------------------------------------------------

// Parse an incoming JSON request body into req.body.
// No endpoint reads a body yet (the API is read-only), but the parser is
// registered so that a JSON body sent to a future POST/PUT is understood
// instead of arriving as undefined.
app.use(express.json());

// CORS - Cross Origin Resource Sharing.
// The client-side website is served from a different origin (for example
// http://127.0.0.1:5500 with Live Server), so the browser would block its
// requests unless the API allows them. Only GET is exposed, because
// this API is read-only.
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);   // pre-flight request, no body needed
    }
    return next();
});

// Request log - useful while demonstrating the API in the video.
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()}  ${req.method} ${req.originalUrl}`);
    next();
});

// ---------------------------------------------------------------------------
// 2. Routes
//    Everything the controller defines is available under /api,
//    e.g. GET /api/events, GET /api/events/search, GET /api/events/1,
//         GET /api/categories, GET /api/locations, GET /api/health
// ---------------------------------------------------------------------------
app.use('/api', apiController);

// A short description of the API for anyone who opens the root URL.
// (The port is read from the request, so the message stays correct whatever
// port the server was started on.)
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        service: 'Charity Events API',
        documentation: 'See docs/api-design.md',
        endpoints: [
            'GET /api/health',
            'GET /api/events?state=&sort=&limit=&offset=',
            'GET /api/events/search?state=&from=&to=&city=&category=&keyword=&sort=',
            'GET /api/events/:id',
            'GET /api/categories?state=',
            'GET /api/locations?state='
        ]
    });
});

// ---------------------------------------------------------------------------
// 3. 404 - no route matched
// ---------------------------------------------------------------------------
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'ENDPOINT_NOT_FOUND',
            message: `The endpoint ${req.method} ${req.originalUrl} does not exist on this API.`
        }
    });
});

// ---------------------------------------------------------------------------
// 4. Error handler
//    Express 4 forwards anything passed to next(err) - including a rejected
//    promise wrapped by asyncHandler in api-controller.js - to this function.
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('[server] Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'The server could not complete the request. Please try again.'
        }
    });
});

// ---------------------------------------------------------------------------
// 5. Start the server (only when this file is run directly, so that the
//    application can also be imported by a test file).
// ---------------------------------------------------------------------------
if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log('----------------------------------------------------------');
        console.log(' Charity Events RESTful API');
        console.log('----------------------------------------------------------');
        console.log(` Listening on  : http://localhost:${PORT}`);
        console.log(` Database      : ${db.dbDetails.database} @ ${db.dbDetails.host}:${db.dbDetails.port}`);
        console.log(' Try           : http://localhost:' + PORT + '/api/events');
        console.log('----------------------------------------------------------');
    });

    // Close the MySQL pool cleanly instead of leaving the connections open.
    const shutdown = () => {
        console.log('\n[server] Shutting down...');
        server.close(async () => {
            await db.closePool();
            process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

module.exports = app;
