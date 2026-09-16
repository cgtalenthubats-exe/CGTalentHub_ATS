import { useEffect, useRef, useState } from "react";

/**
 * Briefly highlights rows that just appeared in a list, so a user who saves something can see
 * *which* record they created instead of scanning a refreshed list to check it worked.
 *
 * Usage: call `armForNewItems()` right before triggering the refetch, then apply
 * `isHighlighted(id)` to each row. Editing an existing record has no new id to detect, so call
 * `highlight(id)` directly for that case.
 */
export function useHighlightNew<T>(
    items: T[],
    getId: (item: T) => string | number,
    durationMs = 2500
) {
    const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
    const armedIdsRef = useRef<Set<string> | null>(null);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    const clearLater = (ids: string[]) => {
        const timer = setTimeout(() => {
            setHighlighted(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
        }, durationMs);
        timersRef.current.push(timer);
    };

    useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

    // When armed, the next change to `items` is the result of the save — anything not in the
    // snapshot is new.
    useEffect(() => {
        const snapshot = armedIdsRef.current;
        if (!snapshot) return;

        const added = items.map(getId).map(String).filter(id => !snapshot.has(id));
        if (added.length === 0) return;

        armedIdsRef.current = null;
        setHighlighted(prev => new Set([...prev, ...added]));
        clearLater(added);
        // getId is a render-time lambda in most callers; items is the value that actually changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items]);

    const armForNewItems = () => {
        armedIdsRef.current = new Set(items.map(getId).map(String));
    };

    const highlight = (id: string | number) => {
        const key = String(id);
        setHighlighted(prev => new Set([...prev, key]));
        clearLater([key]);
    };

    return {
        armForNewItems,
        highlight,
        isHighlighted: (id: string | number) => highlighted.has(String(id)),
    };
}
