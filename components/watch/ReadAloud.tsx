"use client";

/**
 * "Read it to me": the browser's own voice (window.speechSynthesis) reads
 * the verdict out loud, for a grandparent without glasses or a kid still
 * learning to read. Nothing is fetched and no audio leaves the device.
 *
 * Nothing renders on the server or during hydration (the support check
 * has a `false` server snapshot), and nothing renders where the browser
 * has no speech. Tapping again stops it. New words (a refresh changed the
 * verdict) or leaving the page stop it too.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { copy } from "@/lib/copy";

const ACTION_BUTTON_BASE =
  "inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-lg text-small font-semibold text-dim transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg";

/**
 * The small text buttons in the Watch actions row (same look as "Copy
 * watch link"), with a 44 px touch target and a visible focus ring.
 *
 * Colour rule: --color-current is too light for text on the light theme.
 * app/globals.css darkens only `text-(--color-current)` and
 * `hover:text-(--color-current)`, so no other variant of it (pressed,
 * active, focus) may be used here. Use a colour that flips with the
 * theme, like text-fg.
 */
export const ACTION_BUTTON = `${ACTION_BUTTON_BASE} hover:text-(--color-current)`;

/** The same button while it can't be used (aria-disabled): no hover colour. */
export const ACTION_BUTTON_INERT = `${ACTION_BUTTON_BASE} cursor-default`;

/** "Stop" while reading: full-strength text in either theme. */
export const READ_ALOUD_PRESSED = "aria-pressed:text-fg";

/** A touch slower than default, for older ears and new readers. */
export const SPEECH_RATE = 0.95;

const neverChanges = () => () => {};

/**
 * True only in a browser that passes `check`, and never during the server
 * render or hydration, so the first paint matches the server's HTML.
 */
export function useBrowserSupport(check: () => boolean): boolean {
  return useSyncExternalStore(neverChanges, check, () => false);
}

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

/** The slice of a SpeechSynthesisVoice a voice is chosen by. */
export interface VoiceLike {
  lang: string;
  default?: boolean;
  localService?: boolean;
}

/** Android reports "en_US"; everyone else "en-US". */
const langOf = (v: VoiceLike) => v.lang.replace(/_/g, "-");

/**
 * An en-US voice if there is one (the device default first, then one
 * that works offline), else any English voice, else null (the browser
 * picks, guided by lang="en-US").
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  const us = voices.filter((v) => langOf(v).toLowerCase() === "en-us");
  const pool = us.length
    ? us
    : voices.filter((v) => langOf(v).toLowerCase().startsWith("en"));
  if (pool.length === 0) return null;
  return pool.find((v) => v.default) ?? pool.find((v) => v.localService) ?? pool[0];
}

/** Short forms said the way a person would: "12 ft" → "12 feet", "CT" → "Central time". */
export function speakable(text: string): string {
  return text
    .replace(/~\s*/g, `${copy.speechAbout} `)
    // Before a noun it's "a 4 foot gap", not "a 4 feet gap".
    .replace(/(\d+(?:\.\d+)?)\s*ft gap\b/g, (_, n: string) => `${n} ${copy.speechFoot} gap`)
    .replace(
      /(\d+(?:\.\d+)?)\s*ft\b/g,
      (_, n: string) => `${n} ${n === "1" ? copy.speechFoot : copy.speechFeet}`,
    )
    .replace(/\bCT\b/g, copy.speechCentral);
}

/**
 * What gets read, one sentence per utterance: some voices (Chrome's
 * online ones) stop after about 15 seconds of one long utterance.
 * Empty parts are skipped. "92.7 ft" stays whole: a split needs a space
 * after the period.
 */
