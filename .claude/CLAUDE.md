# Buzz Off website — Claude Code guide

buzzoffapp.com is the marketing site for **Buzz Off**, an iOS app that helps people quit or cut back on caffeine (Cold Turkey, or Gradual with a weekly reduction plan). The site's jobs, in order: send people to the App Store, rank for the caffeine questions people search, and host the legal pages the App Store listing links to.

Corey is the solo founder. A separate Claude chat (the "dev manager") writes the prompts for this session and reviews its plans and reports.

The redesign and SEO brief is `.claude/docs/website-brief.md`: read it before planning any page.

## How it's hosted (read this first)

- Static files on **Cloudflare Pages**, project `buzzoff-site`, built from the repo `github.com/coreyde/buzzoff-site`. Live at `https://buzzoffapp.com` (and `https://buzzoff-site.pages.dev`).
- **A push to `main` deploys to the live site within minutes.**
- **Every pushed branch gets a preview deploy** at `https://<branch>.buzzoff-site.pages.dev` (Cloudflare turns `/` and other non-alphanumerics into `-`, e.g. `chore/cloudflare-pages` → `chore-cloudflare-pages.buzzoff-site.pages.dev`). Put the branch's preview URL in every report, after checking it loads.
- Cloudflare settings (set by Corey): build command `sh .claude/scripts/build-pages.sh`, output directory `public`.
- **The build script decides what's public.** Cloudflare doesn't run Jekyll; it serves every file in `public/`. `build-pages.sh` copies the repo into `public/` minus anything starting with a dot (`.claude/`, `.git*`), all Markdown files and `CNAME`, and fails if a required page is missing or a private file slips in. Internal notes, plans and specs still go in `.claude/`. A new kind of non-public file needs a rule in `build-pages.sh` (and the matching `published()` in `serve.py`). `public/` is git-ignored.
- Clean URLs: Cloudflare 308-redirects `/x.html` to `/x` and `/x/index.html` to `/x/`, and `/x` to `/x/` for folders. Canonicals, the sitemap, `llms.txt` and internal links use the final URLs (`/privacy-policy`, `/terms`, `/contact`, `/faq/`, `/guides/<slug>/`); the checker fails on links that redirect. Old `.html` URLs keep working through the redirect. Unknown paths get `404.html` with status 404.
- `buzzoffapp.com` and `www.buzzoffapp.com` are attached to Cloudflare Pages and served from there for most visitors. GitHub Pages stays on until about 28 Nov 2026 while every DNS resolver switches over; then the dev manager turns it off and makes the repo private. Until then `CNAME` stays in the repo (the build leaves it out), and the clean URLs above work on both.
- The repo is public now and will become private. Until it is, assume everything in it is public: never commit revenue, user data, internal plans, keys or tokens.

## Stack

