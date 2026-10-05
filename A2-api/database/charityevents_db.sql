-- ============================================================================
--  PROG2002 Web Development II  -  Assessment 2
--  Charity events database: schema, tables, relationships, initial data, views
--
--  Schema     : charityevents_db
--  Case study : a dynamic website that manages charity events
--  DBMS       : MySQL 8.0+  (InnoDB / utf8mb4)
--
--  HOW TO USE
--   1. Open MySQL Workbench (or the mysql CLI).
--   2. Open this file and run the whole script (lightning bolt icon).
--   3. The script drops and recreates charityevents_db, so it can be re-run
--      at any time to return to a clean, known data set.
--
--  CONTENTS
--   1. Database creation
--   2. Tables        : organisations, categories, locations, events
--   3. Initial data  :  4 organisations, 9 categories, 10 locations, 10 events
--   4. Views         : v_event_summary, v_active_events
--   5. Sample queries: row counts, the queries the website runs, and a check
--                      that suspended events stay hidden
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. DATABASE CREATION
-- ---------------------------------------------------------------------------
DROP DATABASE IF EXISTS charityevents_db;

CREATE DATABASE charityevents_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE charityevents_db;


-- ---------------------------------------------------------------------------
-- 2. TABLE CREATION
--    Every table uses a surrogate AUTO_INCREMENT primary key.
--    Relationships are enforced with FOREIGN KEY constraints.
-- ---------------------------------------------------------------------------

-- 2.1 organisations: the charitable organisations that host the events --------
CREATE TABLE organisations (
    organisation_id   INT             NOT NULL AUTO_INCREMENT,
    name              VARCHAR(120)    NOT NULL,
    mission           VARCHAR(255)    NOT NULL,
    description       TEXT            NULL,
    email             VARCHAR(120)    NOT NULL,
    phone             VARCHAR(30)     NULL,
    website           VARCHAR(255)    NULL,
    city              VARCHAR(80)     NOT NULL,
    logo_url          VARCHAR(255)    NULL,
    created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_organisations PRIMARY KEY (organisation_id),
    CONSTRAINT uq_organisations_name  UNIQUE (name),
    CONSTRAINT uq_organisations_email UNIQUE (email)
) ENGINE = InnoDB;


-- 2.2 categories: the event types used by the Search page filter -------------
CREATE TABLE categories (
    category_id       INT             NOT NULL AUTO_INCREMENT,
    name              VARCHAR(60)     NOT NULL,
    description       VARCHAR(255)    NULL,
    CONSTRAINT pk_categories PRIMARY KEY (category_id),
    CONSTRAINT uq_categories_name UNIQUE (name)
) ENGINE = InnoDB;


-- 2.3 locations: where an event is held (venue + city used by Search) --------
CREATE TABLE locations (
    location_id       INT             NOT NULL AUTO_INCREMENT,
    venue_name        VARCHAR(120)    NOT NULL,
    address_line      VARCHAR(150)    NOT NULL,
    city              VARCHAR(80)     NOT NULL,
    state             VARCHAR(40)     NOT NULL,
    postcode          VARCHAR(10)     NOT NULL,
    latitude          DECIMAL(9,6)    NULL,
    longitude         DECIMAL(9,6)    NULL,
    CONSTRAINT pk_locations PRIMARY KEY (location_id),
    INDEX idx_locations_city (city),
    INDEX idx_locations_state (state)
) ENGINE = InnoDB;


