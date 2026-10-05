/**
 * api-controller.js  -  PROG2002 Web Development II, Assessment 2
 * ---------------------------------------------------------------------------
 * The routes of the RESTful API, built with the Router provided by Express and
 * the connection pool exported by event_db.js. server.js mounts this router
 * under /api, so each route below becomes the last part of a URL.
 *
 * Routes
 *   GET /api/health                 - service and database health check
 *   GET /api/events                 - current and upcoming events
 *                                     (?state=past returns the finished ones)
 *   GET /api/events/search          - filter by date / location / category /
 *                                     keyword / state
 *   GET /api/events/:id             - one event, with every column
 *   GET /api/categories             - the category list for the filter
 *   GET /api/locations              - the city list for the filter
 *
 * How a request is handled
 *   1. The query string is validated; an invalid value answers 400 immediately.
 *   2. The SQL text is assembled from fixed fragments only, and every value
 *      that came from the client is bound as a parameter (?), so a value can
 *      never change the structure of the query.
 *   3. The rows are normalised and returned in a consistent JSON envelope.
 *
 * Only GET is implemented: the API is read-only.
 * ---------------------------------------------------------------------------
 */

const express = require('express');
const db = require('./event_db');

const router = express.Router();

// ---------------------------------------------------------------------------
// Column lists
//   The list endpoints deliberately omit "description" (a long TEXT column)
//   because the Home and Search pages only need the summary view; the detail
//   endpoint returns every column.
// ---------------------------------------------------------------------------
const SUMMARY_COLUMNS = `
    event_id, title, summary, category_id, category_name, organisation_name,
    venue_name, city, state, start_datetime, end_datetime, ticket_price,
    goal_amount, raised_amount, progress_percent, capacity, status, event_state,
    image_url`;

const DETAIL_COLUMNS = `
    ${SUMMARY_COLUMNS}, description, registration_deadline, organisation_id,
    location_id, postcode`;

// Sort options are whitelisted: the client sends a short key and the API maps
// it to a fixed ORDER BY clause, so no user text ever reaches the SQL.
const SORT_OPTIONS = {
    soonest: 'start_datetime ASC',
    latest: 'start_datetime DESC',
    price_low: 'ticket_price ASC',
    price_high: 'ticket_price DESC',
    progress: 'progress_percent DESC',
    title: 'title ASC'
};
const DEFAULT_SORT = 'soonest';

// ---------------------------------------------------------------------------
// Which slice of the events a request returns, as a fixed table of date rules.
//
// The "past" / "upcoming" distinction is worked out from the event dates
// compared with NOW() on every request, so it can never disagree with the data.
// A suspended event is excluded from all three slices, because an event that
// breaks the fundraising policy must not be shown anywhere.
//
// Each entry is a function so the same rule can be used with or without a
// table alias (the lookup routes join the events table as "e").
// ---------------------------------------------------------------------------
const STATE_FILTERS = {
    upcoming: (t) => `(${t}end_datetime IS NULL OR ${t}end_datetime >= NOW())`,
    past: (t) => `(${t}end_datetime IS NOT NULL AND ${t}end_datetime < NOW())`,
    all: () => '(1 = 1)'
};
const STATE_KEYS = Object.keys(STATE_FILTERS);
const DEFAULT_STATE = 'upcoming';
const ONLY_ACTIVE = "status = 'active'";

/** @returns {string|null} the requested state key, or null when it is invalid */
function resolveState(value) {
    const key = value === undefined ? DEFAULT_STATE : String(value);
    return Object.prototype.hasOwnProperty.call(STATE_FILTERS, key) ? key : null;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Wrap an async route handler so a rejected promise reaches the error
 *  handler instead of crashing the server (Express 4 does not do this). */
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/** Send a 400 response. */
function invalid(res, message, parameter) {
    return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMETER', message, parameter }
    });
}

/** Send a 404 response. */
function notFound(res, message) {
    return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message }
    });
}

