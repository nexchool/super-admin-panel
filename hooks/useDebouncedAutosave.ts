"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `save(value)` at most once per `delayMs` after `value` stops changing.
 * Skips the very first run (the initial load is not a user edit) and skips while
 * `enabled` is false (e.g. before the existing draft has loaded, so we never
 * overwrite a real draft with defaults).
 */
export function useDebouncedAutosave<T>(
  value: T,
  save: (value: T) => void,
  { delayMs = 1200, enabled = true }: { delayMs?: number; enabled?: boolean } = {}
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primed = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!primed.current) {
      primed.current = true;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(value), delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value), enabled, delayMs]);
}
