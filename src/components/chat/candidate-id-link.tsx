import { ExternalLink } from "lucide-react";

// Candidate IDs look like "C06057" — 5-6 digits after the C (e.g. C00001, C11227).
const CANDIDATE_ID_RE = /\bC\d{5,6}\b/g;
const CANDIDATE_LINK_RE = /^\/candidates\/(C\d{5,6})$/;

// Wraps bare candidate IDs in AI chat text with a real relative-path markdown
// link. (A custom URL scheme like "candidate://" gets stripped by
// react-markdown's default link sanitizer, which only allows a fixed list of
// protocols plus relative paths — so this must be a real, allowed path.)
export function linkifyCandidateIds(text: string): string {
    return text.replace(CANDIDATE_ID_RE, (id) => `[${id}](/candidates/${id})`);
}

// Custom renderer for ReactMarkdown's `a` component — pass as
// `components={{ a: CandidateIdLink }}`. Falls back to a normal link for any
// href that isn't a candidate profile path (e.g. if the AI ever emits a real URL).
export function CandidateIdLink({ href, children }: { href?: string; children?: React.ReactNode }) {
    if (href && CANDIDATE_LINK_RE.test(href)) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-semibold no-underline hover:bg-indigo-200 transition-colors align-middle"
            >
                {children}
                <ExternalLink className="h-2.5 w-2.5" />
            </a>
        );
    }
    return (
        <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    );
}
