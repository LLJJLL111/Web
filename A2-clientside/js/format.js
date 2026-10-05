/**
 * format.js  -  PROG2002 Web Development II, Assessment 2
 * ---------------------------------------------------------------------------
 * Formatting helpers that turn the raw values returned by the API into text
 * for the page: escaping, dates, money, ticket prices and the fundraising
 * progress.
 *
 * Nothing in this file touches the DOM, so every function is a pure function
 * of its arguments and can be unit tested on its own.
 * ---------------------------------------------------------------------------
 */

/* eslint-env browser */

const CharityFormat = (function () {
    'use strict';

    /**
     * Escape text before it is placed inside an HTML string.
     * Event titles and descriptions come from the database, but escaping them
     * is still correct practice: it guarantees that data can never be
     * interpreted as markup.
     */
    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Parse 'YYYY-MM-DD HH:MM:SS' (the format the API returns) into a Date.
     * The string is parsed manually so that older browsers do not misread it.
     * @returns {Date|null}
     */
    function parseDateTime(value) {
        if (!value) return null;
        const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
            .exec(String(value));
        if (!match) return null;
        return new Date(
            Number(match[1]), Number(match[2]) - 1, Number(match[3]),
            Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0)
        );
    }

    /** 'Sat 24 Nov 2026, 7:00 am' */
    function formatDateTime(value) {
        const date = parseDateTime(value);
        if (!date) return 'Date to be confirmed';
        return date.toLocaleString('en-AU', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    }

    /** 'Sat 24 Nov 2026' */
    function formatDate(value) {
        const date = parseDateTime(value);
        if (!date) return 'Date to be confirmed';
        return date.toLocaleDateString('en-AU', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    /** '24 Nov 2026, 7:00 am – 12:00 pm' when the event ends on the same day. */
    function formatDateRange(startValue, endValue) {
        const start = parseDateTime(startValue);
        const end = parseDateTime(endValue);
        if (!start) return 'Date to be confirmed';
        if (!end) return formatDateTime(startValue);

        const sameDay = start.toDateString() === end.toDateString();
        const startText = formatDateTime(startValue);

        if (sameDay) {
            const endTime = end.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
            return startText + ' \u2013 ' + endTime;
        }
        return startText + ' \u2013 ' + formatDateTime(endValue);
    }

    /** '$35' / '$180.50' - thousands separators, no cents when they are .00 */
    function formatMoney(amount) {
        const number = Number(amount);
        if (!isFinite(number)) return '';
        return '$' + number.toLocaleString('en-AU', {
            minimumFractionDigits: number % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2
        });
    }

    /** 0 -> 'Free' ; 35 -> '$35' */
    function formatTicketPrice(amount) {
        const number = Number(amount);
        if (!isFinite(number) || number <= 0) return 'Free';
        return formatMoney(number);
    }

    /** 0 -> 'Event finished' ; otherwise 'upcoming' / 'ongoing' in words. */
    function formatEventState(state) {
        if (state === 'upcoming') return 'Upcoming';
        if (state === 'ongoing') return 'Happening now';
        if (state === 'past') return 'Finished';
        return 'Scheduled';
    }

    /**
     * Clamp a percentage to 0-100 so a progress bar can never overflow, and
     * round it to one decimal place.
     */
    function clampPercent(value) {
        const number = Number(value);
        if (!isFinite(number) || number < 0) return 0;
        return Math.min(100, Math.round(number * 10) / 10);
    }

    /**
     * How far along the fundraising is.
     * The progress comes from the API; the division here is only a fallback.
     */
    function progressPercent(event) {
        if (event && event.progress_percent !== undefined && event.progress_percent !== null) {
            return clampPercent(event.progress_percent);
        }
        const goal = Number(event && event.goal_amount);
        const raised = Number(event && event.raised_amount);
        if (!goal) return 0;
        return clampPercent((raised / goal) * 100);
    }

    /** '45 days to go' / 'Today' / 'Finished 12 days ago' */
    function countdown(startValue, endValue) {
        const start = parseDateTime(startValue);
        const end = parseDateTime(endValue);
        const now = new Date();
        if (!start) return '';

        const dayMs = 24 * 60 * 60 * 1000;
        const daysToStart = Math.round((startOfDay(start) - startOfDay(now)) / dayMs);

        if (end && end < now) {
            const daysAgo = Math.abs(Math.round((startOfDay(end) - startOfDay(now)) / dayMs));
            return daysAgo === 0 ? 'Finished today' : 'Finished ' + daysAgo + ' day' + (daysAgo === 1 ? '' : 's') + ' ago';
        }
        if (daysToStart < 0) return 'Happening now';
        if (daysToStart === 0) return 'Today';
        if (daysToStart === 1) return 'Tomorrow';
        return daysToStart + ' days to go';
    }

    /** Local midnight of a date, used for whole-day comparisons. */
    function startOfDay(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    return {
        escapeHtml: escapeHtml,
        parseDateTime: parseDateTime,
        formatDate: formatDate,
        formatDateTime: formatDateTime,
        formatDateRange: formatDateRange,
        formatMoney: formatMoney,
        formatTicketPrice: formatTicketPrice,
        formatEventState: formatEventState,
        clampPercent: clampPercent,
        progressPercent: progressPercent,
        countdown: countdown
    };
})();
