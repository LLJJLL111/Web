/**
 * event_db.js  -  PROG2002 Web Development II, Assessment 2
 * ---------------------------------------------------------------------------
 * The database connection module. It connects the Node.js application to the
 * MySQL database "charityevents_db" created by database/charityevents_db.sql
 * and exports everything the API needs:
 *
 *   pool            - a reusable mysql2 connection pool (promise API). Every
 *                     request in the API uses this pool instead of opening its
 *                     own connection, because one connection per request does
 *                     not scale and would exhaust the server.
 *   query()         - a shortcut for pool.query(sql, params).
 *   getConnection() - a single connection, created with the callback API, for
 *                     small standalone scripts.
 *   testConnection()- runs a few diagnostic queries and prints the result.
 *   closePool()     - ends every pooled connection on shutdown.
 *
 * Run the file on its own to prove that the connection works:
 *   node event_db.js
 * ---------------------------------------------------------------------------
 */

const mysql = require('mysql2');                 // callback API
const mysqlPromise = require('mysql2/promise');  // promise API (async/await)

const dbDetails = require('./db-details');

// ---------------------------------------------------------------------------
// Connection settings (single source of truth: db-details.js)
// ---------------------------------------------------------------------------
const connectionOptions = {
    host: dbDetails.host,
    port: dbDetails.port,
    user: dbDetails.user,
    password: dbDetails.password,
    database: dbDetails.database
};

// ---------------------------------------------------------------------------
// 1. Shared connection pool (promise API) - used by the REST API in Part 2
// ---------------------------------------------------------------------------
const pool = mysqlPromise.createPool({
    ...connectionOptions,
    waitForConnections: true,                    // queue requests if all busy
    connectionLimit: dbDetails.connectionLimit,  // maximum open connections
    queueLimit: 0,                               // 0 = unlimited queue
    dateStrings: true                            // return DATETIME/DATE as
                                                 // 'YYYY-MM-DD HH:MM:SS' text so
                                                 // the JSON of the API is
                                                 // readable and timezone-safe
});

/**
 * Execute a parameterised query through the pool.
 * Parameters are always passed separately so the values are escaped by the
 * driver - this prevents SQL injection.
 *
 * @param {string} sql    SQL statement, optionally with ? placeholders
 * @param {Array}  params values for the placeholders
 * @returns {Promise<Array>} [rows, fields]
 */
async function query(sql, params = []) {
    return pool.query(sql, params);
}

/**
 * Close every pooled connection (used when the API shuts down cleanly).
 */
async function closePool() {
    await pool.end();
}

// ---------------------------------------------------------------------------
// 2. Single connection helper (mysql2 callback API), for one-off scripts
// ---------------------------------------------------------------------------
function getConnection() {
    const connection = mysql.createConnection(connectionOptions);

    connection.connect((err) => {
        if (err) {
            console.error('[event_db] Connection failed:', err.message);
            return;
        }
        console.log(`[event_db] Connected to MySQL database "${dbDetails.database}" ` +
                    `on ${dbDetails.host}:${dbDetails.port} as "${dbDetails.user}".`);
    });

    return connection;
}

// ---------------------------------------------------------------------------
// 3. Connection test / diagnostics
// ---------------------------------------------------------------------------
async function testConnection() {
    let ok = false;

    try {
        const [rows] = await pool.query(`
            SELECT DATABASE()                AS database_name,
                   VERSION()                 AS mysql_version,
                   NOW()                     AS server_time,
                   (SELECT COUNT(*) FROM organisations) AS organisations,
                   (SELECT COUNT(*) FROM categories)    AS categories,
                   (SELECT COUNT(*) FROM locations)     AS locations,
                   (SELECT COUNT(*) FROM events)        AS events
        `);

        const info = rows[0];

        console.log('----------------------------------------------------------');
        console.log(' event_db.js - MySQL connection test');
        console.log('----------------------------------------------------------');
        console.log(` Host        : ${dbDetails.host}:${dbDetails.port}`);
        console.log(` Database    : ${info.database_name}`);
        console.log(` MySQL       : ${info.mysql_version}`);
        console.log(` Server time : ${info.server_time}`);
        console.log('----------------------------------------------------------');
        console.log(` organisations : ${info.organisations} rows`);
        console.log(` categories    : ${info.categories} rows`);
        console.log(` locations     : ${info.locations} rows`);
        console.log(` events        : ${info.events} rows`);
        console.log('----------------------------------------------------------');
        console.log(' Status      : CONNECTED - the database layer is ready.');
        console.log('----------------------------------------------------------');

        ok = true;
    } catch (err) {
        console.error('----------------------------------------------------------');
        console.error(' event_db.js - MySQL connection test');
        console.error('----------------------------------------------------------');
        console.error(` Status      : FAILED - ${err.code || 'ERROR'}: ${err.message}`);
        console.error(' Check that MySQL is running, that database/charityevents_db.sql');
        console.error(' has been imported and that db-details.js (or the DB_* environment');
        console.error(' variables) contain the correct credentials.');
        console.error('----------------------------------------------------------');
    }

    return ok;
}

// ---------------------------------------------------------------------------
// 4. Exports - everything the Part 2 REST API needs
// ---------------------------------------------------------------------------
module.exports = {
    pool,
    query,
    getConnection,
    testConnection,
    closePool,
    dbDetails
};

// ---------------------------------------------------------------------------
// 5. Allow "node event_db.js" to run the connection test directly
// ---------------------------------------------------------------------------
if (require.main === module) {
    testConnection()
        .then(async (ok) => {
            await closePool();          // release the connections and exit
            process.exit(ok ? 0 : 1);
        });
}