export function speechChunks(parts: ReadonlyArray<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const s of speakable(part).replace(/([.?])\s+/g, "$1\n").split("\n")) {
      const t = s.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

/** The slice of SpeechSynthesisUtterance this file sets. */
export interface UtteranceLike<V> {
  lang: string;
  rate: number;
  voice: V | null;
  onend: ((ev: never) => unknown) | null;
  onerror: ((ev: never) => unknown) | null;
}

/** The slice of window.speechSynthesis this file uses. */
export interface SynthLike<U> {
  speak: (u: U) => void;
  cancel: () => void;
  speaking?: boolean;
  pending?: boolean;
}

export interface SpeechSession {
  /** Stop reading now. Safe to call more than once. */
  stop: () => void;
  /** True once the last sentence ended, it errored, or stop() ran. */
  readonly done: boolean;
}

/**
 * Queue every chunk and report back once, when the last one ends, any
 * one fails, or stop() runs. `onDone` gets the session so a caller can
 * tell an old session's late callback from the current one.
 */
export function startSpeech<V extends VoiceLike, U extends UtteranceLike<V>>(opts: {
  synth: SynthLike<U>;
  makeUtterance: (text: string) => U;
  chunks: readonly string[];
  voice: V | null;
  onDone: (session: SpeechSession) => void;
}): SpeechSession {
  const { synth, makeUtterance, chunks, voice, onDone } = opts;
  let done = false;
  // Held so the browser can't garbage-collect an utterance before its
  // onend fires (a known Chrome and Safari bug).
  const held: U[] = [];
  const finish = () => {
    if (done) return;
    done = true;
    onDone(session);
  };
  const session: SpeechSession = {
    get done() {
      return done;
    },
    stop() {
      if (done) return;
      finish();
      try {
        synth.cancel();
      } catch {
        // nothing left to stop
      }
    },
  };
  if (chunks.length === 0) {
    finish();
    return session;
  }
  try {
    // A queue left stuck (iOS after a backgrounded tab) would hold these
    // words behind old ones.
    if (synth.speaking || synth.pending) synth.cancel();
    chunks.forEach((text, i) => {
      const u = makeUtterance(text);
      u.lang = voice ? langOf(voice) : "en-US";
      if (voice) u.voice = voice;
      u.rate = SPEECH_RATE;
      if (i === chunks.length - 1) u.onend = finish;
      u.onerror = finish;
      held.push(u);
      synth.speak(u);
    });
  } catch {
    session.stop();
  }
  return session;
}

export interface ReadAloudProps {
  /** The verdict sentence, exactly as shown. */
  sentence: string;
  /** The optional second line under it (the kid-scale gloss). */
  secondLine?: string | null;
  /**
   * Honesty lines read after it, in order: the staleness line, the
   * approximate-spot note. Empty entries are skipped.
   */
  notes?: ReadonlyArray<string | null | undefined>;
}

function SpeakerIcon({ speaking }: { speaking: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {speaking ? (
        <rect x="6" y="6" width="12" height="12" rx="2" />
      ) : (
        <>
          <path d="M11 5 6 9H3v6h3l5 4z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

export function ReadAloud({ sentence, secondLine, notes }: ReadAloudProps) {
  const supported = useBrowserSupport(speechSupported);
  const [speaking, setSpeaking] = useState(false);
  const session = useRef<SpeechSession | null>(null);
  const chunks = speechChunks([sentence, secondLine, ...(notes ?? [])]);
  const words = chunks.join("\n");

  // New words, or this button leaving the page: stop reading the old ones.
  useEffect(() => {
    return () => session.current?.stop();
  }, [words]);

  // A page that's being left (or frozen) shouldn't keep talking.
  useEffect(() => {
    const stop = () => session.current?.stop();
    window.addEventListener("pagehide", stop);
    return () => window.removeEventListener("pagehide", stop);
  }, []);

  // Chrome loads its voice list on the first ask. Ask early, so the
  // first tap already has an en-US voice to choose.
  useEffect(() => {
    if (supported) window.speechSynthesis.getVoices();
  }, [supported]);

  if (!supported || chunks.length === 0) return null;

  function toggle() {
    if (session.current) {
      session.current.stop();
      return;
    }
    const synth = window.speechSynthesis;
    const s = startSpeech({
      synth,
      makeUtterance: (text) => new SpeechSynthesisUtterance(text),
      chunks,
      voice: pickVoice(synth.getVoices()),
      onDone: (ended) => {
        if (session.current !== ended) return;
        session.current = null;
        setSpeaking(false);
      },
    });
    if (s.done) return;
    session.current = s;
    setSpeaking(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      data-testid="read-aloud"
      className={`${ACTION_BUTTON} ${READ_ALOUD_PRESSED}`}
    >
      <SpeakerIcon speaking={speaking} />
      {speaking ? copy.readAloudStop : copy.readAloud}
    </button>
  );
}
