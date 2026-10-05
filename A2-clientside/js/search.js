/**
 * search.js  -  PROG2002 Web Development II, Assessment 2
 * ---------------------------------------------------------------------------
 * Search page behaviour. The page is a form (date range, location, category,
 * keyword, past/upcoming and sort order) plus a results area, and this file
 * wires the two together:
 *
 *   1. The location and category dropdowns are filled from the API, so the
 *      options always match the data and the counts match the chosen state.
 *   2. On submit, the criteria are validated, the URL is updated so the search
 *      can be shared, and the API is called with fetch.
 *   3. The results, the "N events found" summary and any error message are
 *      built with DOM methods and inserted into the page.
 *   4. "Clear Filters" resets every control and empties the results.
 * ---------------------------------------------------------------------------
 */

/* eslint-env browser */

(function () {
    'use strict';

    // ---------------------------------------------------------------- elements
    const form = document.getElementById('search-form');
    const statusSelect = document.getElementById('status');
    const dateFrom = document.getElementById('date-from');
    const dateTo = document.getElementById('date-to');
    const locationSelect = document.getElementById('location');
    const categorySelect = document.getElementById('category');
    const keywordInput = document.getElementById('keyword');
    const sortSelect = document.getElementById('sort');
    const clearButton = document.getElementById('clear-filters');
    const messageArea = document.getElementById('message-area');
    const resultsSummary = document.getElementById('results-summary');
    const resultsContainer = document.getElementById('results-container');
    const submitButton = form.querySelector('button[type="submit"]');

    // =======================================================================
    // Basic DOM manipulation helpers
    // Every message is built with createElement + textContent instead of
    // innerHTML: what the user typed is therefore always displayed as plain
    // text and can never be executed as HTML.
    // =======================================================================

    /** Remove every message from the message area. */
    function clearMessages() {
        messageArea.textContent = '';
    }

    /**
     * Show one message under the form.
     * @param {string} text
     * @param {'error'|'info'|'ok'|'warning'} variant
     */
    function showMessage(text, variant) {
        clearMessages();

        const paragraph = document.createElement('p');
        paragraph.className = 'status__item status__item--' + (variant || 'info');
        // role="alert" makes screen readers announce validation problems.
        if (variant === 'error') paragraph.setAttribute('role', 'alert');
        paragraph.textContent = text;

        messageArea.appendChild(paragraph);
    }

    /** Clear the previous results and the summary line. */
    function clearResults() {
        resultsContainer.textContent = '';
        resultsSummary.textContent = '';
        resultsSummary.hidden = true;
    }

    /** Add an <option> to a <select> with the DOM. */
    function addOption(select, value, label) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    }

    /** Show a loading placeholder in the results area. */
    function showLoading() {
        resultsContainer.setAttribute('aria-busy', 'true');
        resultsContainer.innerHTML = CharityComponents.loading('Searching for events\u2026');
    }

    /**
     * Keep the address bar in step with the search, so a result list can be
     * bookmarked or shared. Some browsers refuse this on a file:// page, and
     * that is not a reason to fail the search, so the error is ignored.
     */
    function updateAddressBar(queryString) {
        try {
            window.history.replaceState(null, '', 'search.html' + (queryString ? '?' + queryString : ''));
        } catch (error) {
            /* the search itself is unaffected */
        }
    }

    // =======================================================================
    // Filter options: the location and category lists are loaded from the API
    // rather than hard-coded, and both requests run at the same time through
    // Promise.all.
    //
    // The counts follow the "Show" choice, so the number next to a category is
    // always the number of results that category will produce.
    // =======================================================================
    async function loadFilterOptions(state) {
        const keepCategory = categorySelect.value;
        const keepLocation = locationSelect.value;

        try {
            const responses = await Promise.all([
                CharityApi.getCategories(state),
                CharityApi.getLocations(state)
            ]);
            const categories = responses[0].data || [];
            const locations = responses[1].data || [];

            categorySelect.textContent = '';
            addOption(categorySelect, '', 'All categories');
            categories.forEach(function (category) {
                addOption(categorySelect, category.category_id,
                    category.name + ' (' + category.event_count + ')');
            });

            locationSelect.textContent = '';
            addOption(locationSelect, '', 'All locations');
            locations.forEach(function (location) {
                addOption(locationSelect, location.city,
                    location.city + ' (' + location.event_count + ')');
            });

            // Keep whatever the user had already chosen, when it still exists.
            categorySelect.value = keepCategory;
            locationSelect.value = keepLocation;
        } catch (error) {
            showMessage(
                'The filter lists could not be loaded, so only the date and keyword filters '
                + 'are available. ' + error.message,
                'warning'
            );
            console.error('[search.js]', error);
        }
    }

    // =======================================================================
    // Reading and validating the form
    // =======================================================================

    /** Collect the criteria the user selected. Empty values are left out. */
    function readCriteria() {
        const criteria = {};
        if (statusSelect.value) criteria.state = statusSelect.value;
        if (dateFrom.value) criteria.from = dateFrom.value;
        if (dateTo.value) criteria.to = dateTo.value;
        if (locationSelect.value) criteria.city = locationSelect.value;
        if (categorySelect.value) criteria.category = categorySelect.value;
        if (keywordInput.value.trim()) criteria.keyword = keywordInput.value.trim();
        if (sortSelect.value) criteria.sort = sortSelect.value;
        return criteria;
    }

    /**
     * Validate the form before a request is sent, so the user gets an instant
     * answer instead of an empty result list.
     * @returns {string|null} an error message, or null when the form is valid
     */
    function validateCriteria(criteria) {
        if (criteria.from && criteria.to && criteria.from > criteria.to) {
            return 'The "From date" must be on or before the "To date". Please adjust the dates and search again.';
        }
        return null;
    }

    /** A readable description of the filters that are currently applied. */
    function describeCriteria(criteria) {
        const parts = [];

        if (criteria.from && criteria.to) parts.push('dates ' + criteria.from + ' to ' + criteria.to);
        else if (criteria.from) parts.push('dates from ' + criteria.from);
        else if (criteria.to) parts.push('dates up to ' + criteria.to);

        if (criteria.city) parts.push('in ' + criteria.city);
        if (criteria.category) {
            const option = categorySelect.options[categorySelect.selectedIndex];
            parts.push('category ' + (option ? option.textContent.replace(/\s*\(\d+\)$/, '') : criteria.category));
        }
        if (criteria.keyword) parts.push('matching \u201c' + criteria.keyword + '\u201d');

        if (parts.length === 0) {
            if (criteria.state === 'past') return 'finished events';
            if (criteria.state === 'all') return 'all past and upcoming events';
            return 'all upcoming events';
        }

        // Say which slice of events the filters were applied to.
        const scope = criteria.state === 'past' ? 'finished events'
            : criteria.state === 'all' ? 'past and upcoming events'
                : 'upcoming events';
        return parts.join(', ') + ' (' + scope + ')';
    }

    // =======================================================================
    // The search itself
    // =======================================================================
    async function runSearch() {
        const criteria = readCriteria();
        const problem = validateCriteria(criteria);

        if (problem) {
            showMessage(problem, 'error');
            clearResults();
            dateFrom.focus();
            return;
        }

        // Reflect the search in the address bar, so a result list can be
        // bookmarked or shared (and the browser Back button works).
        updateAddressBar(new URLSearchParams(criteria).toString());

        clearMessages();
        showLoading();
        submitButton.disabled = true;
        submitButton.textContent = 'Searching\u2026';

        try {
            const response = await CharityApi.searchEvents(criteria);
            const events = response.data || [];

            resultsContainer.setAttribute('aria-busy', 'false');

            if (events.length === 0) {
                resultsContainer.innerHTML = CharityComponents.empty(
                    'No events match your search',
                    'Try removing one of the filters, choosing a wider date range, or pressing "Clear Filters".'
                );
                showMessage('No events were found for ' + describeCriteria(criteria) + '.', 'info');
                showSummary(0, criteria);
                return;
            }

            resultsContainer.innerHTML = events.map(CharityComponents.eventCard).join('');
            showMessage(
                'Found ' + events.length + ' event' + (events.length === 1 ? '' : 's')
                + ' for ' + describeCriteria(criteria) + '.',
                'ok'
            );
            showSummary(events.length, criteria);
        } catch (error) {
            resultsContainer.setAttribute('aria-busy', 'false');
            resultsContainer.innerHTML = CharityComponents.errorMessage(
                'The search could not be completed',
                error.message,
                'Please check that the API is running, then try again.'
            );
            resultsSummary.textContent = '';
            resultsSummary.hidden = true;
            showMessage(error.message, 'error');
            console.error('[search.js]', error);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Search events';
        }
    }

    /** Print the "N events found" line above the results. */
    function showSummary(count, criteria) {
        resultsSummary.textContent = '';

        const heading = document.createElement('h2');
        heading.className = 'results-summary__title';
        heading.textContent = count === 1 ? '1 event found' : count + ' events found';

        const detail = document.createElement('p');
        detail.className = 'results-summary__detail';
        detail.textContent = 'Filters: ' + describeCriteria(criteria);

        resultsSummary.appendChild(heading);
        resultsSummary.appendChild(detail);
        resultsSummary.hidden = false;
    }

    // =======================================================================
    // "Clear Filters" - resets every field with DOM manipulation
    // =======================================================================
    function clearFilters() {
        // 1. Reset the input elements the form controls natively.
        form.reset();

        // 2. Reset the elements that form.reset() does not cover reliably,
        //    and remove any styling state left behind.
        [dateFrom, dateTo, keywordInput].forEach(function (input) {
            input.value = '';
            input.classList.remove('is-invalid');
        });
        [statusSelect, locationSelect, categorySelect, sortSelect].forEach(function (select) {
            select.selectedIndex = 0;
        });
        statusSelect.value = 'upcoming';
        sortSelect.value = 'soonest';

        // 3. Clear the messages, the summary and the previous results.
        clearMessages();
        clearResults();

        // 4. Reset the address bar and put the cursor back in the first field.
        updateAddressBar('');
        dateFrom.focus();
        showMessage('Filters cleared. Choose your criteria and press "Search events".', 'info');

        // 5. The category and location counts belong to the "upcoming" view.
        loadFilterOptions(statusSelect.value);
    }

    // =======================================================================
    // Pre-fill the form from the URL, so a search can be linked to
    // e.g.  search.html?city=Sydney&category=1  or  search.html?state=past
    // =======================================================================
    function readCriteriaFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const criteria = {};
        ['state', 'from', 'to', 'city', 'category', 'keyword', 'sort'].forEach(function (key) {
            const value = params.get(key);
            if (value) criteria[key] = value;
        });
        return criteria;
    }

    /** Put criteria into the form controls (the options must exist first). */
    function fillForm(criteria) {
        if (criteria.state) statusSelect.value = criteria.state;
        if (criteria.from) dateFrom.value = criteria.from;
        if (criteria.to) dateTo.value = criteria.to;
        if (criteria.city) locationSelect.value = criteria.city;
        if (criteria.category) categorySelect.value = criteria.category;
        if (criteria.keyword) keywordInput.value = criteria.keyword;
        if (criteria.sort) sortSelect.value = criteria.sort;
    }

    // =======================================================================
    // Start-up
    // =======================================================================
    async function init() {
        // The date pickers should not offer dates before today: the lists are
        // about current, upcoming and (on request) finished events.
        const today = new Date();
        const isoToday = today.getFullYear() + '-'
            + String(today.getMonth() + 1).padStart(2, '0') + '-'
            + String(today.getDate()).padStart(2, '0');
        dateFrom.min = isoToday;
        dateTo.min = isoToday;

        form.addEventListener('submit', function (event) {
            event.preventDefault();       // no page reload: the API is called with fetch
            runSearch();
        });

        clearButton.addEventListener('click', clearFilters);

        // Changing "Show" asks for a different slice of events, so the filter
        // counts are refreshed and the search is repeated straight away.
        statusSelect.addEventListener('change', async function () {
            await loadFilterOptions(statusSelect.value);
            runSearch();
        });

        const criteriaFromUrl = readCriteriaFromUrl();

        // Load the dropdown contents first, then apply the URL criteria: a
        // value can only be selected once its <option> exists.
        if (criteriaFromUrl.state) statusSelect.value = criteriaFromUrl.state;
        await loadFilterOptions(statusSelect.value);
        fillForm(criteriaFromUrl);

        // A link such as search.html?city=Sydney runs that search immediately.
        if (Object.keys(criteriaFromUrl).length > 0) {
            runSearch();
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
