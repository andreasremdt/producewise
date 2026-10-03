# Starter verification — 3 October 2026

## Completed

- Production build: 16 static pages, a compact search index, optimized local photos, and a versioned service worker. Build succeeds with saved nutrition and no USDA API key. The generated website is approximately 1 MB before compression.
- `pnpm check`: 30 files, zero errors, warnings, or hints.
- `pnpm test`: 15 passing checks. Covers aliases/case/whitespace, corrupt favorites, exact USDA snapshot values and units, null nutrients, food-form validation, complete/failed/rate-limited imports, preservation of approved data, balanced starter content, generated secret checks, complete offline downloads, failed refresh preservation, quota errors, removal/sync, rapid save/remove, and dependencies changing during deployment.
- Browser behavior: all 14 checks pass across desktop Chrome and an iPhone-sized Chromium viewport. Covers alias search/filter/recovery, condition advice and summary changes, unchanged nutrition food form, favorites across reload, complete offline guide/photo/nutrition, uncached-page fallback, cache removal, denied local storage, missing pages, empty states, keyboard search, skip-link focus, image loading, and horizontal overflow.
- Automated accessibility: both desktop and mobile axe WCAG 2 A/AA and 2.1 AA checks pass on home, browse, avocado detail, saved guides, and About. These are automated checks, not a claim of full WCAG conformance.
- Visual review: desktop, mobile, and tablet homepage and produce-page layouts inspected. Tablet width (768 px) is included in the automated layout checks alongside 1440 px desktop and 390 px mobile.
- `git diff --check`: no whitespace errors.

The browser suite was rerun selectively after fixes: all behavior checks passed together; accessibility and responsive-layout checks were then rerun after their final styling fixes. No nutrition network access is used by these tests. Local browser tests use an isolated test profile and do not change the owner's saved guides.

## Review artifacts

- [Desktop homepage](screenshots/home-desktop.png)
- [Mobile homepage](screenshots/home-mobile.png)
- [Desktop avocado guide](screenshots/avocado-desktop.png)
- [Mobile avocado guide](screenshots/avocado-mobile.png)

Use the production preview for offline review (`pnpm exec astro preview --background --port 4324`). Save a guide, wait for “Ready offline,” then disconnect and open it from Saved guides. Favorites in the development server and production preview are separate because browser storage is scoped by origin/port.

## Outstanding decisions and limitations

- Owner review of the 10-guide visual direction and content is the next milestone. Expansion to 40–60 entries is intentionally deferred.
- Editorial and USDA source review is AI-assisted. The source descriptions, timestamps, selection rationales, and citations are visible; independent owner/expert content sign-off has not occurred.
- Safari, Firefox, physical Android/iPhone installation, real-device storage eviction, and screen-reader testing remain unverified. A manifest and service worker alone do not certify every browser's installation experience.
- Optional history, fun facts, and regional seasonality are not populated uniformly. Unresearched sections are omitted. No fabricated nutrient values or placeholder factual claims are published.
- Images carry visible credits and license links; three GFDL images include the full license. Original photos can show particular varieties; the eggplant guide explicitly labels its striped example.
- Domain spelling, public hosting, absolute canonical/social URLs, deployment automation, and public launch require owner decisions. No deployment or DNS change has been made.
