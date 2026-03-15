# Modern CSS Snippets — Set 1

Reference summaries for the modern-css.com snippets. Each entry captures the legacy approach (Before), the modern CSS alternative (After), and the key rules involved.

## Sticky headers without JavaScript scroll listeners

**Source:** <https://modern-css.com/sticky-headers-without-javascript-scroll-listeners/>

**Description:** Keep headers fixed on scroll with native CSS instead of scroll listeners and class toggling.

**Before:**

```javascript
window.addEventListener('scroll', () => {
  const rect = header.getBoundingClientRect();
  if (rect.top <= 0) header.classList.add('fixed');
  else header.classList.remove('fixed');
});
```

```css
.header.fixed {
  position: fixed;
  top: 0;
}
```

**After:**

```css
.header {
  position: sticky;
  top: 0;
}
```

**Key CSS rules:** `position: sticky`, `top`.

## Filling available space without calc() workarounds

**Source:** <https://modern-css.com/filling-available-space-without-calc-workarounds/>

**Description:** Use the `stretch` keyword to fill container space while respecting margins.

**Before:**

```css
.full {
  width: 100%;
  /* or hard-coded margins */
  width: calc(100% - 40px);
}
```

**After:**

```css
.full {
  width: stretch;
}
```

**Key CSS rules:** `width: stretch`, `height: stretch`, works with `min-*` and `max-*` sizing.

## Aligning nested grids without duplicating tracks

**Source:** <https://modern-css.com/aligning-nested-grids-without-duplicating-tracks/>

**Description:** Inherit parent grid tracks with `subgrid` to avoid duplicate definitions.

**Before:**

```css
.parent {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}
.child-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr; /* must stay in sync manually */
}
```

**After:**

```css
.parent {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}
.child-grid {
  display: grid;
  grid-template-columns: subgrid;
}
```

**Key CSS rules:** `grid-template-columns: subgrid`, `grid-template-rows: subgrid`.

## CSS feature detection without JavaScript

**Source:** <https://modern-css.com/css-feature-detection-without-javascript/>

**Description:** Detect support directly in CSS with `@supports` instead of Modernizr or JavaScript checks.

**Before:**

```javascript
if (CSS.supports('display', 'grid')) {
  document.body.classList.add('has-grid');
}
```

```css
.has-grid .layout { display: grid; }
```

**After:**

```css
@supports (display: grid) {
  .layout { display: grid; }
}
```

**Key CSS rules:** `@supports`, `@supports not`, logical `and`/`or`, and `@supports selector(:has())`.

## Vertical text centering without padding hacks

**Source:** <https://modern-css.com/vertical-text-centering-without-padding-hacks/>

**Description:** Trim font metric space with `text-box` for optical centering.

**Before:**

```css
.btn {
  display: inline-flex;
  align-items: center;
  padding: 10px 20px;
  padding-top: 8px; /* manual tweak */
}
```

**After:**

```css
.btn {
  padding: 10px 20px;
  text-box: trim-both cap alphabetic;
}
```

**Key CSS rules:** `text-box: trim-both cap alphabetic`, `text-box-trim`, and `text-box-edge`.

## Balanced headlines without manual line breaks

**Source:** <https://modern-css.com/balanced-headlines-without-manual-line-breaks/>

**Description:** Even headline line lengths automatically with `text-wrap: balance`.

**Before:**

```css
h1 {
  text-align: center;
  max-width: 40ch;
  /* manual <br> or Balance-Text JS */
}
```

**After:**

```css
h1,
h2 {
  text-wrap: balance;
  max-width: 40ch;
}
```

**Key CSS rules:** `text-wrap: balance`.

## Form validation styles without JavaScript

**Source:** <https://modern-css.com/form-validation-styles-without-javascript/>

**Description:** Style validation states after user interaction with `:user-invalid` and `:user-valid`.

**Before:**

```css
input.touched:invalid { border-color: red; }
input.touched:valid { border-color: green; }
```

```javascript
input.addEventListener('blur', () => {
  input.classList.add('touched');
});
```

**After:**

```css
input:user-invalid { border-color: red; }
input:user-valid { border-color: green; }
```

**Key CSS rules:** `:user-invalid`, `:user-valid`.

## Multiple font weights without multiple files

**Source:** <https://modern-css.com/multiple-font-weights-without-multiple-files/>

**Description:** Load one variable font and declare a weight range in `@font-face`.

**Before:**

