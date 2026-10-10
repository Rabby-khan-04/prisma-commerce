# Project Idea & Feature Checklist

A production-grade feature checklist for this e-commerce backend learning project.

**How to use this:** treat it as a backlog. Work top-down within each tier. A feature is only "done" when it is implemented, validated, tested, and observable — not just when the happy path works.

**What "production-grade" means here:** correct under concurrency, safe by default, handles failure and edge cases, observable, documented, and covered by automated tests.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Must Have

The minimum bar for something you could responsibly run for real users.

### Identity & Accounts
- [ ] User registration with unique email and unique username
- [ ] Secure login supporting email **or** username
- [ ] Secure logout that revokes the session server-side
- [ ] Password hashing with a strong, tunable algorithm
- [ ] Short-lived access credentials plus long-lived refresh credentials
- [ ] Refresh-token rotation with reuse detection
- [ ] Server-side refresh-token revocation and "logout from all devices"
- [ ] Role-based access control (customer, vendor, admin)
- [ ] Account activation/deactivation and disabled-account handling
- [ ] Password strength rules enforced consistently
- [ ] Generic authentication errors (no account-existence leakage)
- [ ] Timing-safe credential checks

### Catalog
- [ ] Product creation, update, and archival by vendors
- [ ] Product lifecycle states (draft, active, archived)
- [ ] Category management with a parent/child hierarchy
- [ ] Tagging of products
- [ ] Multiple product images with a primary/thumbnail image
- [ ] Pricing fields with sale/compare pricing
- [ ] Inventory/stock tracking per product
- [ ] Soft delete for catalog entities
- [ ] Public catalog listing with pagination
- [ ] Filtering and sorting (price, category, rating, recency)
- [ ] Keyword search across product name/description
- [ ] Product detail view including vendor and category

### Shopping & Cart
- [ ] Persistent cart tied to the signed-in customer
- [ ] Add, update quantity, and remove cart line items
- [ ] Cart totals computed consistently (subtotal, discounts, charges)
- [ ] Re-validation of price and stock at checkout time
- [ ] Protection against overselling under concurrent checkout

### Orders & Fulfillment
- [ ] Checkout that converts a cart into an order atomically
- [ ] Price/name/store snapshot captured on each order line
- [ ] Unique, human-readable order number generation
- [ ] Order status lifecycle (placed → processing → shipped → delivered → cancelled/returned)
- [ ] Payment status tracked separately from order status
- [ ] Shipping address captured and stored with the order
- [ ] Customer order history and single-order view
- [ ] Vendor view of their own order items
- [ ] Admin view across all orders
- [ ] Order cancellation with correct stock/refund handling
- [ ] Inventory decremented exactly once per order

### Payments
- [ ] Payment status tracking per order
- [ ] Integration with at least one real payment provider
- [ ] Provider webhook handling that is idempotent
- [ ] Verification of webhook authenticity
- [ ] Refund handling and refund status
- [ ] Failed/abandoned payment handling

### Reviews & Ratings
- [ ] Customers can rate and review purchased products
- [ ] One review per customer per product
- [ ] Aggregate product rating kept accurate
- [ ] Basic review moderation (report/hide)

### Security (cross-cutting)
- [ ] Input validation on every external input
- [ ] Centralized, consistent error handling that does not leak internals
- [ ] Auth endpoint rate limiting and brute-force protection
- [ ] CORS restricted to a configured allowlist
- [ ] Standard security headers
- [ ] Secure, HTTP-only, appropriately-scoped auth cookies
- [ ] Secrets kept out of source control and validated at startup
- [ ] Sensitive fields never returned in responses
- [ ] Sensitive data stored encrypted/hashed (tokens, secrets)
- [ ] HTTPS enforced in deployed environments
- [ ] CSRF protection strategy defined for cookie-based auth

### Data & Integrity
- [ ] Versioned schema migrations applied automatically on deploy
- [ ] Referential integrity with deliberate cascade/restrict behavior
- [ ] Appropriate indexes on all hot query paths
- [ ] Multi-step writes wrapped in transactions
- [ ] Reproducible seed data for local development
- [ ] Consistent money handling (no floating-point for currency)
- [ ] Safe handling of large numeric identifiers in responses

### Operations & Deployment
- [ ] Environment configuration validated at startup
- [ ] Separate configuration per environment (dev/stage/prod)
- [ ] Liveness and readiness checks (including database reachability)
- [ ] Graceful shutdown on termination signals with a drain timeout
- [ ] Structured logging with request correlation
- [ ] Reproducible builds and a containerized runtime
- [ ] Automated dependency installation/generation on setup
- [ ] Basic CI running checks on every change
- [ ] Database backups and a tested restore procedure

### Testing & Quality
- [ ] Unit tests for business logic
- [ ] Integration tests for the critical flows (register, login, checkout, refund)
- [ ] Automated type checking and linting
- [ ] No dead code or unused exports
- [ ] Clear project documentation and onboarding steps

