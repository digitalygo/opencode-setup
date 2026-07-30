# Modern CSS Snippets — Set 3

Reference summaries for the modern-css.com snippets (set 3). Each entry captures the legacy approach (Before), the modern CSS alternative (After), and the key rules involved.

## Preventing scroll chaining without JavaScript

**Source:** <https://modern-css.com/preventing-scroll-chaining-without-javascript/>

**Description:** Stop scroll from leaking to parent containers using `overscroll-behavior`.

**Before:**

```javascript
modal.addEventListener('wheel', (e) => {
  e.preventDefault();
}, { passive: false });
/* plus touch handlers */
```

**After:**

```css
.modal-content {
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

**Key CSS rules:** `overscroll-behavior: contain|none`.

## Dropdown menus without JavaScript toggles

**Source:** <https://modern-css.com/dropdown-menus-without-javascript-toggles/>

**Description:** Use the popover API for toggling, light-dismiss, and ESC handling.

**Before:**

```javascript
// Toggle class, click-outside, ESC, aria-expanded logic
```

**After:**

```html
<button popovertarget="menu">Open</button>
<div id="menu" popover>Content</div>
```

**Key CSS rules:** `popover` attribute, `popovertarget` attribute.

## Reduced motion without JavaScript detection

**Source:** <https://modern-css.com/reduced-motion-without-javascript-detection/>

**Description:** Respect OS reduced-motion preference directly in CSS.

**Before:**

```javascript
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
if (mq.matches) {
  document.querySelectorAll('.animated').forEach((el) => {
    el.style.animation = 'none';
  });
}
```

**After:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
  }
}
```

**Key CSS rules:** `@media (prefers-reduced-motion: reduce)`.

## Fluid typography without media queries

**Source:** <https://modern-css.com/fluid-typography-without-media-queries/>

**Description:** Smoothly scale font sizes with `clamp()` instead of breakpoint ladders.

**Before:**

```css
h1 { font-size: 1rem; }
@media (min-width: 600px) { h1 { font-size: 1.5rem; } }
@media (min-width: 900px) { h1 { font-size: 2rem; } }
```

**After:**

```css
h1 {
  font-size: clamp(1rem, 2.5vw, 2rem);
}
```

**Key CSS rules:** `clamp()`, `min()`, `max()` for fluid sizing.

## Focus styles without annoying mouse users

**Source:** <https://modern-css.com/focus-styles-without-annoying-mouse-users/>

**Description:** Show focus outlines only for keyboard interactions.

**Before:**

```css
button:focus { outline: 2px solid blue; }
```

**After:**

```css
button:focus-visible {
  outline: 2px solid var(--focus-color);
}
```

**Key CSS rules:** `:focus-visible` pseudo-class.

## Font loading without invisible text

**Source:** <https://modern-css.com/font-loading-without-invisible-text/>

**Description:** Prevent FOIT by swapping fallback text while fonts load.

**Before:**

```css
@font-face {
  font-family: "MyFont";
  src: url("MyFont.woff2");
}
```

**After:**

```css
@font-face {
  font-family: "MyFont";
  src: url("MyFont.woff2");
  font-display: swap;
}
```

**Key CSS rules:** `font-display: swap|optional|block`.

## Spacing elements without margin hacks

**Source:** <https://modern-css.com/spacing-elements-without-margin-hacks/>

**Description:** Use `gap` on flex or grid parents instead of child margins.

**Before:**

```css
.grid { display: flex; }
.grid > * { margin-right: 16px; }
.grid > *:last-child { margin-right: 0; }
```

**After:**

```css
.grid {
  display: flex;
  gap: 16px;
}
```

**Key CSS rules:** `gap`, `row-gap`, `column-gap`.

## Naming grid areas without line numbers

**Source:** <https://modern-css.com/naming-grid-areas-without-line-numbers/>

**Description:** Define layouts visually with named grid areas.

**Before:**

```css
.header { grid-column: 1 / -1; }
.sidebar { grid-column: 1; grid-row: 2; }
.main { grid-column: 2; grid-row: 2; }
```

**After:**

```css
.layout {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
}

.header { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main { grid-area: main; }
.footer { grid-area: footer; }
```

**Key CSS rules:** `grid-template-areas`, `grid-area`.

## Selecting parent elements without JavaScript

**Source:** <https://modern-css.com/selecting-parent-elements-without-javascript/>

**Description:** Target parents based on their children with `:has()`.

**Before:**

```javascript
document.querySelectorAll('input').forEach((input) => {
  input.addEventListener('invalid', () => {
    input.closest('.form-group').classList.add('has-error');
  });
});
```

**After:**

```css
.form-group:has(input:invalid) {
  border-color: red;
  background: #fff0f0;
}
```

**Key CSS rules:** `:has()` relational pseudo-class.

## Hover tooltips without JavaScript events

**Source:** <https://modern-css.com/hover-tooltips-without-javascript-events/>

**Description:** Declarative tooltips with popover hints covering hover, focus, and touch.

**Before:**

```javascript
btn.addEventListener('mouseenter', () => tip.hidden = false);
btn.addEventListener('mouseleave', () => tip.hidden = true);
```

**After:**

```html
<button interestfor="tip">Hover me</button>
<div id="tip" popover="hint">Tooltip content</div>
```

**Key CSS rules:** `popover="hint"`, `interestfor`, `interest-delay`.

## Independent transforms without the shorthand

