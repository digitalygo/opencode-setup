# Modern CSS Snippets — Set 2

Reference summaries for the modern-css.com snippets (set 2). Each entry captures the legacy approach (Before), the modern CSS alternative (After), and the key rules involved.

## Scroll-linked animations without a library

**Source:** <https://modern-css.com/scroll-linked-animations-without-a-library/>

**Description:** Trigger animations based on scroll position with pure CSS timelines.

**Before:**

```javascript
const obs = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) e.target.classList.add('visible');
  });
});

document.querySelectorAll('.reveal').forEach((el) => obs.observe(el));
```

**After:**

```css
@keyframes reveal {
  from { opacity: 0; translate: 0 40px; }
  to { opacity: 1; translate: 0 0; }
}

.reveal {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}
```

**Key CSS rules:** `animation-timeline: view()`, `animation-range`, and `@keyframes`.

## Scroll snapping without a carousel library

**Source:** <https://modern-css.com/scroll-snapping-without-a-carousel-library/>

**Description:** Use native scroll snapping for carousels without JS libraries.

**Before:**

```javascript
import Swiper from 'swiper';
new Swiper('.carousel', { slidesPerView: 1.2, spaceBetween: 16 });
```

**After:**

```css
.carousel {
  scroll-snap-type: x mandatory;
  overflow-x: auto;
  display: flex;
  gap: 1rem;
}

.carousel > * {
  scroll-snap-align: start;
}
```

**Key CSS rules:** `scroll-snap-type`, `scroll-snap-align`, `overflow-x: auto`.

## Scroll spy without IntersectionObserver

**Source:** <https://modern-css.com/scroll-spy-without-intersection-observer/>

**Description:** Highlight the current section in nav using CSS scroll targeting only.

**Before:**

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const link = document.querySelector(`a[href="#${entry.target.id}"]`);
    link.classList.toggle('active', entry.isIntersecting);
  });
}, { threshold: 0.5 });

document.querySelectorAll('section').forEach((s) => observer.observe(s));
```

**After:**

```css
.scroller { overflow-y: auto; }
nav a:target-current { color: var(--accent); }
```

**Key CSS rules:** `:target-current`, `scroll-target-group`.

## Sticky & snapped styling without JavaScript

**Source:** <https://modern-css.com/sticky-snapped-styling-without-javascript/>

**Description:** React to sticky and snap states with scroll-state container queries.

**Before:**

```javascript
const header = document.querySelector('.header');
const offset = header.offsetTop;

window.addEventListener('scroll', () => {
  header.classList.toggle('stuck', window.scrollY >= offset);
});
```

**After:**

```css
.header-wrap { container-type: scroll-state; }

