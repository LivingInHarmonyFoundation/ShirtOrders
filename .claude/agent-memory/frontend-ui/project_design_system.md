---
name: Design System & Component Patterns
description: Brand tokens, UI component locations, design conventions, and responsive patterns used across this Next.js 16 / Tailwind v4 / shadcn/ui admin app
type: project
---

## Brand Tokens (defined in globals.css)
- Primary green: `#00352F` (CSS var: `--brand`, `--brand-dark`)
- Lime accent: `#CEDC00` (CSS var: `--brand-lime`)
- Light teal: `#E5F2F0` (used for tinted backgrounds, selected states)
- Off-white bg: `#FAFAF9` (used for control panels, card bg)
- Tailwind custom colors: `color-brand`, `color-brand-lime`

## Component Library
- Uses **@base-ui** primitives (NOT radix-ui) — e.g. `@base-ui/react/button`, `@base-ui/react/select`
- shadcn-style wrappers in `src/components/ui/`
- Button variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`
- Select uses base-ui `SelectPrimitive.Root`, `.Trigger`, `.Content`, `.Item`, etc.

## Typography
- Body font: DM Sans (`--font-dm-sans`, mapped to `--font-sans` and `--font-mono`)
- Heading font: Lora (`--font-lora`, mapped to `--font-heading`)
- Section labels: `text-[10px] font-semibold tracking-widest uppercase text-gray-400`
- Mono technical labels: `font-mono` class

## Layout Conventions
- Admin pages use `max-w-5xl` or `max-w-6xl` outer container
- Two-zone studio layouts: dark left panel + light right controls panel wrapped in `rounded-2xl overflow-hidden shadow-xl`
- Radial gradient dark panels: `radial-gradient(ellipse at 50% 30%, #004d43 0%, #00352F 65%)`
- Dot pattern overlay: `radial-gradient(circle, #CEDC00 1px, transparent 1px)` at `24px 24px` bg-size, 4% opacity

## Responsive
- Mobile: stacked single column
- Desktop: `lg:grid-cols-[1fr_380px]` or `md:grid-cols-2`
- Sticky preview: `md:sticky md:top-6`

## Tailwind Version
- v4 with `@import "tailwindcss"` — no tailwind.config.js, tokens defined in `@theme inline {}` block in globals.css

## Next.js Version
- 16.2.3 with Turbopack, App Router (`src/app/`)
- Client components: `'use client'` directive
- No pages router usage in admin