**Source:** <https://modern-css.com/independent-transforms-without-the-shorthand/>

**Description:** Animate transform components independently without rewriting the shorthand.

**Before:**

```css
.icon { transform: translateX(10px) rotate(45deg) scale(1.2); }

.icon:hover {
  transform: translateX(10px) rotate(90deg) scale(1.2);
}
```

**After:**

```css
.icon {
  translate: 10px 0;
  rotate: 45deg;
  scale: 1.2;
}

.icon:hover {
  rotate: 90deg;
}
```

**Key CSS rules:** Individual `translate`, `rotate`, `scale` properties.

## Drop caps without float hacks

**Source:** <https://modern-css.com/drop-caps-without-float-hacks/>

**Description:** Create drop caps with `initial-letter` instead of floats and manual sizing.

**Before:**

```css
.drop-cap::first-letter {
  float: left;
  font-size: 3em;
  line-height: 1;
  margin-right: 8px;
}
```

**After:**

```css
.drop-cap::first-letter {
  initial-letter: 3;
}
```

**Key CSS rules:** `initial-letter`.

## Positioning shorthand without four properties

**Source:** <https://modern-css.com/positioning-shorthand-without-four-properties/>

**Description:** Use `inset` to set all inset edges in one declaration.

**Before:**

```css
.overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}
```

**After:**

```css
.overlay {
  position: absolute;
  inset: 0;
}
```

**Key CSS rules:** `inset` shorthand.

## Smooth height auto animations without JavaScript

**Source:** <https://modern-css.com/smooth-height-auto-animations-without-javascript/>

**Description:** Animate `height: auto` transitions with `interpolate-size`.

**Before:**

```javascript
function open(el) {
  el.style.height = `${el.scrollHeight}px`;
  el.addEventListener('transitionend', () => {
    el.style.height = 'auto';
  }, { once: true });
}
```

**After:**

```css
:root { interpolate-size: allow-keywords; }

.accordion {
  height: 0;
  overflow: hidden;
  transition: height 0.3s ease;
}

.accordion.open { height: auto; }
```

**Key CSS rules:** `interpolate-size: allow-keywords`.

## Modal controls without onclick handlers

**Source:** <https://modern-css.com/modal-controls-without-onclick-handlers/>

**Description:** Declaratively open or close dialogs and popovers with `commandfor` and `command`.

**Before:**

```html
<button onclick="document.querySelector('#dlg').showModal()">Open</button>
<dialog id="dlg">...</dialog>
```

**After:**

```html
<button commandfor="dlg" command="show-modal">Open Dialog</button>
<dialog id="dlg">...</dialog>
```

**Key CSS rules:** `commandfor`, `command` attributes.

## Grouping selectors without repetition

**Source:** <https://modern-css.com/grouping-selectors-without-repetition/>

**Description:** Use `:is()` to group selectors with shared prefixes.

**Before:**

```css
.card h1, .card h2, .card h3, .card h4 {
  margin-bottom: 0.5em;
}
```

**After:**

```css
.card :is(h1, h2, h3, h4) {
  margin-bottom: 0.5em;
}
```

**Key CSS rules:** `:is()` pseudo-class.

## Carousel navigation without a JavaScript library

**Source:** <https://modern-css.com/carousel-navigation-without-a-javascript-library/>

**Description:** Use scroll buttons and markers natively instead of JavaScript carousels.

**Before:**

```javascript
import Swiper from 'swiper';
new Swiper('.carousel', {
  navigation: { nextEl: '.next', prevEl: '.prev' },
  pagination: { el: '.dots' },
});
```

**After:**

```css
.carousel::scroll-button(left) { content: "⬅" / "Scroll left"; }
.carousel::scroll-button(right) { content: "➡" / "Scroll right"; }
.carousel { scroll-marker-group: after; }
.carousel li::scroll-marker {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
```

**Key CSS rules:** `::scroll-button()`, `::scroll-marker`, `scroll-marker-group`.

## Reusable CSS logic without Sass mixins

**Source:** <https://modern-css.com/reusable-css-logic-without-sass-mixins/>

**Description:** Define reusable native CSS functions with `@function`.

**Before:**

```scss
@function fluid($min, $max) {
  @return clamp(#{$min}, ..., #{$max});
}
```

**After:**

```css
@function --fluid(--min, --max) {
  @return clamp(var(--min), 50vi, var(--max));
}
```

**Key CSS rules:** `@function`, `@return`.

## Inline conditional styles without JavaScript

**Source:** <https://modern-css.com/inline-conditional-styles-without-javascript/>

**Description:** Use `if()` with `style()` queries to choose values inline.

**Before:**

```css
.btn { background: gray; }
.btn.primary { background: blue; }
.btn.danger { background: red; }
```

```javascript
// JS toggles classes based on variant
```

**After:**

```css
.btn {
  background: if(
    style(--variant: primary): blue;
    else: gray
  );
}
```

**Key CSS rules:** `if()` function, `style()` query.

## Nesting selectors without Sass or Less

**Source:** <https://modern-css.com/nesting-selectors-without-sass-or-less/>

**Description:** Write nested selectors in plain CSS using `&` without preprocessors.

**Before:**

```scss
.nav {
  display: flex;
  & a {
    color: #888;
    &:hover { color: white; }
  }
}
```

**After:**

```css
.nav {
  display: flex;
  & a {
    color: #888;
    &:hover { color: white; }
  }
}
```

**Key CSS rules:** Native CSS nesting with `&`.
