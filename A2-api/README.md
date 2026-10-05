# PROG2002 Assessment 2 — Charity Events

## Part 1: Database · Part 2: RESTful API

The server-side half of the *Charity Events* case study: the MySQL database
`schema` (Part 1) and the RESTful API built with Node.js, Express and `mysql2`
that serves the data to the client-side website (Part 2).

---

## 1. Files

| File | Part | Purpose |
|---|---|---|
| `database/charityevents_db.sql` | 1 | The complete SQL script: creates the database, the four tables, the relationships, the sample data and two views. **This is the file the marker imports.** |
| `db-details.js` | 1 | MySQL connection settings (host, port, user, password, database) in one place. |
| `event_db.js` | 1 | The required server connection file: connects Node.js to `charityevents_db` and exports the connection pool used by the API. |
| `api-controller.js` | 2 | The Express `Router()` holding every RESTful endpoint, with input validation and parameterised SQL. |
| `server.js` | 2 | The Express application: middleware, CORS, logging, mounting the routes and `app.listen(3060)`. |
| `package.json` | 1–2 | Project metadata and the `express` + `mysql2` dependencies. |
| `docs/schema-design.md` | 1 | Data model description and design decisions (for the *Data Schema* section of the report). |
| `docs/er-diagram.png` | 1 | Entity–relationship diagram. |
| `docs/api-design.md` | 2 | Endpoint list, one endpoint described in full, and the reasoning behind the HTTP method choices (for the *API design* section of the report). |
| `docs/postman-collection.json` | 2 | Importable Postman collection covering every endpoint, including the error cases. |

---

## 2. Setup

### Step 1 — Import the database

1. Start MySQL (MySQL Server + MySQL Workbench).
2. Open MySQL Workbench and connect to your local instance.
3. `File → Open SQL Script…` and select `database/charityevents_db.sql`.
4. Run the whole script (the lightning-bolt button) — or from a terminal:

   ```bash
   mysql -u root -p < database/charityevents_db.sql
   ```

The script starts with `DROP DATABASE IF EXISTS charityevents_db`, so it can be
run again at any time to return to a clean, known data set.

Verify the import with:

```sql
USE charityevents_db;
SELECT COUNT(*) FROM events;      -- 10
SELECT COUNT(*) FROM categories;  --  9
```

### Step 2 — Configure the credentials

Either edit `db-details.js`:

```js
password: process.env.DB_PASSWORD || 'your-password',
```

or set environment variables (recommended — the password stays out of the code):

| Variable | Default | Meaning |
|---|---|---|
| `DB_HOST` | `localhost` | MySQL server |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | *(empty)* | MySQL password |
| `DB_NAME` | `charityevents_db` | Database name |

PowerShell example:

```powershell
$env:DB_PASSWORD = "your-password"
```

### Step 3 — Install and test the connection

```bash
npm install        # installs mysql2
npm run db:test    # runs: node event_db.js
```

Successful output:

```
 event_db.js - MySQL connection test
----------------------------------------------------------
 Host        : localhost:3306
 Database    : charityevents_db
 MySQL       : 8.0.xx
 Server time : ...
----------------------------------------------------------
 organisations : 4 rows
 categories    : 9 rows
 locations     : 10 rows
 events        : 10 rows
----------------------------------------------------------
 Status      : CONNECTED - the database layer is ready.
```

---

## 3. Schema at a glance

```
organisations 1 ────< events >──── 1 categories
                       │
                       └──── 1 locations
```

| Table | Rows | Role in the case study |
|---|---|---|
| `organisations` | 4 | The charitable organisations that host events; supplies the static organisation information shown on the Home page. |
| `categories` | 9 | Event types (Fun Run, Gala Dinner, …). Supplies the categories endpoint used by the Search page filter. |
| `locations` | 10 | Venue, address and **city**; supports the "search by location" criterion. |
| `events` | 10 | The central table: title, summary, full description, dates, ticket price, fundraising goal and progress, capacity and status. 7 active + upcoming, 2 past, 1 suspended. |

Two views hide the joins from the API:

* `v_event_summary` — every event with its category, organisation and location
  names, plus a calculated `progress_percent` and a date-driven `event_state`
  (`past` / `ongoing` / `upcoming`).
* `v_active_events` — only events that the public website may show
  (`status = 'active'` and not finished yet).

---

## 4. How the design supports the three website pages

| Website requirement (brief) | Database support |
|---|---|
| Home page: list of current/upcoming events | `v_active_events` filtered on `event_state = 'upcoming'`, ordered by `start_datetime`. |
| Home page: mark events as *past* / *upcoming* | `event_state` is derived from `end_datetime` / `start_datetime` compared with `NOW()`, so it is never stale. |
| Home page: suspend events that violate policy | `events.status = 'suspended'` excludes the row from `v_active_events`; the record is kept for the organisation's records. |
| Search page: filter by **date** | `idx_events_start` on `start_datetime`, used with a `BETWEEN` range. |
| Search page: filter by **location** | `locations.city` with `idx_locations_city`. |
| Search page: filter by **category** | `events.category_id` with `idx_events_category`, joined to `categories.name`. |
| Search page: category dropdown | `SELECT category_id, name FROM categories ORDER BY name`. |
| Event detail page: full details | `SELECT * FROM v_event_summary WHERE event_id = ?`. |
| Event detail page: goal vs. progress | `goal_amount`, `raised_amount` and the calculated `progress_percent`. |
| Event detail page: ticket information | `ticket_price` (`0.00` = free event). |

---

## 5. Design decisions

1. **One database per brief** — the database is named `charityevents_db`, as
   required.
2. **Normalisation to 3NF** — organisations, categories and locations are
   stored once and referenced from `events` by foreign key, so a venue or
   category name is never duplicated.
3. **Surrogate keys** — every table has an `INT AUTO_INCREMENT` primary key,
   which keeps the foreign keys small and stable.
4. **Status vs. dates** — `status` holds only the *administrative* state
   (`active` / `suspended`). *Past* / *upcoming* is **calculated** from the
   dates instead of being stored, so the data can never contradict itself.
5. **Money and dates typed correctly** — `DECIMAL(12,2)` for amounts (no
   floating-point rounding errors), `DATETIME` for event dates and
   `registration_deadline`.
6. **Integrity enforced by the database** — `FOREIGN KEY` constraints
   (`ON DELETE RESTRICT` so an organisation with events cannot be deleted by
   accident), `CHECK` constraints on dates, amounts and capacity, and `UNIQUE`
   constraints on organisation name/e-mail and category name.
7. **Indexes for the actual queries** — indexes exist on `start_datetime`,
   `category_id`, `location_id`, `status`, and `city`.
8. **Parameterised queries** — `event_db.js` always sends values separately
   from the SQL text, which prevents SQL injection.

---

## 6. Notes

* The sample dates are relative to `CURDATE()`, so the data set always contains
  a realistic mix of finished and upcoming events whenever it is imported
  (`-30` and `-14` days = past, `+7` … `+90` days = upcoming).
* Seven of the ten events are active and still in the future, so the Home page
  always has content: `Art for Good Charity Exhibition` is `suspended`
  (demonstrating the policy-violation rule) and `Winter Warmth Trivia Night`
  and `Pet Rescue Adoption Fair` are already in the past (demonstrating the
  automatic *past* marking).
* All organisations, events and venues are fictional and are used only as
  sample data for this assessment.

---

# Part 2 — RESTful API

## 7. Endpoints

Base URL: `http://localhost:3060/api`

| Method & URL | Serves | Key parameters |
|---|---|---|
| `GET /api/health` | health check | – |
| `GET /api/events` | **Home page** — current and upcoming events with their category. `state=past` returns the finished ones, so the site can mark them as "past". | `state` (`upcoming` \| `past` \| `all`), `sort`, `limit` (1–100), `offset` |
| `GET /api/events/search` | **Search page** — filter by any combination of criteria | `state`, `from`, `to`, `city`, `category`, `keyword`, `sort`, `limit`, `offset` |
| `GET /api/events/{id}` | **Event detail page** — all data for one event (also works for a finished event; a suspended one answers `404`) | – |
| `GET /api/categories` | **Search page** — category dropdown (counts follow `state`) | `state` |
| `GET /api/locations` | **Search page** — city dropdown (counts follow `state`) | `state` |

