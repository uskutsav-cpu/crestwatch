"use client";

/**
 * "Send to family": the phone's own share sheet (navigator.share) with
 * the verdict sentence and the watch link, so it can go out by text in
 * one tap. Renders nothing where the browser can't share (most desktop
 * Firefox) and nothing on the server or during hydration. The parent
 * already has "Copy watch link", which is the fallback when a share
 * fails for any reason other than the person closing the sheet.
 */

import { useRef } from "react";
import { copy } from "@/lib/copy";
import { ACTION_BUTTON, useBrowserSupport } from "@/components/watch/ReadAloud";

export function shareSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** The slice of `navigator` a share needs. */
export interface ShareNavigator {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
}

export interface FamilyShareInput {
  pinName: string;
  sentence: string;
  url: string;
  notes?: ReadonlyArray<string | null | undefined>;
}

/**
 * Title, text and link for the share sheet. The text is the sentence,
 * then each honesty note on its own line, so a stale answer or an
 * approximate spot never travels without its warning.
 */
export function familyShareData({ pinName, sentence, url, notes }: FamilyShareInput): ShareData {
  const lines = [sentence, ...(notes ?? [])].filter(
    (s): s is string => typeof s === "string" && s.trim() !== "",
  );
  return { title: copy.sendToFamilyTitle(pinName), text: lines.join("\n"), url };
}

export type ShareOutcome = "shared" | "cancelled" | "fallback";

const isAbort = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError";

/**
 * Share, or hand over to the parent's fallback. Closing the sheet
 * (AbortError) is the person's choice, so it does nothing. Any other
 * failure (no permission, an in-app browser, data the sheet won't take)
 * calls `onFallback` once. Never rejects.
 */
export async function shareOrFallback(
  data: ShareData,
  onFallback: () => void,
  nav: ShareNavigator = typeof navigator !== "undefined" ? navigator : {},
): Promise<ShareOutcome> {
  try {
    if (typeof nav.share !== "function" || (nav.canShare && !nav.canShare(data))) {
      onFallback();
      return "fallback";
    }
    await nav.share(data);
    return "shared";
  } catch (err) {
    if (isAbort(err)) return "cancelled";
    onFallback();
    return "fallback";
  }
}

export interface SendToFamilyProps extends FamilyShareInput {
  /** Called when sharing fails (not when the sheet is closed). */
  onFallback: () => void;
}

function ShareIcon() {
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
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

export function SendToFamily({ pinName, sentence, url, notes, onFallback }: SendToFamilyProps) {
  const supported = useBrowserSupport(shareSupported);
  // A second tap while the sheet is open would throw InvalidStateError
  // and wrongly trigger the fallback.
  const busy = useRef(false);

  if (!supported) return null;

  async function send() {
    if (busy.current) return;
    busy.current = true;
    try {
      await shareOrFallback(familyShareData({ pinName, sentence, url, notes }), onFallback);
    } finally {
      busy.current = false;
    }
  }

  return (
    <button
      type="button"
      onClick={() => void send()}
      data-testid="send-to-family"
      className={ACTION_BUTTON}
    >
      <ShareIcon />
      {copy.sendToFamily}
    </button>
  );
}