/** True when the value is a real date written as YYYY-MM-DD. */
function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Parse a positive integer from a query string, or return null. */
function toPositiveInt(value) {
    if (!/^\d+$/.test(String(value))) return null;
    const number = Number(value);
    return number > 0 ? number : null;
}

/**
 * mysql2 returns DECIMAL and calculated columns as strings (for example
 * "35.00") to avoid losing precision. The website needs numbers, so the
 * numeric columns are converted once, here, instead of in every page.
 */
function normaliseEvent(row) {
    return {
        ...row,
        ticket_price: Number(row.ticket_price),
        goal_amount: Number(row.goal_amount),
        raised_amount: Number(row.raised_amount),
        progress_percent: Number(row.progress_percent),
        capacity: row.capacity === null ? null : Number(row.capacity)
    };
}

/** Build the standard success envelope used by every endpoint. */
function ok(res, rows, extra = {}) {
    return res.status(200).json({
        success: true,
        count: rows.length,
        ...extra,
        data: rows.map(normaliseEvent)
    });
}

// ---------------------------------------------------------------------------
// GET /api/health - is the API alive and can it reach MySQL?
// ---------------------------------------------------------------------------
router.get('/health', asyncHandler(async (req, res) => {
    const [rows] = await db.query('SELECT DATABASE() AS database_name, NOW() AS server_time');

    res.status(200).json({
        success: true,
        service: 'PROG2002 A2 - Charity Events API',
        database: rows[0].database_name,
        server_time: rows[0].server_time
    });
}));

// ---------------------------------------------------------------------------
// GET /api/events
//   The collection of events, with the category, organisation and venue names
//   already joined in by the v_event_summary view.
//
//   Query parameters:
//     state  upcoming (default) | past | all  - which events to return
//     sort   a key from SORT_OPTIONS         - default soonest, or latest for past
//     limit  1..100 (default 50)
//     offset 0 or more (default 0)
//
//   Every row carries event_state ('upcoming', 'ongoing' or 'past') so the
//   client can label an event without recalculating the dates itself.
// ---------------------------------------------------------------------------
router.get('/events', asyncHandler(async (req, res) => {
    const { state, sort } = req.query;

    const stateKey = resolveState(state);
    if (stateKey === null) {
        return invalid(res, `"state" must be one of: ${STATE_KEYS.join(', ')}.`, 'state');
    }
    const stateFilter = STATE_FILTERS[stateKey]('');

    // Default ordering depends on the slice: the soonest event first when
    // looking ahead, the most recent event first when looking back.
    const defaultSort = stateKey === 'past' ? 'latest' : DEFAULT_SORT;
    const orderBy = SORT_OPTIONS[sort === undefined ? defaultSort : sort];
    if (orderBy === undefined) {
        return invalid(res,
            `"sort" must be one of: ${Object.keys(SORT_OPTIONS).join(', ')}.`, 'sort');
    }

    const limit = req.query.limit === undefined ? DEFAULT_LIMIT : toPositiveInt(req.query.limit);
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);

    if (limit === null || limit > MAX_LIMIT) {
        return invalid(res, `"limit" must be a whole number between 1 and ${MAX_LIMIT}.`, 'limit');
    }
    if (!Number.isInteger(offset) || offset < 0) {
        return invalid(res, '"offset" must be a whole number of 0 or more.', 'offset');
    }

    const [rows] = await db.query(
        `SELECT ${SUMMARY_COLUMNS}
           FROM v_event_summary
          WHERE ${ONLY_ACTIVE}
            AND ${stateFilter}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?`,
        [limit, offset]
    );

    return res.status(200).json({
        success: true,
        count: rows.length,
        state: stateKey,
        sort: sort === undefined ? defaultSort : sort,
        limit,
        offset,
        data: rows.map(normaliseEvent)
    });
}));

