/**
 * db-details.js  -  PROG2002 Web Development II, Assessment 2
 * ---------------------------------------------------------------------------
 * The MySQL connection settings for this project, kept in one module so that
 * every other file imports them from a single place and the credentials only
 * ever have to be changed here.
 *
 * Each value is read from an environment variable when one is set, and falls
 * back to the usual local development default otherwise. That makes the module
 * work out of the box while still allowing the password to be kept out of the
 * source code.
 * ---------------------------------------------------------------------------
 */

const dbDetails = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,          // default MySQL port
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'LJL134652',
    database: process.env.DB_NAME || 'charityevents_db',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10
};

module.exports = dbDetails;
