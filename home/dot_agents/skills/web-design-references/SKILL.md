---
name: web-design-references
description: Provides curated web design JSON snapshots (tokens, layout, components, copy, media) for inspiration and execution guidance. This skill provides complete design system references from real websites to use when developing a design system of any kind. This is our preferred style for webdesign.
---

# Web design references

Use these JSON snapshots of real web design systems. Each reference contains structured data covering tokens, color systems, typography, layout patterns, components, media assets, animations, copywriting, and responsive behavior.

## what this skill does

- use structured JSON snapshots of real-world design implementations
- capture complete design systems including visual tokens, layout, and content patterns
- document e-commerce flows, component structures, and interaction patterns
- use as inspiration and execution reference for implementing similar designs

## When to use

- Building product pages that need specific aesthetic references
- Implementing e-commerce flows with documented UX patterns
- Creating design systems that match established visual languages
- Needing concrete token values, spacing, and typography specifications
- Seeking copywriting tone and structure examples for specific audiences

Use this skill for design specifications. Use `modern-css-snippets` for CSS implementation techniques.

## Input schema

no runtime inputs required. read the appropriate JSON file based on the design reference needed.

## Output schema

your outputs are textual guidance referencing JSON fields:

- **meta**: source URL, page type, style classification, tone
- **color_system**: primary, secondary, and semantic color values
- **typography**: font families, scale definitions, weights, line heights
- **layout**: container behavior, section ordering, grid/flex usage
- **components**: button styles, navigation patterns, form elements, dialogs
- **media**: asset counts, formats, CDN sources, responsive image sizes
- **animations**: element counts, effect types, scroll behaviors
- **copywriting**: tone descriptions, headline examples, body copy samples
- **responsive**: breakpoints, viewport meta, current viewport specs
- **ecommerce**: selection flows, CTA patterns, bundle offers
- **layout_structure**: detailed section positioning and flow patterns
- **tokens**: CSS custom properties with complete token library

## How to use

1. identify the design reference needed (e.g., minimalist-brutalist-retro product page)
2. open the relevant JSON file under [`references/`](references/)
3. navigate to the specific JSON section: `meta`, `color_system`, `typography`, `layout`, `components`, `media`, `animations`, `copywriting`, `responsive`, `ecommerce`, `layout_structure`, or `tokens`
4. extract specific values needed (colors, fonts, spacing, component specs)
5. reference layout patterns and section ordering for structural guidance
6. use copywriting examples as tone and style references
7. check `tokens` for CSS custom property definitions
8. implement with appropriate technology stack

When local references cannot be read, view them online at <https://github.com/digitalygo/opencode-setup/tree/main/skills/web-design-references/references>

## Reference index

| File | Description |
|------|-------------|
| [`dbrand-touch-grass.json`](references/dbrand-touch-grass.json) | Minimalist brutalist e-commerce product page with retro Win95 aesthetic, canvas/video hero, ironic Gen-Z tone |
| [`akuto-studio.json`](references/akuto-studio.json) | Product launch page for AKT-0.1 chord machine with uppercase typographic grid, neon orange highlight |
| [`michael-kolesidis.json`](references/michael-kolesidis.json) | Portfolio site with playful hand-drawn elements, bold color pops, many animated elements |
| [`nothing-phone-4a-pro.json`](references/nothing-phone-4a-pro.json) | Mobile product detail page with monochrome glass aesthetic, dense sections, CTA-rich ecommerce flow |
| [`posthog.json`](references/posthog.json) | SaaS marketing page with beige/gold palette, rounded cards, CTA ribbons, logo wall, pricing grid |
| [`the-lords-of-water.json`](references/the-lords-of-water.json) | Dark high-contrast beverage ecommerce with condensed uppercase headlines, red accents, marquee animations |

## JSON structure overview

Each reference file contains these sections:

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

## Using design tokens

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
