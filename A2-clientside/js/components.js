/**
 * components.js  -  PROG2002 Web Development II, Assessment 2
 * ---------------------------------------------------------------------------
 * Builds the HTML for the pieces of the interface that appear more than once:
 * the event card, the event detail view, the fundraising progress bar and the
 * loading, empty and error states.
 *
 * Every function returns an HTML string and touches no DOM element. That keeps
 * the pages small and readable, and lets the markup be reviewed or tested
 * without a browser.
 *
 * Depends on format.js (CharityFormat).
 * ---------------------------------------------------------------------------
 */

/* eslint-env browser */

const CharityComponents = (function () {
    'use strict';

    const F = CharityFormat;

    /** Used when an event image is missing from the file system. */
    const FALLBACK_IMAGE = 'images/events/placeholder.jpg';

    /** Link that carries the event id to the detail page (URL query string). */
    function detailUrl(eventId) {
        return 'event.html?id=' + encodeURIComponent(eventId);
    }

    /** The fundraising progress bar used on cards and on the detail page. */
    function progressBar(event) {
        const percent = F.progressPercent(event);
        const raised = F.formatMoney(event.raised_amount);
        const goal = F.formatMoney(event.goal_amount);

        return ''
            + '<div class="progress" role="img" aria-label="'
            +      F.escapeHtml(percent + ' per cent of the ' + goal + ' goal has been raised')
            +   '">'
            +   '<div class="progress__bar" style="width: ' + percent + '%"></div>'
            + '</div>'
            + '<p class="progress__label">'
            +   '<strong>' + F.escapeHtml(raised) + '</strong> raised of '
            +   F.escapeHtml(goal) + ' goal '
            +   '<span class="progress__percent">(' + percent + '%)</span>'
            + '</p>';
    }

    /**
     * The state badge that marks an event as "past" or "happening now" from its
     * dates. It is only drawn when the event is not simply upcoming, so a list
     * of forthcoming events stays clean while a finished event is
     * unmistakably labelled.
     */
    function stateBadge(event) {
        const state = event.event_state;
        if (!state || state === 'upcoming') return '';
        const modifier = state === 'past' ? ' badge--past' : ' badge--now';
        return '<span class="badge badge--state' + modifier + '">'
            + F.escapeHtml(F.formatEventState(state)) + '</span>';
    }

    /**
     * One event in a summary (card) view: image, name, category, location,
     * date, ticket price and fundraising progress, with a link to the detail
     * page.
     *
     * @param {object} event  a row from GET /api/events
     * @returns {string} HTML
     */
    function eventCard(event) {
        const title = F.escapeHtml(event.title);
        const url = detailUrl(event.event_id);
        const image = event.image_url ? F.escapeHtml(event.image_url) : FALLBACK_IMAGE;
        const price = F.formatTicketPrice(event.ticket_price);

        return ''
        + '<article class="event-card' + (event.event_state === 'past' ? ' event-card--past' : '') + '">'
        +   '<a class="event-card__media" href="' + url + '" tabindex="-1" aria-hidden="true">'
        +     '<img src="' + image + '" alt="" loading="lazy"'
        +          ' onerror="this.onerror=null;this.src=\'' + FALLBACK_IMAGE + '\';">'
        +     '<span class="badge badge--category">' + F.escapeHtml(event.category_name) + '</span>'
        +     '<span class="badge badge--price">' + F.escapeHtml(price) + '</span>'
        +     stateBadge(event)
        +   '</a>'
        +   '<div class="event-card__body">'
        +     '<p class="event-card__countdown">' + F.escapeHtml(F.countdown(event.start_datetime, event.end_datetime)) + '</p>'
        +     '<h3 class="event-card__title"><a href="' + url + '">' + title + '</a></h3>'
        +     '<p class="event-card__summary">' + F.escapeHtml(event.summary) + '</p>'
        +     '<ul class="meta">'
        +       '<li><span class="meta__label">When</span> '
        +           F.escapeHtml(F.formatDateRange(event.start_datetime, event.end_datetime)) + '</li>'
        +       '<li><span class="meta__label">Where</span> '
        +           F.escapeHtml(event.venue_name) + ', ' + F.escapeHtml(event.city) + '</li>'
        +       '<li><span class="meta__label">Hosted by</span> '
        +           F.escapeHtml(event.organisation_name) + '</li>'
        +     '</ul>'
        +     progressBar(event)
        +     '<a class="btn btn--primary btn--block" href="' + url + '">View event details</a>'
        +   '</div>'
        + '</article>';
    }

    /**
     * The complete event detail view used by event.html.
     * @param {object} event a row from GET /api/events/{id}
     * @returns {string} HTML
     */
    function eventDetail(event) {
        const title = F.escapeHtml(event.title);
        const image = event.image_url ? F.escapeHtml(event.image_url) : FALLBACK_IMAGE;
        const paragraphs = String(event.description || '')
            .split(/\n{2,}|\r?\n/)
            .map(function (text) { return text.trim(); })
            .filter(Boolean)
            .map(function (text) { return '<p>' + F.escapeHtml(text) + '</p>'; })
            .join('');

        return ''
        + '<article class="detail">'
        +   '<nav class="breadcrumb" aria-label="Breadcrumb">'
        +     '<a href="index.html">Home</a> <span aria-hidden="true">/</span> '
        +     '<a href="search.html">Search events</a> <span aria-hidden="true">/</span> '
        +     '<span>' + title + '</span>'
        +   '</nav>'

        +   '<header class="detail__header">'
        +     '<div class="detail__headings">'
        +       '<span class="badge badge--category">' + F.escapeHtml(event.category_name) + '</span>'
        +       '<span class="badge badge--state">' + F.escapeHtml(F.formatEventState(event.event_state)) + '</span>'
        +       '<h1>' + title + '</h1>'
        +       '<p class="detail__organisation">Hosted by ' + F.escapeHtml(event.organisation_name) + '</p>'
        +       '<p class="detail__summary">' + F.escapeHtml(event.summary) + '</p>'
        +     '</div>'
        +     '<img class="detail__image" src="' + image + '"'
        +          ' alt="' + title + '"'
        +          ' onerror="this.onerror=null;this.src=\'' + FALLBACK_IMAGE + '\';">'
        +   '</header>'

        +   '<div class="detail__grid">'
        +     '<section class="panel" aria-labelledby="detail-about">'
        +       '<h2 id="detail-about">About this event</h2>'
        +       paragraphs
        +     '</section>'

        +     '<aside class="panel panel--facts" aria-labelledby="detail-facts">'
        +       '<h2 id="detail-facts">Event information</h2>'
        +       '<dl class="facts">'
        +         '<dt>When</dt><dd>' + F.escapeHtml(F.formatDateRange(event.start_datetime, event.end_datetime)) + '</dd>'
        +         '<dt>Register by</dt><dd>' + F.escapeHtml(F.formatDate(event.registration_deadline)) + '</dd>'
        +         '<dt>Where</dt><dd>' + F.escapeHtml(event.venue_name) + '<br>'
        +             F.escapeHtml([event.city, event.state, event.postcode].filter(Boolean).join(' ')) + '</dd>'
        +         '<dt>Tickets</dt><dd>' + F.escapeHtml(F.formatTicketPrice(event.ticket_price)) + '</dd>'
        +         '<dt>Places</dt><dd>' + (event.capacity ? F.escapeHtml(event.capacity) + ' people' : 'Not limited') + '</dd>'
        +       '</dl>'
        +       '<button type="button" class="btn btn--primary btn--block" id="register-button">Register</button>'
        +       '<p class="panel__note">Registration opens soon.</p>'
        +     '</aside>'
        +   '</div>'

        +   '<section class="panel panel--progress" aria-labelledby="detail-progress">'
        +     '<h2 id="detail-progress">Fundraising progress</h2>'
        +     '<p class="panel__lead">Every ticket and donation goes directly to '
        +       F.escapeHtml(event.organisation_name) + '.</p>'
        +     progressBar(event)
        +   '</section>'

        +   '<p class="detail__back"><a class="btn btn--ghost" href="search.html">'
        +     '&larr; Back to search</a></p>'
        + '</article>';
    }

    /** Placeholder shown while a request is in flight. */
    function loading(message) {
        return ''
        + '<div class="state state--loading" role="status">'
        +   '<span class="spinner" aria-hidden="true"></span>'
        +   '<p>' + F.escapeHtml(message || 'Loading events\u2026') + '</p>'
        + '</div>';
    }

    /** Shown when a request succeeded but returned no rows. */
    function empty(title, message) {
        return ''
        + '<div class="state state--empty" role="status">'
        +   '<h2>' + F.escapeHtml(title || 'No events found') + '</h2>'
        +   '<p>' + F.escapeHtml(message || 'Try changing or clearing the filters.') + '</p>'
        + '</div>';
    }

    /**
     * Shown when something went wrong. Built with DOM methods by the pages so
     * the message never becomes markup - this string version is for the pages
     * that inject whole blocks at once.
     */
    function errorMessage(title, message, hint) {
        return ''
        + '<div class="state state--error" role="alert">'
        +   '<h2>' + F.escapeHtml(title || 'Something went wrong') + '</h2>'
        +   '<p>' + F.escapeHtml(message || '') + '</p>'
        +   (hint ? '<p class="state__hint">' + F.escapeHtml(hint) + '</p>' : '')
        + '</div>';
    }

    return {
        FALLBACK_IMAGE: FALLBACK_IMAGE,
        detailUrl: detailUrl,
        progressBar: progressBar,
        eventCard: eventCard,
        eventDetail: eventDetail,
        loading: loading,
        empty: empty,
        errorMessage: errorMessage
    };
})();
