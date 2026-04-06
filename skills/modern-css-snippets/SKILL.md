---
name: modern-css-snippets
description: Keeps agents up to date on modern CSS capabilities and replacements for legacy approaches. Use this when editing CSS files.
---

# Modern CSS Snippets

Use this skill to stay current on modern CSS capabilities and replacements for legacy approaches. This is a reference collection of modern CSS patterns that replace legacy JavaScript-heavy or hacky CSS approaches. Sourced from [modern-css.com](https://modern-css.com).

## What This Skill Does

- Provides before/after code comparisons for modern CSS replacements
- Groups snippets by use case: layout, animation, typography, accessibility, interaction, and utility patterns
- Covers native CSS features that eliminate JavaScript dependencies
- Includes browser support considerations and fallback strategies

## When to Use

- Refactoring legacy CSS with JavaScript workarounds
- Implementing new features with native CSS capabilities
- Evaluating browser support for modern CSS features
- Creating progressive enhancement strategies

## Input Schema

No runtime inputs required. This skill is reference-only; agents read the appropriate reference file based on the task context.

## Output Schema

Outputs are textual guidance and code snippets:

- **Before**: Legacy approach (JavaScript or hacky CSS)
- **After**: Modern CSS replacement
- **Key CSS rules**: Essential properties and values to apply

## How to Use

1. Identify the pattern category needed (layout, scroll, animation, accessibility, etc.)
2. Open the relevant reference set under [`references/`](references/)
3. Locate the specific snippet matching your use case
4. Verify browser support for the modern feature (check [caniuse.com](https://caniuse.com))
5. Implement the CSS with `@supports` feature detection when needed
6. Test in target browsers and provide fallbacks for unsupported features

if local references are not readable, view them online at <https://github.com/digitalygo/opencode-setup/tree/main/skills/modern-css-snippets/references>

## Reference Index

| File | Topics Covered |
|------|----------------|
| [`set-01.md`](references/set-01.md) | Layout patterns, color functions, typography, form validation, feature detection, resets, scoped styles |
| [`set-02.md`](references/set-02.md) | Scroll behaviors, animations, snapping, dark mode, media queries, logical properties |
| [`set-03.md`](references/set-03.md) | Accessibility, interactions, popovers, transforms, grid areas, nesting, custom functions |

## Caveats and Notes

### Browser Support Considerations

| Feature | Support Status | Fallback Strategy |
|---------|---------------|-------------------|
| `:has()` | Modern browsers | Progressive enhancement |
| `subgrid` | Firefox, Safari | Grid fallback or `@supports` |
| Container queries | Modern browsers | Media query fallback |
| View Transitions API | Chrome/Edge | No fallback available |
| `oklch()` | Modern browsers | Hex/HSL fallback |
| `popover` API | Modern browsers | JavaScript polyfill |
| `@function` | Experimental | CSS custom properties |

### Progressive Enhancement Pattern

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
