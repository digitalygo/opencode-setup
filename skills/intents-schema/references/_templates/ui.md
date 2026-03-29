---
type: ui
priority: medium
area: 
---

# Data table component

## Purpose & Context

Display tabular data with sorting, filtering, and pagination capabilities. This component solves the problem of presenting large datasets in a scannable, interactive format while maintaining performance and accessibility standards.

## Actors and Roles

Define who uses this component and what they can see/do:

- **Admin**: Full permissions to view all columns, bulk actions, export data, and modify records
- **Editor**: Can view assigned columns, edit own records, limited bulk operations on permitted items
- **Viewer**: Read-only access to specific columns, no editing capabilities, can sort and filter
- **Guest**: Public-facing view with limited columns visible, no interaction beyond basic sorting

## Desired Behavior

### Visual States

- **Default**: Clean table layout with alternating row colors, visible headers, standard 14px text
- **Hover**: Row background lightens, cursor changes to pointer on interactive cells, action buttons appear
- **Focus**: Blue outline on keyboard navigation, visible focus ring on sortable headers, selected row highlight
- **Active/Selected**: Row background changes to brand color at 10% opacity, checkbox checked, bulk action bar appears
- **Disabled**: Grayed-out rows with reduced opacity, non-interactive cells, tooltip explaining restriction
- **Loading**: Skeleton rows with animated gradient, disabled sorting controls, progress indicator in header
- **Error**: Red border on affected rows, error icon in status column, inline error message below table
- **Empty**: Centered illustration with message, call-to-action button for adding data, helpful documentation link

### Interactions

- **Click**: Selects row, triggers navigation to detail view, activates inline editing for editable cells
- **Double click**: Opens detail modal or navigates to full page view for the selected record
- **Hover**: Reveals action buttons, displays full text in truncated cells via tooltip, highlights sortable columns
- **Keyboard**: Tab navigates between cells, Enter activates row selection or editing, Arrow keys move between rows, Space toggles row selection
- **Touch**: Tap selects row, long press for context menu, swipe left for quick actions, pinch to adjust column widths

### Responsive Behavior

- **Desktop (>=1024px)**: Full table with all columns visible, horizontal scrolling for overflow, fixed header on scroll
- **Tablet (768-1023px)**: Priority columns visible, expandable rows for additional data, touch-optimized row heights
- **Mobile (<768px)**: Card-based layout instead of table, essential columns only, swipe gestures for actions, bottom sheet for filters

## Edge / Failure Cases

- **Zero records**: Display empty state illustration with "No data available" message and add record button
- **Single record**: Table renders with one row, pagination hidden, bulk actions disabled
- **Maximum records reached**: Show warning banner, disable add button, provide archive option
- **Slow connection**: Display skeleton for 500ms, then loading spinner, progress indicator for large datasets
- **Permission denied**: Hide restricted columns, show lock icon with tooltip, graceful degradation of features
- **Network timeout**: Display error state with retry button, preserve current filter/sort state, offline indicator

## Acceptance Criteria

- [ ] Component displays correctly at desktop breakpoint with minimum 1024px width
- [ ] Component adapts to tablet layout between 768px and 1023px width
- [ ] Component transforms to card view below 768px width
- [ ] Default state shows clear data structure with readable typography
- [ ] Hover state provides visual feedback on all interactive elements
- [ ] Focus state has visible 2px outline meeting WCAG focus indicator requirements
- [ ] Active/Selected state distinguishes selected rows from unselected rows
- [ ] Disabled state clearly indicates non-interactive elements
- [ ] Loading state uses skeleton screens matching final layout
- [ ] Error state displays inline without breaking layout
- [ ] Empty state provides clear next steps for users
- [ ] Tab key navigates through all interactive elements in logical order
- [ ] Enter key activates primary action on focused element
- [ ] Arrow keys navigate between table cells when in cell navigation mode
- [ ] Screen reader announces column headers when navigating cells
- [ ] Screen reader announces sort order changes
- [ ] Screen reader announces row selection state
- [ ] Color contrast ratio is at least 4.5:1 for normal text
- [ ] Color contrast ratio is at least 3:1 for large text and UI components
- [ ] Touch targets are minimum 44x44 pixels on mobile devices
- [ ] Loading states display within 100ms of interaction
- [ ] Error states provide actionable error messages

## Constraints / Non-goals

- Complex animations or transitions between states
- Advanced spreadsheet-style cell formulas
- Real-time collaborative editing within table cells
- Custom theming beyond provided color variables