Only `GET` is implemented: the brief states that `POST`, `PUT` and `DELETE`
are not required until Assessment 3.

**Past vs. upcoming** is never stored: the API compares `end_datetime` with
`NOW()` on every request and returns `event_state` (`upcoming`, `ongoing` or
`past`). Suspended events are excluded from every listing and answer `404` on
the detail endpoint, because the brief says they "will not be shown".

Every response uses the same envelope, so the client needs one render function
per page:

```json
{ "success": true, "count": 2, "data": [ { "event_id": 1, "title": "…" } ] }
```

```json
{ "success": false, "error": { "code": "INVALID_PARAMETER",
  "message": "\"from\" must be a date in YYYY-MM-DD format.", "parameter": "from" } }
```

Full documentation, including a worked request/response example and the
reasoning behind each HTTP method, is in
[docs/api-design.md](docs/api-design.md).

## 8. Run the API

```bash
npm install          # installs express and mysql2
node server.js       # or: npm start
```

```
----------------------------------------------------------
 PROG2002 A2 - Charity Events RESTful API
----------------------------------------------------------
 Listening on  : http://localhost:3060
 Database      : charityevents_db @ localhost:3306
 Try           : http://localhost:3060/api/events
----------------------------------------------------------
```

Change the port with `set PORT=4000` (Windows) if 3060 is taken.

## 9. Test the API

**In a browser** — every endpoint is a plain `GET`, so the JSON can be viewed
directly:

* <http://localhost:3060/api/events>
* <http://localhost:3060/api/events/search?city=Sydney&category=1>
* <http://localhost:3060/api/events/1>
* <http://localhost:3060/api/categories>

**In Postman** (Module 4) — import `docs/postman-collection.json`
(`File → Import → File`), then run the requests in order. The collection
covers the three required functionalities plus the error cases (`400` for an
impossible date, `404` for an unknown event id), which are worth capturing as
screenshots for the report.

## 10. Implementation notes

1. **Parameterised queries everywhere.** Values from the query string are
   always passed to MySQL as bound parameters (`?`); the SQL text is assembled
   only from fixed fragments and a whitelisted `ORDER BY`. User input can
   therefore never change the structure of a query.
2. **Validation before the database.** Dates must be real calendar dates in
   `YYYY-MM-DD` format, `category` must be a positive integer, `from` may not
   be later than `to`, `keyword` is limited to 100 characters, `city` to 80,
   and `limit` is capped at 100 rows.
3. **Route order.** `/api/events/search` is registered *before*
   `/api/events/:id`; otherwise Express would treat the word "search" as an
   event id.
4. **Correct status codes.** `200` success, `400` invalid parameter, `404`
   unknown event or endpoint, `500` server/database failure — always as JSON,
   never an HTML error page, so the client can branch on `response.status`.
5. **CORS.** The API sends `Access-Control-Allow-Origin: *` and answers the
   `OPTIONS` pre-flight request. This is required so that the Part 3
   client-side website — served from a different origin such as
   `http://127.0.0.1:5500` — is allowed to call the API.
6. **One connection pool.** `event_db.js` creates a single `mysql2` pool that
   every request reuses, instead of opening a new connection per request.
7. **Numbers in JSON.** `mysql2` returns `DECIMAL` and calculated columns as
   strings to protect precision; the controller converts them once so the
   client receives real JSON numbers.
8. **Dates as strings.** The pool is configured with `dateStrings: true`, so
   `DATETIME` values are returned as `"2026-11-24 07:00:00"` — readable in
   Postman and free of timezone surprises in the browser.
9. **Consistency with the unit material.** The structure follows Module 3 and
   Module 4: `db-details.js` for credentials, `event_db.js` for the
   connection, `api-controller.js` for the `Router()`, and `server.js` for the
   Express application and `listen()`.