// ---------------------------------------------------------------------------
// GET /api/events/search
//   The same collection, narrowed down by date, location and category (any
//   combination of them), plus an optional keyword and sort order.
//
//   Query parameters (all optional, they are ANDed together):
//     state    upcoming (default) | past | all
//     from     YYYY-MM-DD   events starting on or after this date
//     to       YYYY-MM-DD   events starting on or before this date
//     city     string       exact city name, e.g. Sydney
//     category integer      category_id from /api/categories
//     keyword  string       text searched in the title and summary
//     sort     soonest | latest | price_low | price_high | progress | title
//     limit    1..100       default 50
//     offset   0 or more    default 0
//
//   IMPORTANT: this route is declared BEFORE "/events/:id" so that Express
//   does not treat the word "search" as an event id.
// ---------------------------------------------------------------------------
router.get('/events/search', asyncHandler(async (req, res) => {
    const { from, to, city, category, keyword, sort, state } = req.query;

    // ---- validate ---------------------------------------------------------
    const stateKey = resolveState(state);
    if (stateKey === null) {
        return invalid(res, `"state" must be one of: ${STATE_KEYS.join(', ')}.`, 'state');
    }
    const stateFilter = STATE_FILTERS[stateKey]('');
    if (from !== undefined && !isIsoDate(from)) {
        return invalid(res, '"from" must be a date in YYYY-MM-DD format.', 'from');
    }
    if (to !== undefined && !isIsoDate(to)) {
        return invalid(res, '"to" must be a date in YYYY-MM-DD format.', 'to');
    }
    if (from !== undefined && to !== undefined && from > to) {
        return invalid(res, '"from" must not be later than "to".', 'from');
    }
    if (city !== undefined && (city.trim() === '' || city.length > 80)) {
        return invalid(res, '"city" must be between 1 and 80 characters.', 'city');
    }
    if (keyword !== undefined && keyword.length > 100) {
        return invalid(res, '"keyword" must be 100 characters or fewer.', 'keyword');
    }

    let categoryId;
    if (category !== undefined) {
        categoryId = toPositiveInt(category);
        if (categoryId === null) {
            return invalid(res, '"category" must be a positive category id.', 'category');
        }
    }

    const defaultSort = stateKey === 'past' ? 'latest' : DEFAULT_SORT;
    const orderBy = SORT_OPTIONS[sort === undefined ? defaultSort : sort];
    if (orderBy === undefined) {
        return invalid(res,
            `"sort" must be one of: ${Object.keys(SORT_OPTIONS).join(', ')}.`, 'sort');
    }

    const limit = req.query.limit === undefined ? DEFAULT_LIMIT : toPositiveInt(req.query.limit);
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    if (limit === null || limit > MAX_LIMIT) {
        return invalid(res, `"limit" must be a whole number between 1 and ${MAX_LIMIT}.`, 'limit');
    }
    if (!Number.isInteger(offset) || offset < 0) {
        return invalid(res, '"offset" must be a whole number of 0 or more.', 'offset');
    }

    // ---- build the WHERE clause from bound parameters ----------------------
    // The first two fragments are fixed text: suspended events are never
    // returned, and the date range decides whether the caller sees upcoming,
    // past or all events. Everything the user supplied goes into params.
    const conditions = [ONLY_ACTIVE, stateFilter];
    const params = [];

    if (from !== undefined) {
        conditions.push('start_datetime >= ?');
        params.push(`${from} 00:00:00`);
    }
    if (to !== undefined) {
        conditions.push('start_datetime <= ?');
        params.push(`${to} 23:59:59`);
    }
    if (city !== undefined) {
        conditions.push('city = ?');
        params.push(city.trim());
    }
    if (categoryId !== undefined) {
        conditions.push('category_id = ?');
        params.push(categoryId);
    }
    if (keyword !== undefined && keyword.trim() !== '') {
        conditions.push('(title LIKE ? OR summary LIKE ?)');
        params.push(`%${keyword.trim()}%`, `%${keyword.trim()}%`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    params.push(limit, offset);
    const [rows] = await db.query(
        `SELECT ${SUMMARY_COLUMNS}
           FROM v_event_summary
           ${where}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?`,
        params
    );

    return res.status(200).json({
        success: true,
        count: rows.length,
        filters: {
            from: from ?? null,
            to: to ?? null,
            city: city ?? null,
            category: categoryId ?? null,
            keyword: keyword ?? null,
            state: stateKey,
            sort: sort ?? defaultSort
        },
        limit,
        offset,
        data: rows.map(normaliseEvent)
    });
}));

// ---------------------------------------------------------------------------
// GET /api/events/:id
//   One event with every column, including the full description, the
//   registration deadline, the ticket price and the fundraising progress.
//
//   A finished event is returned here as well, because the client labels it as
//   "past" instead of hiding it. A suspended event answers 404: its row exists
//   in the database, but it must not be served.
// ---------------------------------------------------------------------------
router.get('/events/:id', asyncHandler(async (req, res) => {
    const eventId = toPositiveInt(req.params.id);

    if (eventId === null) {
        return invalid(res, '"id" must be a positive event id, for example /api/events/1.', 'id');
    }

    const [rows] = await db.query(
        `SELECT ${DETAIL_COLUMNS}
           FROM v_event_summary
          WHERE event_id = ?
            AND ${ONLY_ACTIVE}`,
        [eventId]
    );

    if (rows.length === 0) {
        return notFound(res, `No event was found with id ${eventId}.`);
    }

    return ok(res, rows);
}));

// ---------------------------------------------------------------------------
// GET /api/categories
//   Every category with the number of events it currently holds, for the
//   category dropdown on the search page.
//
//   event_count follows the same "state" parameter as the search, so the
//   number shown beside a category is always the number of results that
//   category will produce.
// ---------------------------------------------------------------------------
router.get('/categories', asyncHandler(async (req, res) => {
    const stateKey = resolveState(req.query.state);
    if (stateKey === null) {
        return invalid(res, `"state" must be one of: ${STATE_KEYS.join(', ')}.`, 'state');
    }

    const [rows] = await db.query(
        `SELECT c.category_id, c.name, c.description,
                COUNT(e.event_id) AS event_count
           FROM categories c
           LEFT JOIN events e
                  ON e.category_id = c.category_id
                 AND e.status = 'active'
                 AND ${STATE_FILTERS[stateKey]('e.')}
          GROUP BY c.category_id, c.name, c.description
          ORDER BY c.name ASC`
    );

    return res.status(200).json({
        success: true,
        count: rows.length,
        state: stateKey,
        // event_count is a COUNT(*), so mysql2 returns it as a number already,
        // but it is normalised here so the JSON shape stays consistent.
        data: rows.map((row) => ({ ...row, event_count: Number(row.event_count) }))
    });
}));

// ---------------------------------------------------------------------------
// GET /api/locations
//   The distinct cities that events are held in, with how many events each one
//   has. The search page uses it to fill the location dropdown from real data
//   instead of hard-coding the city names in the HTML.
// ---------------------------------------------------------------------------
router.get('/locations', asyncHandler(async (req, res) => {
    const stateKey = resolveState(req.query.state);
    if (stateKey === null) {
        return invalid(res, `"state" must be one of: ${STATE_KEYS.join(', ')}.`, 'state');
    }

    const [rows] = await db.query(
        `SELECT l.city, l.state, COUNT(e.event_id) AS event_count
           FROM locations l
           LEFT JOIN events e
                  ON e.location_id = l.location_id
                 AND e.status = 'active'
                 AND ${STATE_FILTERS[stateKey]('e.')}
          GROUP BY l.city, l.state
          ORDER BY l.city ASC`
    );

    return res.status(200).json({
        success: true,
        count: rows.length,
        state: stateKey,
        data: rows.map((row) => ({ ...row, event_count: Number(row.event_count) }))
    });
}));

module.exports = router;
