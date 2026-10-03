# ProduceWise

## Brief

ProduceWise helps a broad English-speaking audience answer “How should I store this?” in seconds, at home or in a grocery store. Learning about produce supports that primary purpose. The first working release contains 10 guides, evenly split between fruits and vegetables. The eventual launch target is 40–60 entries, after the owner agrees to the expansion list.

## Decisions — 3 October 2026

- Astro 7, TypeScript, static output. Plain CSS and small browser scripts; no UI framework, database, accounts, or CMS.
- Validated local JSON for structured editorial content and approved nutrition; Markdown for optional longer articles. Stable slugs and collection references keep a future CMS possible.
- USDA Foundation Foods preferred; SR Legacy used when it better matches the intended food form. Nutrition import is an explicit development command, never part of the website build. Proposed data and approved data are separate.
- Home, browse/search, produce guides, device-local favorites, and about/sources are primary routes.
- Fern green and citrus lime anchor the brand; soft per-produce accents and licensed photography provide color. Storage labels never depend on color alone.
- Browser favorites and visibly confirmed offline downloads. Local assets, guide HTML and nutrition are cached together. Storage failures must be visible.
- Storage times are quality estimates, not safety guarantees. Record sources and review dates. Optional unresearched sections remain absent.
- Domain is not configured. Confirm exact spelling with the owner before launch, despite the working directory name.
- Hosting recommendation will be chosen when ready to launch; no account, paid service, deployment, or DNS changes without the owner’s decision.

## Milestones

- [x] 1. Scope, architecture, content policy, and milestone checklist
- [x] 2. Validated produce/nutrition schemas and contrasting starter entries
- [x] 3. Responsive visual system and reusable components
- [x] 4. Home, browse/search, detail, favorites, about navigation
- [x] 5. Static shell, metadata, missing-page and image handling
- [x] 6. Reviewed starter content and separate USDA import/review workflow
- [x] 7. Name/alias search and fruit/vegetable filters
- [x] 8. Favorites with persistence and storage-error handling
- [ ] 9. Owner agreement on expansion list, then 40–60 reviewed entries
- [x] 10. Manifest/icons and installation support (physical-device verification remains a launch task)
- [x] 11. Offline saved guides and refresh/removal behavior
- [x] 12. Automated behavioral checks and manual responsive review
- [ ] Launch: domain confirmation, hosting selection, deployment automation, physical-device installation check

## Starter set

Fruit: avocado, banana, strawberry, blueberry, mango. Vegetables (culinary categories): spinach, potato, carrot, eggplant/aubergine, zucchini/courgette. Five of each keeps browsing balanced. Do not expand until this set works end to end.

## Proposed expansion (owner approval pending)

Apples, pears, oranges, lemons, limes, grapefruit, grapes, peaches, nectarines, plums, cherries, raspberries, blackberries, pineapple, kiwi, watermelon, cantaloupe, pomegranate, apricots, papaya; broccoli, cauliflower, cabbage, kale, lettuce, cucumber, bell pepper, tomato, onion, garlic, sweet potato, beetroot, radish, celery, asparagus, green beans, peas, leek, butternut squash, mushrooms.

## Content policy

Use USDA for nutrition, FDA/USDA FSIS for safety, university extension guidance and identified commodity boards for storage. Nutrition is representative of the labeled source form per 100 g edible portion, not an individualized claim. Missing nutrients are null and displayed as unavailable. Never mix nutrients from different records silently. Dates record source checking, not a claim of independent expert certification. Image credits include author, original file page, license, and any transformations. Recipe suggestions are editorial ideas; detailed preservation steps need a source.

## Development

`pnpm dev --background` starts Astro’s managed background server. Use `pnpm exec astro dev status`, `pnpm exec astro dev logs`, and `pnpm exec astro dev stop` to manage it. `pnpm build` must work with no USDA key and makes no USDA requests.

## Starter review handoff

The owner chose to review the 10-guide starter before expansion. The proposed 50-item list is a backlog, not approved scope. No hosting account, DNS configuration, public deployment, or dataset expansion has been performed.

The starter includes all primary pages, five fruits and five vegetables, name/alias search, category filters, condition-specific storage advice, licensed local photography, locally approved USDA nutrition with provenance, favorites, and offline downloads. Optional trivia/history remains intentionally sparse. Storage and nutrition source review is AI-assisted; completion of the implementation milestone does not mean owner content sign-off.

Review the visual direction, storage wording and source choices, nutrition food forms, and saved/offline behavior before agreeing on expansion. See [development and editorial workflow](DEVELOPMENT.md) and [verification record](VALIDATION.md).