- Plain HTML pages, no `package.json`. The only build step is `build-pages.sh`, which copies files and changes nothing.
- Hand-written CSS: `assets/css/site.css` (design tokens from the app's `constants/theme.ts` as CSS variables, plus components). `assets/css/legal.css` reproduces the Tailwind utilities the legal pages' bodies still use, so their markup never has to change. No Tailwind, no CDN.
- Inter is self-hosted (`assets/fonts/inter-latin-var.woff2`, OFL). No Google Fonts request.
- Colour rules for AA: orange `#E59F42` is a fill only (text on it is `#2B2B2B`); links use `--orange-ink`; muted text on cards uses `--text-muted-card`.
- Google Analytics `G-HC8N876HCR` (gtag) on every page. `assets/js/site.js` sends `app_store_click` with a `placement` parameter for every `a.appstore[data-placement]`. Nothing a visitor types (tool inputs) ever goes to GA, the URL or the console.
- App Store links are static campaign links: `https://apps.apple.com/app/apple-store/id6746517769?pt=127836285&ct=<code>&mt=8`, with page-level codes only (Apple needs 5 installs per code to show it): `web-home`, `web-guides`, `web-tools`, `web-compare`, `web-other` (FAQ, About, 404, legal, contact).
- Head, header and footer are copied into each page by hand from `.claude/templates/partials.html`. Keep them identical across pages; the checker fails if they differ.
- Local tools (stdlib/none to install): `sh .claude/scripts/build-pages.sh` (the Cloudflare build: copies the public files into `public/`), `python3 .claude/scripts/serve.py` (preview server that resolves URLs and redirects like Cloudflare Pages and hides what the build leaves out), `python3 .claude/scripts/check-site.py` (pre-push checks, including a test build), `python3 .claude/scripts/check-links.py` (needs the network: reports external links that return 4xx/5xx; run it when sources change), `sh .claude/og/render.sh` (OG images via headless Chrome), `node .claude/tests/caffeine-model.test.mjs` (tests for the tools' maths in `assets/js/caffeine-model.js`, which mirrors the app's `lib/gradualPlan.ts`).
- `.claude/docs/` is git-ignored: strategy docs (the brief, plans) stay on Corey's Mac because the repo is public.

## Pages and links that must keep working

| File | Notes |
|---|---|
| `index.html` | Home page |
| `privacy-policy.html` | Legal. Linked from the App Store listing and the app (`https://buzzoffapp.com/privacy-policy.html`, which 308-redirects to the canonical `/privacy-policy`). Last updated 25 Nov 2026 to match the app's `docs/PRIVACY-DATA.md` |
| `terms.html` | Legal. Linked from the listing as `https://www.buzzoffapp.com/terms` |
| `contact.html` | `mailto:support@buzzoffapp.com` + Pro support |
| `assets/images/buzzoff-logo.png`, `assets/icons/app-store-badge.svg` | Logo/favicon, App Store badge |

Never rename or delete those four pages or break their URLs (the old `.html` forms must keep redirecting). Only shared head/header/footer and meta changes are allowed on `privacy-policy.html` and `terms.html`; their legal wording changes only when Corey asks.

## Facts about the app

Use only facts you can check in the app repo (`~/Desktop/buzzoff-final`, **read-only from this session: never edit, commit or run anything there**) or on the App Store listing.

- App Store name from version 2.0.5: **Quit Caffeine: Buzz Off**, subtitle **Coffee Tracker & Day Counter**. The home-screen name stays "Buzz Off". 2.0.5 is live on the App Store since 26 Nov 2026.
- Store link: `https://apps.apple.com/app/id6746517769` (Apple redirects to the right country and the current name slug). Smart App Banner: `<meta name="apple-itunes-app" content="app-id=6746517769">`.
- Features (2.0.5): Cold Turkey with a day counter and the 21-Day Reset; Gradual with a weekly plan that lowers a daily mg target from the user's own starting point; a 2–3 tap daily check-in (caffeine yes/no, drink, mood, optional symptoms); quick-add drink logging with mg per drink; streaks, money saved, symptom trends and plan-adherence charts; pledge; achievements; daily reminder; short reads with sources listed in the app (`app/research-citations.tsx`). iPhone only, English only.
- Pricing: free to download; Pro weekly US$7.99 (no trial) or yearly US$39.99 with a 7-day free trial. The monthly plan is legacy: never mention it. Prices vary by country, so the site says "free to download, with an optional Pro subscription" rather than quoting prices, unless Corey asks.
- Brand assets: capybara mascot mood faces in the app repo (`assets/mood-faces/*.png`), marketing stills and the chosen hero image (hero-v1) in `~/Desktop/buzzoff-marketing-assets`. Copy only what a page uses into `assets/`, sized and compressed for the web.

## Health copy (never broken)

The site follows the app's house style (`~/Desktop/buzzoff-final/docs/HEALTH-COPY-2026-11.md`), so the site, the listing and the app agree. App Review guideline 1.4.1 covers the app; the same claims on the site would undercut it, and consumer-protection rules apply to the site anyway.

- Say what many people notice, not what will happen ("may", "many people", "some people").
- A number, timeline or range only with a source linked on the same page. Start from the sources the app already cites (Research & Citations); prefer primary research or official bodies (FDA, EFSA, NHS, USDA FoodData Central) for anything new.
- No percentage outcomes, no invented or average figures without a source. The old "average $150/month" line is out.
- No diagnosing or medical promises ("cure", "detox your body", "addiction" as a diagnosis). Every guide page ends with a short "general information, not medical advice; talk to your doctor if you're pregnant, have a health condition or take medication" note.
- Keep the warm, encouraging voice.
- Units: a number, a non-breaking space, then the unit (`95&nbsp;mg`, `200&nbsp;ml`, `5&nbsp;hours`, `12&nbsp;fl&nbsp;oz`), so they never split across lines. Tool output uses `\u00A0`. Plain spaces stay in `<head>` text and JSON-LD. The app deliberately writes "95mg" with no space in its UI; the site deliberately doesn't. `check-site.py` warns on a number and unit split by a plain space.

## Comparison pages

- Facts only, each one checkable on the other app's own App Store page, with the date checked shown on the page. No ratings or claims you can't check, no disparagement, no other apps' logos or screenshots.
- Other apps' names are fine on the website (plain text, describing them accurately). They never go into the App Store listing (guideline 2.3.7).

## SEO and quality bar

- Every page: unique `<title>` (≤ 60 characters) and meta description (≤ 155), canonical `https://buzzoffapp.com/...`, `lang="en"`, Open Graph and Twitter tags with a 1200×630 image, one `h1`, headings in order.
- `sitemap.xml` and `robots.txt` at the root, kept current when pages are added.
- Citations are numbered, Wikipedia style: `claim.&#8288;<sup class="cite" id="cite-1"><a href="#src-1" aria-label="Source 1: Juliano and Griffiths, 2004">[1]</a></sup>`, right after the claim's punctuation with no space, joined to it by a word joiner (`&#8288;`) so the `[n]` never wraps onto a line of its own. Numbered by first use on the page (a repeat keeps its number; only the first use has `id="cite-N"`); two sources read `[1][3]`. In tables, the `[n]` goes after the figure in its cell (no Source column). Keep the evidence type in the sentence ("a review of 66 studies found…"); author and year go in the Sources list, an ordered list in the same order (`id="src-N"`), each item with a `src-back` link to `#cite-N`. FAQPage JSON-LD answers are the visible answers word for word, as plain text without `[n]`. `check-site.py` fails on a `[n]` with no source, an uncited source or numbers out of first-use order. Refer to other parts of a page by name and link (`<a href="#how-it-works">How this is worked out</a>`), never "the table below".
- Structured data (JSON-LD) only for what's visible on the page: `MobileApplication` on home, `Organization`, `Article` on guides, `FAQPage` only where the Q&A is on the page. No `AggregateRating` or review markup.
- Alt text on every image, visible focus states, AA contrast, readable at 375 px wide.
- Pages stay fast: compressed images with width/height set, no new third-party scripts.

## Workflow

- One session per task, **plan mode first**; wait for Corey's approval before changing files.
- One branch per task (`feat/...`, `fix/...`, `chore/...`), branched from an up-to-date `main`.
- Preview locally (`python3 .claude/scripts/serve.py` from the repo root) and check each changed page at 375 px and desktop width. If you need a screenshot tool that isn't installed, ask first.
- **iOS simulators are shared with the app repo's sessions.** Don't boot, restart, shut down or use any iOS simulator from this repo's sessions while an app build session is working (its dev client runs on them). Check mobile layouts in Chromium at device widths (320, 375, 393, 402, 430 px) instead, and ask Corey first if a real Mobile Safari check is needed.
- Before pushing: `python3 .claude/scripts/check-site.py` passes (links, one H1, title/description lengths, canonicals, GA tag, alt text, JSON-LD, campaign links, identical header/footer, sitemap, no redirecting links, the build), and the legal URLs above still work.
- After pushing a branch: open its preview URL and check the changed pages, the legal URLs and that `/.claude/` and README files return 404.
- **Push the branch and stop.** Corey reviews it and approves the merge in chat. Only after that explicit approval, the session merges the branch into `main` with a merge commit (`git merge --no-ff`; never force, never rebase `main`) and pushes `main`, which deploys.
- After the merge: wait for Cloudflare Pages to deploy `main` (and GitHub Pages too, until it's turned off around 28 Nov 2026), then check the live pages (status codes and content), including the legal URLs above. Then delete the merged branch locally and on origin.
- Without that approval in chat, never merge into or push `main`. Small docs-only changes to `.claude/` go on `main` only when Corey asks for them there.
- Commits small and conventional. No `Co-Authored-By` trailers or AI mentions.

## Guardrails

- Never add dependencies, a build step, a framework, or GitHub Actions without asking.
- Never change `CNAME`, DNS, the Cloudflare or GitHub Pages settings or the GA property.
- Any new tracker, form, embed or third-party script needs Corey's OK first and a matching privacy-policy update.
- No fake reviews, testimonials, ratings or user counts. No images of real people.
- Don't touch the app repo; if the app's facts look wrong or out of date, say so in your report instead.
