---
name: Admin UI code conventions
description: Naming patterns, section comment style, and structural conventions in the shirt-order-manager admin UI components
type: project
---

## Section comment style

Long components use em-dash section labels:
```
// ── State ──
// ── Effects ──
// ── Handlers ──
// ── Render helpers ──
// ── Render ──
```
Sub-groups within State use plain `// Filters`, `// Bulk actions`, `// Image uploads` inline comments.
Only add section headers when the component is long enough to benefit — sidebar.tsx was left without them.

## State ordering convention

1. Primary data state (`data`, `loading`, `saving`)
2. Filter state (grouped, labeled `// Filters`)
3. Action state (bulk actions, in-flight IDs)
4. Dropdown list state (loaded once on mount, labeled `// Sub-filter dropdown lists`)
5. Derived values / password strength computed inline (not memoized)

## Effects ordering convention

Effects come after state declarations. The effect that triggers a named `useCallback` fetch goes immediately after the fetch function definition, not before it.

## Handlers

`fetchX` functions are defined as `const fetchX = async () => ...` (not `useCallback`) unless they are used as a `useEffect` dependency — in which case they use `useCallback`.

## Patterns to avoid

- Inline IIFE `{(() => { ... })()}` in JSX — extract to a `const` before the `return`.
- Defining a local `const colors = [...]` inside a `.map()` callback — hoist it to module scope.
- Duplicate imports from the same package (e.g. importing `Shirt` twice from lucide-react).

## Filter select pattern

Throughout orders and reports, select "all" values are represented as empty string `''` in state. The select `value` prop uses `value || 'all'` and `onValueChange` maps `'all'` back to `''`. This is consistent and intentional.

## Brand colors (used in inline styles)

- Dark green (primary): `#00352F`
- Mid green: `#00594F`
- Lime accent: `#CEDC00`
- Light green tint (backgrounds): `#E5F2F0`
