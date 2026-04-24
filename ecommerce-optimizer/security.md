# Security Notes

This document explains the main security concerns we identified in this project, what we implemented to mitigate them, and how each mitigation works in practice.

## Scope

- Backend stack: Node.js + Express + Prisma + PostgreSQL
- Primary files: `backend/index.js`, `backend/middleware/auth.js`, `backend/routes/*.js`, `backend/services/*.js`, `backend/prisma/schema.prisma`

## 1) Brute-force login and signup attempts

**Concern (before hardening):**
- Attackers could repeatedly call authentication endpoints and guess credentials.

**Mitigation used:**
- `express-rate-limit` on auth endpoints (`/api/users/login` and user signup `POST /api/users`).

**How we did it:**
- In `backend/index.js`, `createAuthLimiter()` is configured for a 15-minute window with a max of 10 attempts.
- Separate limiters are applied to login and signup flows.
- When exceeded, API returns: `Too many authentication attempts. Try again later.`

## 2) Weak password storage

**Concern (before hardening):**
- Storing plaintext passwords would expose all users if DB is leaked.

**Mitigation used:**
- `bcryptjs` hashing before storing passwords.

**How we did it:**
- In `backend/routes/userRoutes.js`, passwords are hashed with `bcrypt.hash(password, 10)` on user creation and password change.
- During login, `bcrypt.compare()` verifies credentials against hash.
- Password hashes are never returned in API responses.

## 3) User enumeration through login behavior

**Concern (before hardening):**
- Attackers can detect whether an email exists based on faster responses or different errors.

**Mitigation used:**
- Dummy hash comparison for non-existing users.

**How we did it:**
- In `backend/routes/userRoutes.js`, login always runs `bcrypt.compare(password, user?.password || DUMMY_HASH)`.
- This keeps timing behavior closer between existing and non-existing accounts and returns the same error message for both.

## 4) Unauthorized API access

**Concern (before hardening):**
- Endpoints could be called without a valid user identity.

**Mitigation used:**
- JWT-based authentication middleware.

**How we did it:**
- `backend/middleware/auth.js` validates `Authorization: Bearer <token>` via `jwt.verify(...)`.
- Missing/invalid/expired tokens return `401`.
- `JWT_SECRET` is required at runtime; startup throws if not configured for token operations.

## 5) Privilege escalation (role misuse)

**Concern (before hardening):**
- Normal users could access admin/vendor operations.

**Mitigation used:**
- Role-based authorization middleware (`requireRole`) and ownership checks (`isOwnerOrRole`).

**How we did it:**
- Sensitive routes (promotions, category management, order admin actions, user list/delete, etc.) are protected with `authenticateJwt` + `requireRole(...)`.
- User profile/password actions use owner-or-admin checks.

## 6) Excessive API attack surface (headers, origins, payload size)

**Concern (before hardening):**
- Missing security headers, open CORS policy, and unlimited JSON payloads increase risk.

**Mitigation used:**
- `helmet()` for common secure headers.
- CORS allowlist using `CORS_ORIGIN` env.
- Request body size cap: `express.json({ limit: '100kb' })`.

**How we did it:**
- In `backend/index.js`, only explicitly allowed origins are accepted.
- Disallowed origins return CORS error handling (`403`).
- Payload size limit helps reduce abuse and memory-pressure attacks.

## 7) Invalid promotion data and discount abuse

**Concern (before hardening):**
- Invalid date ranges, negative discount values, and malformed promo input could be persisted and abused.

**Mitigation used:**
- Central validation/normalization in `promotionService`.

**How we did it:**
- In `backend/services/promotionService.js`:
  - `discountPercentage` must be positive.
  - `startDate` and `endDate` are required and validated (`endDate >= startDate`).
  - Promotion `type` is restricted to `EVENT`, `CATEGORY`, `PRODUCT`.
  - `promoCode` required only for `EVENT` and normalized to uppercase.
  - Category/Product targets are validated against existing active records.
- In `backend/routes/promotionRoutes.js`, all create/update calls pass through these validators.

## 8) Inconsistent stock state from concurrent order updates

**Concern (before hardening):**
- Race conditions can oversell stock or desynchronize product and inventory quantities.

**Mitigation used:**
- Transactional stock updates and adjustment ledger.

**How we did it:**
- In `backend/routes/orderRoutes.js`, order placement and status restock logic run in `prisma.$transaction(...)`.
- In `backend/services/inventoryService.js`, stock decrement uses guarded `updateMany` with `stockLevel >= requested` unless explicitly allowed.
- `InventoryAdjustment` records each change; schema has unique constraint `@@unique([orderId, productId, reason])` to prevent duplicate per-order adjustments.
- Product `stockQuantity` is synchronized as a mirror after inventory updates.

## 9) Duplicate or conflicting identity fields

**Concern (before hardening):**
- Duplicate users/products/promo codes can create account confusion or code hijacking.

**Mitigation used:**
- Database uniqueness constraints + API conflict handling.

**How we did it:**
- In `backend/prisma/schema.prisma`: unique constraints on `User.email`, `Product.sku`, `Promotion.promoCode`, `Category.name`, and one `Inventory` per product.
- API catches Prisma `P2002` and returns friendly conflict errors (for example, duplicate email or promo code).

## 10) Unsafe default admin behavior

**Concern:**
- Automatic default admin bootstrapping can be risky if defaults are unchanged.

**Mitigation used:**
- Environment-driven admin credentials and optional reset behavior.

**How we did it:**
- `ensureDefaultAdmin()` in `backend/index.js` uses env vars (`ADMIN_EMAIL`, `ADMIN_DEFAULT_PASSWORD`, `FORCE_ADMIN_RESET_ON_STARTUP`).
- Password is hashed before storage.
- This is intended for controlled environments; production should always set secure secret values.

## Security practices to keep

- Always set strong env vars in production:
  - `JWT_SECRET`
  - `CORS_ORIGIN`
  - `ADMIN_DEFAULT_PASSWORD` (if bootstrap is enabled)
- Keep `helmet`, rate limiting, and auth middleware enabled.
- Keep all write routes behind input validation.
- Keep stock updates inside DB transactions.
- Rotate secrets if exposed.

## Remaining hardening opportunities

These are not regressions, but future improvements:

- Add refresh-token rotation/revocation strategy.
- Add account lockout/step-up controls after repeated failed logins.
- Add audit logging for auth failures and admin-sensitive operations.
- Add dependency vulnerability scanning in CI.

