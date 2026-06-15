---
name: modern-css-snippets
description: Keeps agents up to date on modern CSS capabilities and replacements for legacy approaches. Use this when editing CSS files.
---

# Modern CSS snippets

Use this skill to stay current on modern CSS capabilities and replacements for legacy approaches. These are modern CSS patterns that replace legacy JavaScript-heavy or hacky CSS approaches. Sourced from [modern-css.com](https://modern-css.com).

## what this skill does

- use before/after code comparisons for modern CSS replacements
- group snippets by use case: layout, animation, typography, accessibility, interaction, and utility patterns
- apply native CSS features that eliminate JavaScript dependencies
- consider browser support and fallback strategies

## When to use

- Refactoring legacy CSS with JavaScript workarounds
- Implementing new features with native CSS capabilities
- Evaluating browser support for modern CSS features
- Creating progressive enhancement strategies

## Input schema

no runtime inputs required. read the appropriate reference file based on the task context.

## Output schema

your outputs are textual guidance and code snippets:

- **Before**: legacy approach (JavaScript or hacky CSS)
- **After**: modern CSS replacement
- **Key CSS rules**: essential properties and values to apply

## How to use

1. identify the pattern category needed (layout, scroll, animation, accessibility, etc.)
2. open the relevant reference set under [`references/`](references/)
3. find the specific snippet matching your use case
4. verify browser support for the modern feature (check [caniuse.com](https://caniuse.com))
5. implement the CSS with `@supports` feature detection when needed
6. test in target browsers and provide fallbacks for unsupported features

if local references are not readable, view them online at <https://github.com/digitalygo/opencode-setup/tree/main/skills/modern-css-snippets/references>

## Reference index

| File | Topics Covered |
|------|----------------|
| [`set-01.md`](references/set-01.md) | Layout patterns, color functions, typography, form validation, feature detection, resets, scoped styles |
| [`set-02.md`](references/set-02.md) | Scroll behaviors, animations, snapping, dark mode, media queries, logical properties |
| [`set-03.md`](references/set-03.md) | Accessibility, interactions, popovers, transforms, grid areas, nesting, custom functions |

## Caveats and notes

### Browser support considerations

| Feature | Support Status | Fallback Strategy |
|---------|---------------|-------------------|
| `:has()` | Modern browsers | Progressive enhancement |
| `subgrid` | Firefox, Safari | Grid fallback or `@supports` |
| Container queries | Modern browsers | Media query fallback |
| View Transitions API | Chrome/Edge | No fallback available |
| `oklch()` | Modern browsers | Hex/HSL fallback |
| `popover` API | Modern browsers | JavaScript polyfill |
| `@function` | Experimental | CSS custom properties |

### Progressive enhancement pattern

```css
@supports (property: value) {
  .element {
    property: value;
  }
}
```

## References

- [modern-css.com](https://modern-css.com) — Primary source feed
- [caniuse.com](https://caniuse.com) — Browser support verification
- [MDN CSS Reference](https://developer.mozilla.org/en-US/docs/Web/CSS) — Detailed documentation