@container scroll-state(stuck: top) {
  .header { box-shadow: 0 2px 8px #0002; }
}
```

**Key CSS rules:** `container-type: scroll-state`, `@container scroll-state()`, `stuck`, `snapped`.

## Preventing layout shift from scrollbar appearance

**Source:** <https://modern-css.com/preventing-layout-shift-from-scrollbar/>

**Description:** Reserve scrollbar space to avoid layout jumps.

**Before:**

```css
body { overflow-y: scroll; }
/* or */
body { padding-right: 17px; }
```

**After:**

```css
body { scrollbar-gutter: stable; }
```

**Key CSS rules:** `scrollbar-gutter: stable`, `stable both`.

## Scrollbar styling without -webkit- pseudo-elements

**Source:** <https://modern-css.com/scrollbar-styling-without-webkit-pseudo-elements/>

**Description:** Style scrollbars with standard properties across browsers.

**Before:**

```css
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-thumb { background: #888; }
```

**After:**

```css
* {
  scrollbar-width: thin;
  scrollbar-color: #888 transparent;
}
```

**Key CSS rules:** `scrollbar-width`, `scrollbar-color`.

## Staggered animations without nth-child hacks

**Source:** <https://modern-css.com/staggered-animations-without-nth-child-hacks/>

**Description:** Auto-index elements for staggered delays with `sibling-index()`.

**Before:**

```css
li:nth-child(1) { --i: 0; }
li:nth-child(2) { --i: 1; }
li:nth-child(3) { --i: 2; }
li { transition-delay: calc(0.1s * var(--i)); }
```

**After:**

```css
li {
  transition: opacity 0.25s ease, translate 0.25s ease;
  transition-delay: calc(0.1s * (sibling-index() - 1));
}
```

**Key CSS rules:** `sibling-index()`, `sibling-count()`.

## Entry animations without JavaScript timing

**Source:** <https://modern-css.com/entry-animations-without-javascript-timing/>

**Description:** Define entry start state in CSS with `@starting-style` instead of JavaScript double-RAF.

**Before:**

```css
.card { opacity: 0; transform: translateY(10px); }
.card.visible { opacity: 1; transform: none; }
```

```javascript
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    el.classList.add('visible');
  });
});
```

**After:**

```css
.card {
  transition: opacity 0.3s, transform 0.3s;

  @starting-style {
    opacity: 0;
    transform: translateY(10px);
  }
}
```

**Key CSS rules:** `@starting-style` at-rule.

## Dark mode colors without duplicating values

**Source:** <https://modern-css.com/dark-mode-colors-without-duplicating-values/>

**Description:** Supply light and dark values in one declaration with `light-dark()`.

**Before:**

```css
:root { --text: #111; --bg: #fff; }

@media (prefers-color-scheme: dark) {
  :root { --text: #eee; --bg: #222; }
}
```

**After:**

```css
:root {
  color-scheme: light dark;
  color: light-dark(#111, #eee);
}
```

**Key CSS rules:** `light-dark()`, `color-scheme`.

## Multiline text truncation without JavaScript

**Source:** <https://modern-css.com/multiline-text-truncation-without-javascript/>

**Description:** Clamp text to a set number of lines with pure CSS.

**Before:**

```javascript
const max = 120;
el.textContent = text.slice(0, max) + '...';
```

**After:**

```css
.card-title {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
}
```

**Key CSS rules:** `line-clamp`, `-webkit-line-clamp`, `display: -webkit-box`.

## Custom easing without cubic-bezier guessing

**Source:** <https://modern-css.com/custom-easing-without-cubic-bezier-guessing/>

**Description:** Use `linear()` to author detailed easing curves without JavaScript libraries.

**Before:**

```javascript
anime({ targets: el, translateY: -20, easing: 'easeOutBounce' });
```

**After:**

```css
.el {
  transition: transform 0.6s linear(0, 1.2 60%, 0.9, 1.05, 1);
}
```

**Key CSS rules:** `linear()` easing function with percentage hints.

## Direction-aware layouts without left/right

**Source:** <https://modern-css.com/direction-aware-layouts-without-left-and-right/>

**Description:** Use logical properties so layouts work in both LTR and RTL.

**Before:**

```css
.box { margin-left: 1rem; padding-right: 1rem; }

[dir="rtl"] .box {
  margin-left: 0;
  margin-right: 1rem;
}
```

**After:**

```css
.box {
  margin-inline-start: 1rem;
  padding-inline-end: 1rem;
  border-block-start: 1px solid;
}
```

**Key CSS rules:** `margin-inline-start`, `padding-inline-end`, `border-block-start`, logical properties.

## Media query ranges without min/max syntax

**Source:** <https://modern-css.com/media-query-ranges-without-min-max-syntax/>

**Description:** Use comparison operators in media queries for concise ranges.

**Before:**

```css
@media (min-width: 600px) and (max-width: 1200px) {
  .card { grid-template-columns: 1fr 1fr; }
}
```

**After:**

```css
@media (600px <= width <= 1200px) {
  .card { grid-template-columns: 1fr 1fr; }
}
```

**Key CSS rules:** Range syntax with `<`, `<=`, `>`, `>=` operators.

## Responsive images without the background-image hack

**Source:** <https://modern-css.com/responsive-images-without-background-image-hack/>

**Description:** Use `<img>` with `object-fit` instead of background-image placeholders.

**Before:**

```html
<div class="card-image"></div>
```

```css
.card-image {
  background-image: url(photo.jpg);
  background-size: cover;
  background-position: center;
}
```

**After:**

```html
<img src="photo.jpg" alt="..." loading="lazy">
```

```css
img {
  object-fit: cover;
  width: 100%;
  height: 200px;
}
```

**Key CSS rules:** `object-fit`, `object-position`.

## Perceptually uniform colors with oklch

**Source:** <https://modern-css.com/perceptually-uniform-colors-with-oklch/>

**Description:** Build palettes in oklch for consistent lightness across hues.

**Before:**

```css
--yellow: hsl(60 100% 50%);
--blue: hsl(240 100% 50%);
--brand-light: hsl(246 87% 68%);
```

**After:**

```css
--brand: oklch(0.55 0.2 264);
--brand-light: oklch(0.75 0.2 264);
--brand-dark: oklch(0.35 0.2 264);
```

**Key CSS rules:** `oklch(L C H)` color function.
