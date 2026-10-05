/**
 * event.js  -  PROG2002 Web Development II, Assessment 2
 * ---------------------------------------------------------------------------
 * Event detail page behaviour.
 *
 *   1. The event id is read from the URL query string (event.html?id=3) and
 *      validated, so a detail page can be reloaded, bookmarked or shared.
 *   2. That id is fetched from the API and the event is rendered with
 *      CharityComponents.eventDetail().
 *   3. The Register button opens the dialog in event.html, and Escape, the
 *      Close button or a click on the backdrop close it again.
 *
 * If the id is missing, invalid, or belongs to an event that no longer exists,
 * the page shows an explanation with a link back to the search page instead of
 * an empty screen.
 * ---------------------------------------------------------------------------
 */

/* eslint-env browser */

(function () {
    'use strict';

    const container = document.getElementById('event-container');
    const modal = document.getElementById('register-modal');
    const modalCloseButton = document.getElementById('register-modal-close');
    const modalBackdrop = modal.querySelector('[data-close-modal]');

    /** The element that had focus before the dialog opened, so it can return. */
    let elementBeforeModal = null;

    // =======================================================================
    // Register dialog
    // =======================================================================

    function openModal() {
        elementBeforeModal = document.activeElement;
        modal.hidden = false;
        document.body.classList.add('is-modal-open');
        modalCloseButton.focus();       // move the keyboard focus into the dialog
    }

    function closeModal() {
        modal.hidden = true;
        document.body.classList.remove('is-modal-open');
        if (elementBeforeModal) elementBeforeModal.focus();
    }

    function wireRegisterButton() {
        const registerButton = document.getElementById('register-button');
        if (!registerButton) return;

        registerButton.addEventListener('click', openModal);

        // The dialog is created in event.html; these listeners only exist once per page.
        modalCloseButton.addEventListener('click', closeModal);
        modalBackdrop.addEventListener('click', closeModal);

        // Escape closes the dialog - expected behaviour for a modal window.
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !modal.hidden) closeModal();
        });
    }

    // =======================================================================
    // Reading the id from the URL query string
    // =======================================================================

    /** @returns {string|null} the id, or null when it is missing or invalid */
    function readEventId() {
        const rawId = new URLSearchParams(window.location.search).get('id');
        if (!rawId || !/^\d+$/.test(rawId) || Number(rawId) <= 0) return null;
        return rawId;
    }

    function showError(title, message, hint) {
        container.setAttribute('aria-busy', 'false');
        container.innerHTML = CharityComponents.errorMessage(title, message, hint);
    }

    // =======================================================================
    // Load and render the event
    // =======================================================================
    async function loadEvent() {
        const eventId = readEventId();

        if (!eventId) {
            showError(
                'No event was selected',
                'This page needs to know which event to display, for example event.html?id=3.',
                'Choose an event from the Home page or the Search page to see its details.'
            );
            return;
        }

        container.setAttribute('aria-busy', 'true');
        container.innerHTML = CharityComponents.loading('Loading event details\u2026');

        try {
            const response = await CharityApi.getEventById(eventId);
            const event = (response.data || [])[0];

            if (!event) {
                showError(
                    'Event not found',
                    'The event you asked for (id ' + eventId + ') does not exist or is no longer listed.',
                    'It may have been suspended or removed. Please search for another event.'
                );
                return;
            }

            document.title = event.title + ' | Charity Events';
            container.setAttribute('aria-busy', 'false');
            container.innerHTML = CharityComponents.eventDetail(event);

            wireRegisterButton();
        } catch (error) {
            if (error.code === 'NOT_FOUND') {
                showError(
                    'Event not found',
                    'The event you asked for (id ' + eventId + ') could not be found.',
                    'Please choose a different event from the Search page.'
                );
            } else {
                showError(
                    'We could not load this event',
                    error.message,
                    'Please check that the API is running, then reload the page.'
                );
            }
            console.error('[event.js]', error);
        }
    }

    document.addEventListener('DOMContentLoaded', loadEvent);
})();
