---
type: logic
priority: medium
area: 
---

# Order discount calculation engine

## Purpose & Context

Calculates applicable discounts for customer orders based on promotion rules, customer tier, and order composition. This logic drives the checkout pricing display, promotion code validation, and revenue reporting. Features dependent on this engine include shopping cart pricing, promotional campaigns, and customer loyalty rewards.

## Actors and Roles

Describe how different roles interact with this logic (if applicable):

- **Admin**: Can trigger manual discount recalculations, view all discount audit logs, override discount limits for special cases
- **User**: Receives automatic discount calculations at checkout, views applied discounts in cart summary
- **System**: Automated execution during checkout process, scheduled recalculation for expired promotions

## Implementation Requirements

### Algorithm steps

1. Validate input order data including items, quantities, and customer identifier
2. Retrieve active promotions matching order criteria and customer segment
3. Calculate percentage discounts for each applicable promotion rule
4. Apply fixed amount discounts in priority order based on promotion tier
5. Enforce maximum discount caps and stacking rules
6. Calculate final totals and prepare detailed breakdown

### Business rules

- Percentage discounts apply to item subtotal before fixed discounts
- Customer tier discounts stack with promotional codes up to maximum 50% total
- Free shipping promotions apply only when cart total exceeds threshold after discounts
- Expired promotion codes return specific error with expiration timestamp
- Bulk discounts apply per item category with quantity breakpoints at 10, 50, and 100 units

### Role-based variations

Describe how behavior changes per role (if any):

- **Admin context**: Bypasses maximum discount caps when override flag is set, logs all overrides for audit
- **User context**: Respects all discount limits, shows only customer-facing discount descriptions

## Inputs & Outputs

### Input

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| orderId | string | Yes | Unique order identifier, UUID format |
| customerId | string | Yes | Customer identifier for tier lookup |
| items | array | Yes | List of order items with SKU, quantity, unit price |
| promotionCode | string | No | Optional promotional code for additional discounts |
| currency | string | Yes | ISO 4217 currency code, default USD |

### Output

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| subtotal | number | No | Sum of item prices before any discounts |
| discountTotal | number | No | Total amount deducted from subtotal |
| finalTotal | number | No | Amount due after all discounts applied |
| appliedDiscounts | array | No | List of discounts with type, amount, and description |
| currency | string | No | Currency code matching input |
| calculationId | string | No | Unique identifier for this calculation event |

### Performance characteristics

- **Time complexity**: O(n log n) where n is number of items plus number of active promotions
- **Space complexity**: O(n) for storing discount calculations and intermediate results
- **Max input size**: 1000 items per order, 50 active promotions
- **Timeout threshold**: 500ms maximum execution time before fallback to cached calculation

## Edge / Failure Cases

| Scenario | Input Condition | Expected Result |
|----------|-----------------|-----------------|
| Null order ID | orderId is null or undefined | ValidationError with field name and requirement |
| Empty cart | items array length is 0 | Zero totals with empty discounts array |
| Maximum items | 1000 items in order | Successful calculation within timeout threshold |
| Invalid currency | currency code not in supported list | ValidationError with supported currencies list |
| Expired promotion | promotionCode past expiration date | Discount rejected with expiration timestamp error |
| Circular tier | customer tier references itself | Detection and error with hierarchy violation details |
| Concurrent modification | order updated during calculation | Retry with optimistic locking, max 3 attempts |

## Acceptance Criteria

- [ ] Logic produces correct subtotal for single-item orders
- [ ] Logic produces correct subtotal for multi-item orders
- [ ] Logic applies percentage discounts correctly to subtotal
- [ ] Logic applies fixed amount discounts after percentage discounts
- [ ] Logic respects maximum 50% total discount cap for standard users
- [ ] Logic allows override of discount cap for admin users with audit logging
- [ ] Logic handles null order ID with ValidationError exception
- [ ] Logic handles empty cart with zero totals and no errors
- [ ] Logic handles 1000 items without timeout or memory issues
- [ ] Logic validates currency codes against supported list
- [ ] Logic rejects expired promotion codes with descriptive error
- [ ] Logic detects and prevents circular tier references
- [ ] Logic implements optimistic locking for concurrent modifications
- [ ] Logic completes within 500ms for orders up to 1000 items
- [ ] Logic uses O(n log n) time complexity for sorting promotions
- [ ] Logic uses O(n) space complexity for result storage
- [ ] Unit tests cover all valid input combinations
- [ ] Unit tests cover all identified edge cases
- [ ] Unit tests achieve 100% branch coverage
- [ ] Concurrent execution maintains thread safety with no race conditions
- [ ] Identical inputs produce identical outputs across multiple executions
- [ ] Calculation results include unique calculationId for audit trail

## Constraints / Non-goals

- Integration with external tax calculation services
- Support for cryptocurrency payment methods
- Machine learning-based dynamic pricing
- Real-time inventory reservation during calculation
