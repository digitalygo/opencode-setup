---
name: web-design-references
description: Provides curated web design JSON snapshots (tokens, layout, components, copy, media) for inspiration and execution guidance. This skill provides complete design system references from real websites to use when developing a design system of any kind. This is our preferred style for webdesign.
---

# Web Design References

Curated collection of web design JSON snapshots capturing complete design systems from notable websites. Each reference file contains structured data covering tokens, color systems, typography, layout patterns, components, media assets, animations, copywriting, and responsive behavior.

## What This Skill Does

- Provides structured JSON snapshots of real-world design implementations
- Captures complete design systems including visual tokens, layout, and content patterns
- Documents e-commerce flows, component structures, and interaction patterns
- Serves as inspiration and execution reference for implementing similar designs

## When to Use

- Building product pages that need specific aesthetic references
- Implementing e-commerce flows with documented UX patterns
- Creating design systems that match established visual languages
- Needing concrete token values, spacing, and typography specifications
- Seeking copywriting tone and structure examples for specific audiences

This skill complements `modern-css-snippets` (which covers CSS capabilities and techniques) by providing the *what to build* (design specifications) rather than the *how to build it with CSS* (implementation techniques).

## Input Schema

No runtime inputs required. This skill is reference-only; agents read the appropriate JSON file based on the design reference needed.

## Output Schema

Outputs are textual guidance referencing JSON fields:

- **meta**: Source URL, page type, style classification, tone
- **color_system**: Primary, secondary, and semantic color values
- **typography**: Font families, scale definitions, weights, line heights
- **layout**: Container behavior, section ordering, grid/flex usage
- **components**: Button styles, navigation patterns, form elements, dialogs
- **media**: Asset counts, formats, CDN sources, responsive image sizes
- **animations**: Element counts, effect types, scroll behaviors
- **copywriting**: Tone descriptions, headline examples, body copy samples
- **responsive**: Breakpoints, viewport meta, current viewport specs
- **ecommerce**: Selection flows, CTA patterns, bundle offers
- **layout_structure**: Detailed section positioning and flow patterns
- **tokens**: CSS custom properties with complete token library

## How to Use

1. Identify the design reference needed (e.g., minimalist-brutalist-retro product page)
2. Open the relevant JSON file under [`references/`](references/)
3. Navigate to the specific JSON section: `meta`, `color_system`, `typography`, `layout`, `components`, `media`, `animations`, `copywriting`, `responsive`, `ecommerce`, `layout_structure`, or `tokens`
4. Extract specific values needed (colors, fonts, spacing, component specs)
5. Reference layout patterns and section ordering for structural guidance
6. Use copywriting examples as tone and style references
7. Check `tokens` for CSS custom property definitions
8. Implement with appropriate technology stack

If local references cannot be read, view them online at <https://github.com/digitalygo/opencode-setup/tree/main/skills/web-design-references/references>

## Reference Index

| File | Description |
|------|-------------|
| [`dbrand-touch-grass.json`](references/dbrand-touch-grass.json) | Minimalist brutalist e-commerce product page with retro Win95 aesthetic, canvas/video hero, ironic Gen-Z tone |
| [`akuto-studio.json`](references/akuto-studio.json) | Product launch page for AKT-0.1 chord machine with uppercase typographic grid, neon orange highlight |
| [`michael-kolesidis.json`](references/michael-kolesidis.json) | Portfolio site with playful hand-drawn elements, bold color pops, many animated elements |
| [`nothing-phone-4a-pro.json`](references/nothing-phone-4a-pro.json) | Mobile product detail page with monochrome glass aesthetic, dense sections, CTA-rich ecommerce flow |
| [`posthog.json`](references/posthog.json) | SaaS marketing page with beige/gold palette, rounded cards, CTA ribbons, logo wall, pricing grid |
| [`the-lords-of-water.json`](references/the-lords-of-water.json) | Dark high-contrast beverage ecommerce with condensed uppercase headlines, red accents, marquee animations |

## JSON Structure Overview

Each reference file contains the following sections:

| Section | Content |
|---------|---------|
| **meta** | Page name, source URL, analysis date, type, style classification, tone |
| **color_system** | Primary/secondary palettes, semantic colors (success, error, warning) |
| **typography** | Font families, type scale with sizes/weights/line-heights |
| **layout** | Container strategy, hero configuration, section patterns, grid usage stats |
| **components** | Button variants, navigation style, dialogs, form elements, breadcrumbs |
| **media** | Asset inventory, CDN info, formats, dimensions, video settings |
| **animations** | Animation counts by type, hover effects, scroll behaviors |
| **copywriting** | Tone description, headline examples, CTA copy, body text samples |
| **responsive** | Viewport meta, breakpoints, current viewport dimensions |
| **ecommerce** | Selection flows (device, type, add-ons), bundle offers, CTAs |
| **layout_structure** | Detailed section ordering, positioning, spacing strategy |
| **tokens** | Complete CSS custom properties (design tokens) library |

## Using Design Tokens

The `tokens` section contains CSS custom properties extracted from the source site:

```css
/* Example token usage */
.element {
  background-color: var(--color-primary-500);
  font-family: var(--font-base);
  padding: var(--atlas-space-small);
  border-radius: var(--atlas-button-border-radius);
}
```

When implementing, map these tokens to your project's token system or use them directly as CSS variables.

## References

- Source websites cited in each JSON file's `meta.source` field
- Design tokens follow CSS custom properties convention (`--token-name`)
- Color values provided in hex, oklch, and rgba formats as found in source
