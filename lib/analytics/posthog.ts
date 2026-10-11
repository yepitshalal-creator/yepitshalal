import posthog from 'posthog-js';
import {
  maskRecordedAttribute,
  maskRecordedText,
  maskRecordedUrl,
  scrubEvent,
  UNRECORDED_CLASS,
} from './scrub';

// PostHog's project token only lets a browser send events in, and it ships in
// the page source by design, which is why it is a NEXT_PUBLIC_ variable rather
// than a secret. It is set in Vercel for production only, so local dev servers
// and previews never start PostHog, and track() does nothing there.
const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

// Straight to PostHog's EU servers, not through a rewrite on this domain. A
// proxy on yepitshalal.com would carry the Supabase sign-in cookie to PostHog
// with every request, because the browser attaches it to anything on this
// site, and counting visitors without cookies needs the visitor's own IP
// address, which a direct request gives PostHog without a forwarded header.
// The cost is that some ad blockers stop it, which is their user's choice.
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

let started = false;

function start() {
  if (started || !TOKEN || typeof window === 'undefined') return;
  try {
    posthog.init(TOKEN, {
      api_host: HOST,
      defaults: '2026-08-30',
      // No cookies and no local or session storage, unless a visitor says yes
      // to being recorded (components/RecordingConsent.tsx). Until then, and
      // for anyone who says no, PostHog tells one visit from another with a
      // hash of IP address and browser that it salts afresh each day, so
      // nobody can be followed from one day to the next. That only works
      // while "Cookieless server hash mode" is on in the PostHog project's
      // Web analytics settings: with it off, PostHog drops these events.
      //
      // PostHog will not record in its always-cookieless mode, so this is
      // on_reject. On its own, on_reject counts nothing at all from a visitor
      // who has not answered yet; opt_out_capturing_by_default makes "not
      // answered" count the same way as "no", so the question never costs a
      // page view, a speed reading or an error report.
      cookieless_mode: 'on_reject',
      opt_out_capturing_by_default: true,
      // Do Not Track and Global Privacy Control count as no, and the question
      // is not asked.
      respect_dnt: true,
      // After a yes, PostHog keeps its IDs in the tab's session storage, so a
      // recording covers one visit and the IDs go when the tab closes. The
      // answer itself is kept in local storage, so nobody is asked twice.
      persistence: 'sessionStorage',
      // Nobody is ever identified, so no profile is built around a person,
      // and identify() is a no-op if anything calls it.
      person_profiles: 'never',
      disable_surveys: true,
      // What a recording may show is set in scrub.ts. Recordings reach
      // before_send already compressed, so these functions, which run as the
      // page is recorded, are the only place they can be filtered.
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '*',
        maskTextFn: maskRecordedText,
        maskAttributeFn: maskRecordedAttribute,
        maskCapturedNetworkRequestFn: maskRecordedUrl,
        // Alongside BLOCK_CLASS, which the recorder already knows.
        blockSelector: `.${UNRECORDED_CLASS}`,
        recordHeaders: false,
        recordBody: false,
      },
      enable_recording_console_log: false,
      // A map pin's style says where on the screen it sits, and the map is
      // drawn around the place someone searched from, so a few tapped pins
      // would give that place away. Every other attribute is kept.
      autocapture: { element_attribute_ignorelist: ['style'] },
      // The privacy page says PostHog learns which pages and buttons get used,
      // where people tap and how far they scroll (heatmaps), how fast pages
      // load, and when a page breaks. Page speed is web vitals: four timings
      // per page view, plus which part of the page was slow. Network timing
      // would add every file a page fetched to the recordings, and stays off.
      // Setting these here wins over the project's own switches, so the
      // PostHog dashboard cannot quietly widen what is collected.
      capture_heatmaps: true,
      capture_performance: { web_vitals: true, network_timing: false },
      capture_exceptions: true,
      before_send: scrubEvent,
    });
    started = true;
  } catch {
    // Analytics must never be the reason a page fails to load.
  }
}

// Started as this module loads in the browser, not in an effect. React runs a
// page's effects before the root layout's, so an event captured on mount
// would otherwise reach a PostHog that had not started yet.
start();

type EventProperties = Record<string, string | number | boolean | null | undefined>;

export function track(event: string, properties?: EventProperties) {
  if (started) posthog.capture(event, properties);
}

export function reportError(error: unknown) {
  if (started) posthog.captureException(error);
}

// The visitor's answer to the recording question ("Help us make the site better?"): 'pending' until they
// answer, and null where PostHog does not run (local and preview builds), so
// nothing asks a question that nothing would act on. With Do Not Track or
// Global Privacy Control on, PostHog reports 'denied'.
export type RecordingChoice = 'granted' | 'denied' | 'pending';

const choiceListeners = new Set<() => void>();

export function recordingChoice(): RecordingChoice | null {
  return started ? posthog.get_explicit_consent_status() : null;
}

// A yes switches PostHog out of cookieless mode and starts recording; a no,
// including a later change of mind, stops any recording and clears PostHog's
// IDs from the tab. Either way the answer is counted, without anything that
// says who gave it.
export function setRecordingChoice(allowed: boolean) {
  if (!started) return;
  if (allowed) {
    posthog.opt_in_capturing({ captureEventName: false });
  } else {
    posthog.opt_out_capturing();
    forgetTab();
  }
  track('recording_choice', { allowed });
  choiceListeners.forEach((listener) => listener());
}

// Opting out clears PostHog's IDs but leaves its two notes about which tab is
// which, so they go here. Nothing writes them again until another yes.
function forgetTab() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(`ph_${TOKEN}_`)) sessionStorage.removeItem(key);
    }
  } catch {
    // Storage is blocked, so there is nothing to clear.
  }
}

export function subscribeToRecordingChoice(listener: () => void) {
  choiceListeners.add(listener);
  return () => {
    choiceListeners.delete(listener);
  };
}