---

## Good to Have

What turns a correct backend into a comfortable, maintainable product.

### Accounts & Personalization
- [ ] Email verification on signup
- [ ] Password reset via email with expiring, single-use tokens
- [ ] Multiple saved addresses with a default
- [ ] Profile editing and avatar upload
- [ ] Saved payment methods
- [ ] Wishlist / favorites
- [ ] Recently viewed products

### Catalog & Merchandising
- [ ] Product variants (size, color, etc.) with per-variant stock and pricing
- [ ] Bulk product import/export
- [ ] Related products and "customers also bought"
- [ ] Featured/promoted products and categories
- [ ] Category landing pages with banners/icons
- [ ] Full-text and fuzzy search
- [ ] Search suggestions and autocomplete
- [ ] Faceted filtering with counts
- [ ] Product Q&A
- [ ] Media stored in object storage instead of the database

### Commerce
- [ ] Coupons and discount codes (percentage, fixed, conditions)
- [ ] Promotions/campaigns with validity windows
- [ ] Tax calculation rules
- [ ] Shipping charge rules by region/weight/order value
- [ ] Guest checkout that can later link to an account
- [ ] Order notes and delivery instructions
- [ ] Shipment tracking with carrier reference
- [ ] Return/refund request workflow
- [ ] Backorder/preorder handling

### Vendors & Marketplace
- [ ] Vendor onboarding and approval workflow
- [ ] Vendor storefront and public profile
- [ ] Vendor-scoped dashboards and sales reporting
- [ ] Vendor payout/settlement reporting
- [ ] Commission/fee configuration

### Notifications & Communication
- [ ] Transactional emails (welcome, verification, reset, order confirmation, shipping)
- [ ] In-app notifications
- [ ] Templated, localized email content
- [ ] Configurable notification preferences

### Platform & Developer Experience
- [ ] API versioning strategy
- [ ] Interactive API documentation (OpenAPI)
- [ ] Consistent pagination, filtering, and sorting conventions
- [ ] Idempotency keys for unsafe/retryable operations
- [ ] Background jobs for emails, invoices, cleanup, and retries
- [ ] Invoice/receipt generation
- [ ] Caching of hot read paths
- [ ] Audit log of sensitive/admin actions
- [ ] Feature flags for gradual rollout
- [ ] Admin analytics (sales, users, inventory)

---

## Advanced

Ambitious, high-leverage capabilities once the platform is stable.

### Scale & Architecture
- [ ] Stateless services that scale horizontally
- [ ] Event-driven flows with a message queue/broker
- [ ] Reliable background workers with retries and dead-letter handling
- [ ] Saga/compensating flows for multi-step distributed transactions
- [ ] Read/write separation or CQRS for reporting
- [ ] Dedicated search engine for large catalogs
- [ ] Service decomposition (catalog, orders, payments, identity) behind a gateway
- [ ] Multi-region or multi-tenant deployment

### Reliability & Resilience
- [ ] Circuit breakers and timeouts for external providers
- [ ] Retry with backoff and idempotent consumers
- [ ] Load testing with defined SLOs
- [ ] Chaos/failure-injection exercises
- [ ] Zero-downtime (expand/contract) migrations
- [ ] Blue-green or canary deployments with automated rollback
- [ ] Disaster recovery plan with regular drills

### Observability
- [ ] Distributed tracing across services
- [ ] Metrics dashboards and alerting on SLOs
- [ ] Error tracking with release tagging
- [ ] Log aggregation and searchable structured events
- [ ] Real-user and synthetic monitoring

### Security & Compliance
- [ ] Automated security scanning (dependencies, SAST/DAST)
- [ ] Penetration testing and threat modeling
- [ ] Web application firewall / edge protection
- [ ] Fraud and abuse detection
- [ ] PCI-aligned handling of card data
- [ ] Data privacy controls (export, deletion, consent) and retention policy
- [ ] Fine-grained permissions/policy engine (beyond simple roles)

### Intelligence & Experimentation
- [ ] Personalized recommendations
- [ ] A/B testing and experimentation platform
- [ ] Pricing/discount optimization
- [ ] Demand forecasting and inventory planning
- [ ] Analytics pipeline for product and business insight

### Reach
- [ ] Multi-currency and multi-language support
- [ ] Localized pricing, tax, and content
- [ ] Storefront accessibility compliance
- [ ] Mobile/partner APIs (GraphQL or gRPC)
- [ ] Public webhooks for vendors and integrations

---

## Suggested Sequence

1. Complete every Must Have for Identity, Catalog, Cart, and Orders.
2. Add Payments with idempotent webhooks and refunds.
3. Harden Security, Data Integrity, Operations, and Testing.
4. Layer in Good to Have starting with the ones that unblock revenue (coupons, variants, notifications, API docs).
5. Pursue Advanced items only when the platform is stable and observed.
