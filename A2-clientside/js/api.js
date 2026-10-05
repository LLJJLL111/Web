/**
 * api.js  -  PROG2002 Web Development II, Assessment 2
 * ---------------------------------------------------------------------------
 * The only place in the client-side code that talks to the RESTful API. Every
 * page calls these functions instead of using fetch() directly, so the base
 * URL, the query-string building and the error handling exist in exactly one
 * place.
 *
 * Each function returns a Promise that resolves with the response body or
 * rejects with an ApiError whose message can be shown to the user.
 * ---------------------------------------------------------------------------
 */

/* eslint-env browser */

const CharityApi = (function () {
    'use strict';

    /**
     * Base URL of the events API.
     * Change this single line if the API runs on another port or host.
     */
    const BASE_URL = 'http://localhost:3060/api';

    /** An error with a code, so the UI can react to specific failures. */
    class ApiError extends Error {
        constructor(code, message) {
            super(message);
            this.name = 'ApiError';
            this.code = code;
        }
    }

    /**
     * Build a full URL from an endpoint path and a plain object of query
     * parameters. Empty, null and undefined values are skipped, so a form with
     * untouched fields produces a short, clean URL.
     *
     * Pure function - it can be unit tested without a browser.
     *
     * @param {string} path    e.g. '/events/search'
     * @param {object} [params] e.g. { city: 'Sydney', category: 1 }
     * @returns {string}       full URL with only the non-empty parameters
     */
    function buildUrl(path, params) {
        const query = new URLSearchParams();

        Object.keys(params || {}).forEach(function (key) {
            const value = params[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                query.append(key, String(value).trim());
            }
        });

        const queryString = query.toString();
        return BASE_URL + path + (queryString ? '?' + queryString : '');
    }

    /**
     * Perform a GET request and return the parsed response body.
     *
     * @param {string} path
     * @param {object} [params]
     * @returns {Promise<object>} the API envelope { success, count, data, ... }
     */
    async function getJSON(path, params) {
        const url = buildUrl(path, params);
        let response;

        try {
            response = await fetch(url, { headers: { Accept: 'application/json' } });
        } catch (networkError) {
            // fetch() only rejects when the request never reached the server,
            // e.g. the API is not running or is blocked by CORS.
            throw new ApiError(
                'NETWORK_ERROR',
                'The events service could not be reached. Please make sure the API is '
                + 'running (node server.js) and then try again.'
            );
        }

        let body = null;
        try {
            body = await response.json();
        } catch (parseError) {
            body = null;
        }

        if (!response.ok) {
            const apiMessage = body && body.error && body.error.message
                ? body.error.message
                : 'The server returned an unexpected error (HTTP ' + response.status + ').';
            const code = body && body.error && body.error.code
                ? body.error.code
                : 'HTTP_' + response.status;
            throw new ApiError(code, apiMessage);
        }

        if (!body || body.success !== true) {
            throw new ApiError('INVALID_RESPONSE', 'The server returned an unexpected response.');
        }

        return body;
    }

    return {
        BASE_URL: BASE_URL,
        ApiError: ApiError,
        buildUrl: buildUrl,

        /**
         * GET /api/events - Home page: current and upcoming events.
         * @param {object} [options] { limit, offset, state }
         *        state: 'upcoming' (default) | 'past' | 'all'
         */
        getEvents: function (options) {
            const params = Object.assign({ limit: 100 }, options || {});
            return getJSON('/events', params);
        },

        /**
         * GET /api/events/search - Search page.
         * @param {object} criteria { from, to, city, category, keyword, state, sort }
         */
        searchEvents: function (criteria) {
            return getJSON('/events/search', criteria);
        },

        /** GET /api/events/{id} - Event detail page. */
        getEventById: function (id) {
            return getJSON('/events/' + encodeURIComponent(id));
        },

        /**
         * GET /api/categories - categories for the search filter.
         * @param {string} [state] the same state the search will use, so the
         *        count shown next to each category matches the results.
         */
        getCategories: function (state) {
            return getJSON('/categories', { state: state });
        },

        /** GET /api/locations - cities for the search filter. */
        getLocations: function (state) {
            return getJSON('/locations', { state: state });
        }
    };
})();
