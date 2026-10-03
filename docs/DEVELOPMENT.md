# Working on ProduceWise

Use Node.js 22.12+ and pnpm. Install with `pnpm install --frozen-lockfile`.

## Run and verify

```sh
pnpm dev --background
pnpm exec astro dev status
pnpm exec astro dev logs
pnpm exec astro dev stop

pnpm check
pnpm build
pnpm test
pnpm test:browser
```

The browser suite runs a local production server on port 4323. Locally it uses installed Google Chrome; with `CI=true` it uses Playwright Chromium (`pnpm exec playwright install chromium`). Mobile checks emulate an iPhone-sized Chromium viewport; they do not certify Safari or physical-device installation. To capture review images, run `CAPTURE_REVIEW=1 pnpm test:browser --grep 'horizontal overflow'`.

For full offline behavior, review the production build:

```sh
pnpm build
pnpm exec astro preview --background --port 4324
```

Astro disables the service worker during development to avoid stale assets. Use HTTPS in production (localhost works for development). The static host must serve `dist`, support directory index URLs, return `404.html` for missing pages, and serve `sw.js` without long-lived immutable caching. Host at the origin root; subdirectory hosting is not configured. A public domain, canonical URL, absolute sharing-image URL, deployment workflow, and physical-device install checks belong to the launch milestone.

## Content layout

- `src/content/produce/*.json`: one structured editorial entry per stable slug.
- `src/content/nutrition/approved.json`: independently reviewed USDA nutrition.
- `src/content/stories/*.md`: optional longer editorial content, linked by collection reference.
- `src/content.config.ts`: validated content and cross-collection references.
- `src/assets/produce/`: originals, converted to optimized WebP during builds.
- `data/usda-selections.json`: explicitly matched USDA IDs, food forms, descriptions, and selection rationale.
- `data/source-snapshots/usda-starter.json`: original USDA responses used for starter verification.

Copy an existing entry with comparable storage conditions. Keep an existing slug stable. Add aliases including singular/plural and relevant regional names. Culinary categories are used for navigation. Each condition supplies location, preparation, time estimate, caution, and source IDs. Add optional freezing, history, fun facts, seasonality, and additional imagery only when researched. Seasonality requires a region. The schema supports future content independently of the current templates.

Record source scope and review date when checking factual claims. Safety guidance must come from an appropriate authoritative source. Keep quality estimates distinct from safety limits. Credit every photo with its original source, creator, license, and modifications; include any required license text. Do not paste unlicensed search-result images into the repository.

## Nutrition import and approval

Normal builds use only approved local files. No network request to USDA runs in `pnpm build`; an API key is not required. The starter contains eight Foundation Foods records and two SR Legacy records (spinach and potato), selected for the food form described in each guide. Raw data, displayed values, units, and missing values have been cross-checked automatically. The initial source review is explicitly AI-assisted; owner editorial review remains pending.

1. Verify the selected record on FoodData Central. Check description, raw/cooked state, edible portion, peel, variety, data type, and publication date. Update the selection file only deliberately.
2. Set `USDA_API_KEY` in your shell environment using your normal secret-management method. Never place it in content, client code, a command committed to the repository, or a public-prefixed environment variable. The import command reads the process environment, not Astro's `.env` loader.
3. Run `pnpm nutrition:import`. It fetches only selected IDs and atomically writes a complete validated proposal to ignored `data/nutrition-proposals/latest.json`. Rate limits, network failures, mismatched records, and incomplete responses fail without replacing approved data.
4. Review `git diff --no-index src/content/nutrition/approved.json data/nutrition-proposals/latest.json` (a diff exits with code 1 when differences exist). Check every value and source label, not just schema validity. Missing nutrients must remain null. Energy preference is USDA Atwater specific factors, then reported Energy, then Atwater general factors; the retained nutrient ID identifies the exact measure.
5. Only after that review, run `pnpm nutrition:approve "Reviewer name"`. It validates the complete proposal against selections and atomically replaces approved JSON, recording reviewer and review date.
6. Review the resulting Git diff and run `pnpm check`, `pnpm build`, and `pnpm test` before publishing it. If changing the selected source baseline, retain a new raw snapshot and update the source-comparison tests deliberately.

The tool does not retry rate limits automatically or approve proposals during a build. Nutrient values are per 100 g edible portion. Missing data displays as “Unavailable”; no supplementary records are currently mixed in.

## Offline behavior

A favorite persists in local storage and attempts a separate download of its complete guide, nutrition, photo, and required assets. Only a complete cache receives “Ready offline.” Saving without storage access fails visibly. An interrupted download can be retried on Saved guides. Removing a favorite removes its downloaded guide; startup also reconciles leftover caches.

The generated service worker versions the shell and guide dependencies from the built content. An old complete guide remains available if refreshing fails. Use “Refresh offline guides” to fetch saved entries for the active worker version after an update. A deployment that changes asset references mid-download is rejected until the page/worker updates. Browser storage can be evicted, so offline availability is checked again whenever the site opens. Favorites are browser-specific and do not sync across devices.

The shell and compact name/alias search remain usable offline. Unsaved guide pages show a connection-needed fallback. External source pages require a connection. Photos are downloaded per saved guide; catalog thumbnails for unsaved items can be unavailable offline and use a visual fallback.
