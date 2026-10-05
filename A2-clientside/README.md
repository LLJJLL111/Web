# PROG2002 Assessment 2 — Client-side website (Part 3)

The front end of the *Charity Events* case study: a three-page dynamic website
built with HTML, CSS and JavaScript (DOM + Fetch/Promises) that displays the
data served by the RESTful API in the `A2-api` folder.

---

## 1. Files

| File | Purpose |
|---|---|
| `index.html` | **Home page** — hard-coded organisation information plus the dynamic list of upcoming events. |
| `search.html` | **Search page** — the filtering form (date, location, category, keyword) and the results. |
| `event.html` | **Event detail page** — one event, selected with `event.html?id=N`, and the Register dialog. |
| `css/style.css` | One stylesheet for all three pages (design tokens, layout, components, responsive and reduced-motion rules). |
| `js/format.js` | Pure helpers: escaping, date/money formatting, progress and countdown calculations. |
| `js/components.js` | Builds the repeated markup: event cards, the detail view, loading/empty/error blocks. |
| `js/api.js` | The only place that talks to the API: `fetch` + `async/await`, URL building and error mapping. |
| `js/home.js` | Home page behaviour. |
| `js/search.js` | Search page behaviour (validation, DOM messages, Clear Filters, results). |
| `js/event.js` | Detail page behaviour (id from the query string, rendering, Register modal). |
| `images/events/*.jpg` | Event images, named exactly as the `image_url` values in the database. |
| `docs/web-ux.md` | UX decisions and the wireframes, written for the *Web UX* section of the report. |
| `docs/wireframes.png` | Wireframes of the three pages. |

---

## 2. Running the website

The website needs the API from Part 2 to be running.

**Step 1 — start the API** (in the `A2-api` folder):

```bash
node server.js          # http://localhost:3060
```

**Step 2 — serve the website.** Open `index.html` with a local web server.
Any of these work:

* **VS Code Live Server** (recommended): right-click `index.html` →
  *Open with Live Server* — it opens `http://127.0.0.1:5500/index.html`.
* **Node**: `npx serve .`
* **Python**: `python -m http.server 5500`

Then open <http://127.0.0.1:5500/index.html>.

The API allows cross-origin requests (`Access-Control-Allow-Origin: *` and an
`OPTIONS` handler), so the pages can be served from any port.

> Opening the files directly from the file system (`file://`) also works in most
> browsers, but a local server is closer to the real deployment and avoids
> browser-specific restrictions.

**Nothing to configure:** the API address is the single constant
`BASE_URL` at the top of `js/api.js`. Change it there if the API runs on a
different port.

---

## 3. How each page meets the assessment brief

### Home page (`index.html` + `js/home.js`)

| Brief requirement | Where it is implemented |
|---|---|
| Static content: welcoming message, inspiring mission statement, contact details (may be hard-coded) | The hero and the **About us** section of `index.html` are written directly in the HTML. |
| Dynamic event listing — *"Must use API"* | `home.js` calls `GET /api/events` and renders one card per event. Nothing is hard-coded. |
| Data viewing: the important data points for a summary view | Each card shows the image, category badge, ticket price, countdown, title, summary, date and time, venue and city, the hosting organisation and the fundraising progress bar. |
| Clearly link to the detailed page for each event | The image, the title and the "View event details" button all link to `event.html?id=N`. |
| *"The website can mark events as 'past' or 'upcoming' based on the event dates and the current date"* | The upcoming list is loaded with `state=upcoming`. A second section, **Recently finished**, loads `state=past` and every card in it carries a **Finished** badge and is greyed out; the countdown line says "Finished 12 days ago". Both labels are derived from the event dates, never stored. |
| *"The website can also suspend events that violate the policy and will not be shown on this page"* | Suspended events are filtered out by the API, so they can never appear on any list (and `event.html?id=8` shows "Event not found"). |

### Navigation (all three pages)

The same header menu — **Home · Search events · About us** — appears on
`index.html`, `search.html` and `event.html`, and the current page is marked
with `aria-current="page"`. A skip link, a footer menu and a breadcrumb on the
detail page are provided as well.

### Search page (`search.html` + `js/search.js`)

| Brief requirement | Where it is implemented |
|---|---|
| Intuitive filtering form with three criteria (date, location, category) | `<input type="date">` for the date range and `<select>` dropdowns for location and category — the control that suits each data type. A keyword field, a sort dropdown and a **Show** (past / upcoming) selector are added on top. |
| Allow one or several criteria | All fields are optional; empty fields are not sent to the API at all (`api.js` skips blank values), so any combination works. |
| A **"Clear Filters"** button that resets all fields, demonstrating DOM manipulation | `clearFilters()` in `search.js` uses `form.reset()` and then resets each element, clears the message and result containers, rewrites the address bar, returns the focus and refreshes the filter counts. |
| On submission, call the Part 2 API endpoint | `form` submit → `searchEvents()` → `GET /api/events/search?…`. |
| Display the resulting list clearly; each with a link to the detail page | The same event cards as the Home page; each links to `event.html?id=N`. Finished events in the results are marked with a **Finished** badge. |
| Display error messages using basic DOM manipulation | `showMessage()` creates a `<p>` with `document.createElement` and sets `textContent`, so what the user typed is displayed as text and never as markup. |

The location and category dropdowns are filled from `GET /api/locations` and
`GET /api/categories`, requested together with `Promise.all`. Their counts
follow the **Show** selector, so the number beside a category is always the
number of results that category will produce.

### Event detail page (`event.html` + `js/event.js`)

| Brief requirement | Where it is implemented |
|---|---|
| Show only the selected event; pass the id between pages | The id travels in the **URL query string** (`event.html?id=3`), is read with `URLSearchParams`, validated, and used to call `GET /api/events/{id}`. |
| Professional and engaging layout with all the details | Two-column header, the full description, an "Event information" panel (when, register by, where, tickets, places) and a fundraising progress section. A finished event carries a **Finished** badge here too. |
| Register button showing *"This feature is currently under construction."* | `id="register-button"` opens the modal in `event.html`, which contains exactly that sentence. Escape, the Close button and the backdrop all close it, and focus returns to the button. |

### Technology

Node.js, HTML, JavaScript, DOM and Promises (`async`/`await` and `Promise.all`)
are used, with no AngularJS and no CSS or JS framework, as the brief requires.

---

## 4. Error handling and other robustness details

* **API not running** → every page shows a friendly message explaining that the
  events service could not be reached, instead of an empty page.
* **Unknown event id** → the detail page shows "Event not found" with a link
  back to the search page.
* **Invalid dates** (`From date` after `To date`) → an inline error message,
  and the request is never sent.
* **No results** → an empty state with advice to relax the filters.
* **Missing image** → an `onerror` handler swaps in `images/events/placeholder.jpg`.
* **Escaping** → all data from the API is escaped before it is inserted as
  markup, and user input is always written with `textContent`.
* **Accessibility** → semantic landmarks, labelled form controls, `aria-live`
  regions for messages, `aria-busy` while loading, visible focus styles, a skip
  link and `prefers-reduced-motion` support.