```css
@font-face {
  font-family: "MyFont";
  src: url("MyFont-Regular.woff2");
  font-weight: 400;
}

@font-face {
  font-family: "MyFont";
  src: url("MyFont-Bold.woff2");
  font-weight: 700;
}
```

**After:**

```css
@font-face {
  font-family: "MyVar";
  src: url("MyVar.woff2");
  font-weight: 100 900;
}
```

**Key CSS rules:** Variable fonts and `font-weight: 100 900` range syntax in `@font-face`.

## Page transitions without a framework

**Source:** <https://modern-css.com/page-transitions-without-a-framework/>

**Description:** Use the View Transitions API for cross-page animations without Barba.js.

**Before:**

```javascript
import Barba from '@barba/core';
Barba.init({
  transitions: [{ name: 'fade', leave() {}, enter() {} }]
});
```

**After:**

```javascript
document.startViewTransition(() => {
  document.body.innerHTML = newContent;
});
```

```css
.hero { view-transition-name: hero; }
```

**Key CSS rules:** `document.startViewTransition()`, `view-transition-name`, `::view-transition-old()`, and `::view-transition-new()`.

## Low-specificity resets without complicated selectors

**Source:** <https://modern-css.com/low-specificity-resets-without-complicated-selectors/>

**Description:** Apply zero-specificity resets with `:where()` so component styles always win.

**Before:**

```css
ul,
ol {
  margin: 0;
  padding-left: 1.5rem;
}
```

**After:**

```css
:where(ul, ol) {
  margin: 0;
  padding-inline-start: 1.5rem;
}
```

**Key CSS rules:** `:where()` zero-specificity pseudo-class.

## Vivid colors beyond sRGB

**Source:** <https://modern-css.com/vivid-colors-beyond-srgb/>

**Description:** Use wide-gamut color functions (`oklch`, `display-p3`) for richer hues.

**Before:**

```css
.hero {
  color: #c85032;
}
```

**After:**

```css
.hero {
  color: oklch(0.7 0.25 29);
  /* or color(display-p3 1 0.2 0.1); */
}
```

**Key CSS rules:** `oklch()`, `color(display-p3 ...)`, wide-gamut color support.

## Range style queries without multiple blocks

**Source:** <https://modern-css.com/range-style-queries-without-multiple-blocks/>

**Description:** Use `@container style()` with range comparisons to react to custom property values.

**Before:**

```css
/* Multiple discrete checks or JS class toggles */
@container style(--progress: 0%) { .bar { background: red; } }
@container style(--progress: 25%) { .bar { background: orange; } }
@container style(--progress: 50%) { .bar { background: yellow; } }
```

**After:**

```css
@container style(--progress > 75%) {
  .bar { background: var(--green); }
}
```

**Key CSS rules:** `@container style()`, comparison operators (`>`, `<`, `>=`, `<=`), logical `and`.

## Color variants without Sass functions

**Source:** <https://modern-css.com/color-variants-without-sass-functions/>

**Description:** Derive variants at runtime with relative color syntax and CSS variables.

**Before:**

```css
/* Sass lighten/darken at build time */
.btn {
  background: lighten(var(--brand), 20%);
}
```

**After:**

```css
.btn {
  background: oklch(from var(--brand) calc(l + 0.2) c h);
}
```

**Key CSS rules:** Relative color syntax `oklch(from ...)`, lightness tweaks with `calc()`, runtime color computation.

## Responsive clip paths without SVG

**Source:** <https://modern-css.com/responsive-clip-paths-without-svg/>

**Description:** Create scalable clip paths with the CSS `shape()` function instead of fixed SVG paths.

**Before:**

```css
.shape {
  clip-path: path('M0 200 L100 0 L200 200 Z');
}
```

**After:**

```css
.shape {
  clip-path: shape(
    from 0% 100%,
    line to 50% 0%,
    line to 100% 100%
  );
}
```

**Key CSS rules:** `clip-path: shape()`, `from`, `line to`, responsive `%` and `vw` units.

## Scoped styles without BEM naming

**Source:** <https://modern-css.com/scoped-styles-without-bem-naming/>

**Description:** Scope selectors to a component root with `@scope` to avoid long BEM names.

**Before:**

```css
.card__title { font-size: 1.25rem; }
.card__body { color: #444; }
```

**After:**

```css
@scope (.card) {
  .title { font-size: 1.25rem; }
  .body { color: #444; }
}
```

**Key CSS rules:** `@scope (.root)` and optional boundary `@scope (.root) to (.boundary)`.
