import { useEffect, useRef } from "react";

/**
 * Re-runs `loader` when the user comes back to the page — switching back to the browser tab,
 * or refocusing the window after being away in another app.
 *
 * Pages in this app hold their data in `useState` and only load it on mount, so anything the
 * user (or a teammate) changed elsewhere stays invisible until a manual reload. This closes
 * that gap without polling: nothing runs while the tab sits in the background.
 *
 * `minIntervalMs` keeps quick alt-tabbing from firing a request every time.
 */
export function useRefreshOnFocus(
    loader: () => void | Promise<void>,
    { enabled = true, minIntervalMs = 10_000 }: { enabled?: boolean; minIntervalMs?: number } = {}
) {
    // Keep the latest loader in a ref so callers don't have to memoize it to avoid re-subscribing.
    const loaderRef = useRef(loader);
    loaderRef.current = loader;

    const lastRunRef = useRef(Date.now());

    useEffect(() => {
        if (!enabled) return;

        const maybeRefresh = () => {
            if (document.visibilityState !== "visible") return;
            const now = Date.now();
            if (now - lastRunRef.current < minIntervalMs) return;
            lastRunRef.current = now;
            void loaderRef.current();
        };

        window.addEventListener("focus", maybeRefresh);
        document.addEventListener("visibilitychange", maybeRefresh);
        return () => {
            window.removeEventListener("focus", maybeRefresh);
            document.removeEventListener("visibilitychange", maybeRefresh);
        };
    }, [enabled, minIntervalMs]);
}