-- 2.4 events: the central table of the case study ----------------------------
--     status        = administrative state only ('suspended' hides the event)
--     start/end date = source of truth for past / ongoing / upcoming
CREATE TABLE events (
    event_id              INT             NOT NULL AUTO_INCREMENT,
    organisation_id       INT             NOT NULL,
    category_id           INT             NOT NULL,
    location_id           INT             NOT NULL,
    title                 VARCHAR(150)    NOT NULL,
    summary               VARCHAR(255)    NOT NULL,
    description           TEXT            NOT NULL,
    start_datetime        DATETIME        NOT NULL,
    end_datetime          DATETIME        NULL,
    registration_deadline DATETIME        NULL,
    ticket_price          DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    goal_amount           DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    raised_amount         DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    capacity              INT             NULL,
    status                ENUM('active','suspended') NOT NULL DEFAULT 'active',
    image_url             VARCHAR(255)    NULL,
    created_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                          ON UPDATE CURRENT_TIMESTAMP,
    -- keys
    CONSTRAINT pk_events PRIMARY KEY (event_id),
    -- relationships
    CONSTRAINT fk_events_organisation FOREIGN KEY (organisation_id)
        REFERENCES organisations (organisation_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_events_category FOREIGN KEY (category_id)
        REFERENCES categories (category_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_events_location FOREIGN KEY (location_id)
        REFERENCES locations (location_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    -- data integrity rules
    CONSTRAINT chk_events_dates CHECK (end_datetime IS NULL
                                       OR end_datetime >= start_datetime),
    CONSTRAINT chk_events_money CHECK (ticket_price >= 0
                                       AND goal_amount >= 0
                                       AND raised_amount >= 0),
    CONSTRAINT chk_events_capacity CHECK (capacity IS NULL OR capacity > 0),
    -- indexes that support the Home / Search / Detail queries
    INDEX idx_events_start (start_datetime),
    INDEX idx_events_category (category_id),
    INDEX idx_events_location (location_id),
    INDEX idx_events_status_start (status, start_datetime)
) ENGINE = InnoDB;


-- ---------------------------------------------------------------------------
-- 3. INITIAL DATA
--    The event dates are calculated from CURDATE(), so importing this script
--    always produces a realistic mix of finished, running and forthcoming
--    events and the past/upcoming rules can be seen working straight away.
-- ---------------------------------------------------------------------------

-- 3.1 Organisations ---------------------------------------------------------
INSERT INTO organisations
    (name, mission, description, email, phone, website, city, logo_url)
VALUES
    ('Sunshine Children''s Foundation',
     'Every child deserves a healthy start in life.',
     'A children''s charity that funds education, health checks and family support programs for disadvantaged communities.',
     'hello@sunshinefoundation.org.au', '02 9000 1001',
     'https://www.sunshinefoundation.org.au', 'Sydney', 'images/orgs/sunshine.png'),

    ('Coastal Care Australia',
     'Protecting our coastline for the next generation.',
     'An environmental charity running beach clean-ups, marine education and coastal habitat restoration projects.',
     'info@coastalcare.org.au', '02 9000 1002',
     'https://www.coastalcare.org.au', 'Newcastle', 'images/orgs/coastalcare.png'),

    ('Mindful Hearts Australia',
     'No one should face a mental health challenge alone.',
     'A mental health charity providing peer support groups, counselling subsidies and community wellbeing workshops.',
     'support@mindfulhearts.org.au', '02 9000 1003',
     'https://www.mindfulhearts.org.au', 'Wollongong', 'images/orgs/mindfulhearts.png'),

    ('Paws & Hearts Rescue',
     'Rescue, rehabilitate, rehome.',
     'An animal welfare charity that rescues abandoned pets, funds veterinary treatment and runs adoption programs.',
     'adopt@pawsandhearts.org.au', '02 9000 1004',
     'https://www.pawsandhearts.org.au', 'Coffs Harbour', 'images/orgs/pawsandhearts.png');


-- 3.2 Categories ------------------------------------------------------------
INSERT INTO categories (name, description)
VALUES
    ('Fun Run',        'Timed or untimed running and walking events.'),
    ('Gala Dinner',    'Formal fundraising dinners with entertainment and auctions.'),
    ('Silent Auction', 'Bidding on donated items over a set period, in person or online.'),
    ('Concert',        'Live music performances that raise funds for a cause.'),
    ('Charity Walk',   'Community walks along a set route to raise awareness and funds.'),
    ('Sports Day',     'Golf days, cricket matches and other sporting fundraisers.'),
    ('Arts & Culture', 'Exhibitions, theatre and creative showcases.'),
    ('Community',      'Trivia nights, fairs and other local community gatherings.'),
    ('Education',      'Readathons, workshops and school-based fundraising.');


-- 3.3 Locations -------------------------------------------------------------
INSERT INTO locations
    (venue_name, address_line, city, state, postcode, latitude, longitude)
VALUES
    ('Centennial Parklands',        'Grand Drive',              'Sydney',           'NSW', '2021', -33.894400, 151.233300),
    ('Hyatt Regency Sydney',        '161 Sussex Street',        'Sydney',           'NSW', '2000', -33.869700, 151.203000),
    ('Museum of Contemporary Art',  '140 George Street',        'Sydney',           'NSW', '2000', -33.860000, 151.209000),
    ('Parramatta Park',             'Pitt Street',              'Parramatta',       'NSW', '2150', -33.813000, 150.997000),
    ('Newcastle Foreshore Park',    'Wharf Road',               'Newcastle',        'NSW', '2300', -32.927000, 151.780000),
    ('Wollongong City Beach',       'Marine Drive',             'Wollongong',       'NSW', '2500', -34.427000, 150.901000),
    ('Coffs Harbour Jetty Foreshore', 'Jordan Esplanade',       'Coffs Harbour',    'NSW', '2450', -30.306000, 153.146000),
    ('Lismore Quadrangle',          '110 Magellan Street',      'Lismore',          'NSW', '2480', -28.813000, 153.278000),
    ('Byron Bay Community Centre',  '69 Jonson Street',         'Byron Bay',        'NSW', '2481', -28.643000, 153.612000),
    ('Port Macquarie Town Green',   'Horton Street',            'Port Macquarie',   'NSW', '2444', -31.430000, 152.908000);


-- 3.4 Events (10 sample events) ---------------------------------------------
INSERT INTO events
    (organisation_id, category_id, location_id, title, summary, description,
     start_datetime, end_datetime, registration_deadline, ticket_price,
     goal_amount, raised_amount, capacity, status, image_url)
VALUES
    -- 1. Upcoming fun run -------------------------------------------------
    (1, 1, 1,
     'City2Park Charity Fun Run',
     'A 5 km and 10 km family fun run through Centennial Parklands raising funds for children''s education.',
     'Join hundreds of runners and walkers for the annual City2Park Charity Fun Run. Both the 5 km and the 10 km courses start and finish at the Grand Drive pavilion. Every registration fee is donated to the Sunshine Children''s Foundation and goes directly towards school supplies, tutoring and health checks for children in disadvantaged communities. Timing chips, medals, water stations, a free breakfast and a kids'' activity zone are included.',
     CURDATE() + INTERVAL 21 DAY + INTERVAL 7 HOUR,
     CURDATE() + INTERVAL 21 DAY + INTERVAL 12 HOUR,
     CURDATE() + INTERVAL 18 DAY + INTERVAL 23 HOUR,
     35.00, 50000.00, 18750.00, 1200, 'active',
     'images/events/city2park-fun-run.jpg'),

    -- 2. Upcoming gala dinner ---------------------------------------------
    (2, 2, 2,
     'Coastal Care Annual Gala Dinner',
     'A black-tie fundraising dinner with a live auction supporting coastal restoration projects.',
     'The Coastal Care Annual Gala Dinner brings together supporters, sponsors and marine scientists for an evening of fine dining and fundraising. The night includes a three-course dinner, live music, guest speakers from the coastal restoration team and a live auction of experiences and artworks. All proceeds fund dune restoration, beach clean-ups and marine education programs along the NSW coast.',
     CURDATE() + INTERVAL 45 DAY + INTERVAL 18 HOUR + INTERVAL 30 MINUTE,
     CURDATE() + INTERVAL 45 DAY + INTERVAL 23 HOUR,
     CURDATE() + INTERVAL 40 DAY + INTERVAL 23 HOUR,
     180.00, 120000.00, 46000.00, 350, 'active',
     'images/events/coastal-care-gala.jpg'),

    -- 3. Upcoming silent auction ------------------------------------------
    (1, 3, 3,
     'Silent Auction for Children''s Education',
     'Bid on artwork, holidays and experiences in a week-long silent auction supporting children''s education.',
     'The Silent Auction for Children''s Education runs for seven days at the Museum of Contemporary Art. More than 120 lots are available, including original artworks, weekend escapes, restaurant vouchers and corporate experiences. Bidding opens online and closes with a family-friendly afternoon event featuring live music and refreshments. Every dollar raised funds scholarships and learning materials.',
     CURDATE() + INTERVAL 10 DAY + INTERVAL 10 HOUR,
     CURDATE() + INTERVAL 17 DAY + INTERVAL 17 HOUR,
     CURDATE() + INTERVAL 9 DAY + INTERVAL 23 HOUR,
     25.00, 40000.00, 31200.00, 500, 'active',
     'images/events/silent-auction.jpg'),

    -- 4. Upcoming concert --------------------------------------------------
    (2, 4, 4,
     'Sounds of the Coast Benefit Concert',
     'A live concert featuring local artists, with all ticket sales donated to coastal conservation.',
     'Sounds of the Coast is an evening of live music at Parramatta Park celebrating and supporting the NSW coastline. The line-up features local bands, a community choir and a headline acoustic set. Food trucks and a licensed bar operate from 5 pm. Every ticket sold contributes to the Coastal Care Australia restoration fund, and attendees can take part in a pledge wall to reduce single-use plastics.',
     CURDATE() + INTERVAL 60 DAY + INTERVAL 17 HOUR,
     CURDATE() + INTERVAL 60 DAY + INTERVAL 22 HOUR + INTERVAL 30 MINUTE,
     CURDATE() + INTERVAL 58 DAY + INTERVAL 23 HOUR,
     75.00, 80000.00, 15400.00, 900, 'active',
     'images/events/sounds-of-the-coast.jpg'),

    -- 5. Upcoming charity walk --------------------------------------------
    (3, 5, 5,
     'Newcastle Sunrise Charity Walk',
     'An 8 km sunrise walk along the Newcastle foreshore promoting mental health awareness.',
     'The Newcastle Sunrise Charity Walk brings the community together for an 8 km coastal walk starting at first light. The route is fully accessible and suitable for families, prams and wheelchairs. Walkers can join a peer-support meet-up at the finish line, where breakfast and wellbeing resources are provided. Funds raised pay for counselling subsidies and peer support group venues.',
     CURDATE() + INTERVAL 7 DAY + INTERVAL 6 HOUR,
     CURDATE() + INTERVAL 7 DAY + INTERVAL 11 HOUR,
     CURDATE() + INTERVAL 5 DAY + INTERVAL 23 HOUR,
     30.00, 30000.00, 22750.00, 800, 'active',
     'images/events/sunrise-walk.jpg'),

    -- 6. Past community event ---------------------------------------------
    (3, 8, 6,
     'Winter Warmth Trivia Night',
     'A community trivia night that raised funds for mental health support groups.',
     'The Winter Warmth Trivia Night was held at Wollongong City Beach with 32 teams competing across eight rounds of questions. The evening included a raffle, a bake sale and a short talk from a peer support volunteer. The event has now finished; the final amount raised exceeded the original goal and has been allocated to four regional support groups.',
     CURDATE() - INTERVAL 30 DAY + INTERVAL 18 HOUR,
     CURDATE() - INTERVAL 30 DAY + INTERVAL 22 HOUR,
     CURDATE() - INTERVAL 32 DAY + INTERVAL 23 HOUR,
     40.00, 15000.00, 16800.00, 200, 'active',
     'images/events/winter-warmth-trivia.jpg'),

    -- 7. Upcoming sports day ----------------------------------------------
    (4, 6, 7,
     'Paws & Hearts Charity Golf Day',
     'An Ambrose-format golf day with all green fees donated to animal rescue and rehabilitation.',
     'The Paws & Hearts Charity Golf Day is played in Ambrose format with teams of four. The day includes 18 holes, a golf cart, a barbecue lunch, nearest-the-pin and longest-drive competitions and a prize presentation. Every green fee funds veterinary treatment and shelter costs for rescued animals, and participants can meet some of the animals available for adoption.',
     CURDATE() + INTERVAL 90 DAY + INTERVAL 11 HOUR,
     CURDATE() + INTERVAL 90 DAY + INTERVAL 18 HOUR,
     CURDATE() + INTERVAL 85 DAY + INTERVAL 23 HOUR,
     150.00, 60000.00, 9000.00, 144, 'active',
     'images/events/charity-golf-day.jpg'),

    -- 8. Suspended event (violates the policy -> hidden from the website) --
    (2, 7, 8,
     'Art for Good Charity Exhibition',
     'An exhibition of donated artworks; suspended pending verification of the fundraising licence.',
     'Art for Good was planned as a two-day exhibition and sale of donated artworks at the Lismore Quadrangle. The event has been suspended by the platform while the organisers provide the documentation required by the fundraising policy. The event is therefore not displayed on the Home or Search pages.',
     CURDATE() + INTERVAL 35 DAY + INTERVAL 10 HOUR,
     CURDATE() + INTERVAL 36 DAY + INTERVAL 20 HOUR,
     CURDATE() + INTERVAL 32 DAY + INTERVAL 23 HOUR,
     20.00, 25000.00, 0.00, 400, 'suspended',
     'images/events/art-for-good.jpg'),

    -- 9. Past community event ---------------------------------------------
    (4, 8, 9,
     'Pet Rescue Adoption Fair',
     'A family adoption fair that found new homes for 47 rescued animals.',
     'The Pet Rescue Adoption Fair at the Byron Bay Community Centre welcomed more than 600 visitors. Forty-seven rescued cats, dogs and rabbits found new homes, and the veterinary team provided free microchipping and health checks on the day. The event has finished and the funds raised now cover desexing and vaccination costs for the next intake of animals.',
     CURDATE() - INTERVAL 14 DAY + INTERVAL 9 HOUR,
     CURDATE() - INTERVAL 14 DAY + INTERVAL 15 HOUR,
     CURDATE() - INTERVAL 15 DAY + INTERVAL 23 HOUR,
     0.00, 10000.00, 12400.00, 600, 'active',
     'images/events/pet-rescue-fair.jpg'),

    -- 10. Upcoming education event ----------------------------------------
    (1, 9, 10,
     'Readathon for Rural Schools',
     'A month-long reading challenge where sponsors pledge an amount per book read.',
     'The Readathon for Rural Schools challenges students and community members to read as many books as possible during a four-week period. Participants collect sponsorship pledges per book, and the funds purchase library books, tablets and literacy resources for rural schools. The campaign closes with an online celebration event featuring authors and a live leaderboard.',
     CURDATE() + INTERVAL 30 DAY + INTERVAL 9 HOUR,
     CURDATE() + INTERVAL 58 DAY + INTERVAL 17 HOUR,
     CURDATE() + INTERVAL 27 DAY + INTERVAL 23 HOUR,
     15.00, 35000.00, 8200.00, 1000, 'active',
     'images/events/readathon.jpg');


-- ---------------------------------------------------------------------------
-- 4. VIEWS
--    The views hold the joins between events, categories, organisations and
--    locations, so the API can return ready-to-display data with a short,
--    readable SELECT statement instead of repeating the joins everywhere.
-- ---------------------------------------------------------------------------

-- 4.1 All events with their organisation, category and location names.
--     event_state is derived from the event dates (past / ongoing / upcoming).
CREATE OR REPLACE VIEW v_event_summary AS
SELECT
    e.event_id,
    e.title,
    e.summary,
    e.description,
    c.category_id,
    c.name                                    AS category_name,
    o.organisation_id,
    o.name                                    AS organisation_name,
    l.location_id,
    l.venue_name,
    l.city,
    l.state,
    l.postcode,
    e.start_datetime,
    e.end_datetime,
    e.registration_deadline,
    e.ticket_price,
    e.goal_amount,
    e.raised_amount,
    CASE
        WHEN e.goal_amount > 0
        THEN ROUND(e.raised_amount / e.goal_amount * 100, 1)
        ELSE 0.0
    END                                       AS progress_percent,
    e.capacity,
    e.status,
    CASE
        WHEN e.end_datetime IS NOT NULL AND e.end_datetime < NOW() THEN 'past'
        WHEN e.start_datetime > NOW()                              THEN 'upcoming'
        ELSE 'ongoing'
    END                                       AS event_state,
    e.image_url
FROM events e
    INNER JOIN categories    c ON c.category_id    = e.category_id
    INNER JOIN organisations o ON o.organisation_id = e.organisation_id
    INNER JOIN locations     l ON l.location_id    = e.location_id;

-- 4.2 A convenience view holding the events the public website shows by
--     default: only active events that have not finished yet. (The API applies
--     the same rule through its "state" parameter, so that it can also return
--     the finished events on request - see docs/api-design.md.)
CREATE OR REPLACE VIEW v_active_events AS
SELECT *
FROM v_event_summary
WHERE status = 'active'
  AND (end_datetime IS NULL OR end_datetime >= NOW());


-- ---------------------------------------------------------------------------
-- 5. SAMPLE QUERIES
--    Read-only checks that can be run after the import: the row counts, the
--    queries the website runs for each page, and a check that suspended events
--    stay hidden.
-- ---------------------------------------------------------------------------

-- 5.1 Row counts -------------------------------------------------------------
SELECT 'organisations' AS table_name, COUNT(*) AS rows_inserted FROM organisations
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'locations',  COUNT(*) FROM locations
UNION ALL SELECT 'events',     COUNT(*) FROM events;

-- 5.2 Home page: all active and upcoming events, soonest first --------------
SELECT event_id, title, category_name, venue_name, city, start_datetime,
       ticket_price, progress_percent, event_state
FROM v_active_events
WHERE event_state = 'upcoming'
ORDER BY start_datetime ASC;

-- 5.3 Search page: filter by category + city + date range -------------------
--     (replace the values with the ones submitted by the user's form)
SELECT event_id, title, category_name, venue_name, city, start_datetime, ticket_price
FROM v_active_events
WHERE category_name = 'Fun Run'
  AND city          = 'Sydney'
  AND start_datetime BETWEEN CURDATE() AND CURDATE() + INTERVAL 60 DAY
ORDER BY start_datetime ASC;

-- 5.4 Search page: the list of categories used to build the filter dropdown --
SELECT category_id, name
FROM categories
ORDER BY name ASC;

-- 5.5 Search page: the distinct list of cities for the location filter ------
SELECT DISTINCT city FROM locations ORDER BY city ASC;

-- 5.6 Event detail page: every detail of one event -------------------------
SELECT *
FROM v_event_summary
WHERE event_id = 1;

-- 5.7 Proof that suspended events are excluded from the public website ------
SELECT event_id, title, status, event_state
FROM v_event_summary
WHERE status = 'suspended';
-- ============================================================================
--  End of script - charityevents_db
-- ============================================================================
