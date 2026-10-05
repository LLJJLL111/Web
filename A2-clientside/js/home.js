/**
 * home.js  -  PROG2002 Web Development II, Assessment 2
 * ---------------------------------------------------------------------------
 * Home page behaviour. It fills two lists from the API:
 *
 *   #events-container  - the current and upcoming events (state=upcoming)
 *   #finished-container - the events that have already taken place (state=past)
 *
 * The static organisation information (welcome message, mission statement and
 * contact details) is written directly in index.html, so nothing here has to
 * fetch it.
 * ---------------------------------------------------------------------------
 */

/* eslint-env browser */

(function () {
    'use strict';

    const eventsContainer = document.getElementById('events-container');
    const statusMessage = document.getElementById('status-message');
    const finishedSection = document.getElementById('finished');
    const finishedContainer = document.getElementById('finished-container');

    /**
     * How many events each list asks for. The upcoming list asks for the
     * maximum the API accepts in one request (100) so that it really is the
     * whole list; the finished list is a short taster that links to the search
     * page for the rest.
     */
    const HOME_PAGE_LIMIT = 100;
    const FINISHED_LIMIT = 3;

    /**
     * Write a short message under the section heading.
     * Uses textContent, so the text can never be interpreted as markup.
     */
    function setStatus(text, variant) {
        statusMessage.textContent = '';
        if (!text) return;

        const paragraph = document.createElement('p');
        paragraph.className = 'status__item' + (variant ? ' status__item--' + variant : '');
        paragraph.textContent = text;
        statusMessage.appendChild(paragraph);
    }

    /**
     * Load the upcoming events and render them as cards.
     * async/await keeps the three possible outcomes - loading, success and
     * failure - in one readable function.
     */
    async function loadUpcomingEvents() {
        eventsContainer.setAttribute('aria-busy', 'true');
        eventsContainer.innerHTML = CharityComponents.loading('Loading upcoming charity events\u2026');

        try {
            const response = await CharityApi.getEvents({ state: 'upcoming', limit: HOME_PAGE_LIMIT });
            const events = response.data || [];

            if (events.length === 0) {
                eventsContainer.innerHTML = CharityComponents.empty(
                    'There are no events scheduled at the moment',
                    'Please check back soon, or search the full list of events.'
                );
                setStatus('');
                return;
            }

            // Each event becomes one card. Rendering happens in one assignment,
            // which avoids touching the DOM once per event.
            eventsContainer.innerHTML = events.map(CharityComponents.eventCard).join('');

            setStatus(
                'Showing ' + events.length + ' upcoming event' + (events.length === 1 ? '' : 's')
                + ', soonest first.',
                'ok'
            );
        } catch (error) {
            // CharityApi already turned the failure into a readable message.
            eventsContainer.innerHTML = CharityComponents.errorMessage(
                'We could not load the events',
                error.message,
                'The event data comes from the RESTful API of this project.'
            );
            setStatus('');
            console.error('[home.js]', error);
        } finally {
            eventsContainer.setAttribute('aria-busy', 'false');
        }
    }

    /**
     * Load the events that have already finished (state=past) and show them in
     * their own section, each one labelled "Finished".
     *
     * This is the same endpoint with a different state, so the only difference
     * between the two lists is which slice of the data is requested and how the
     * client labels it.
     *
     * A failure here must not break the main list, so it is caught separately
     * and the section simply stays hidden.
     */
    async function loadFinishedEvents() {
        // The section is optional: if it is not in the HTML, nothing happens.
        if (!finishedSection || !finishedContainer) return;

        try {
            const response = await CharityApi.getEvents({ state: 'past', limit: FINISHED_LIMIT });
            const events = response.data || [];

            if (events.length === 0) {
                finishedSection.hidden = true;
                return;
            }

            finishedContainer.innerHTML = events.map(CharityComponents.eventCard).join('');
            finishedSection.hidden = false;
        } catch (error) {
            finishedSection.hidden = true;
            console.error('[home.js] finished events', error);
        } finally {
            finishedContainer.setAttribute('aria-busy', 'false');
        }
    }

    async function init() {
        await loadUpcomingEvents();
        await loadFinishedEvents();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
