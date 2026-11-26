# Buzz Off website — Claude Code guide

buzzoffapp.com is the marketing site for **Buzz Off**, an iOS app that helps people quit or cut back on caffeine (Cold Turkey, or Gradual with a weekly reduction plan). The site's jobs, in order: send people to the App Store, rank for the caffeine questions people search, and host the legal pages the App Store listing links to.

Corey is the solo founder. A separate Claude chat (the "dev manager") writes the prompts for this session and reviews its plans and reports.

The redesign and SEO brief is `.claude/docs/website-brief.md`: read it before planning any page.

## How it's hosted (read this first)

- Static files on **GitHub Pages**, repo `github.com/coreyde/buzzoff-site`, custom domain in `CNAME` (`buzzoffapp.com`).
- **A push to `main` deploys to the live site within minutes.** There is no staging site. Feature branches don't deploy.
- GitHub Pages runs **Jekyll** by default (there's no `.nojekyll`). Jekyll publishes every file except dot-folders and `_`-prefixed ones, so a Markdown file at the root becomes a public page. Internal notes, plans and specs go in `.claude/` (this folder), never at the root or in a normal folder.
- Assume the repo and everything in it is public. Never commit revenue, user data, internal plans, keys or tokens.

## Stack

- Plain HTML pages, no build step, no `package.json`.
- Tailwind via the CDN script (`cdn.tailwindcss.com`) with an inline `tailwind.config` per page (the `buzz` colours: bg `#FAF7F2`, card `#EEE7DF`, border `#D6CEC5`, text `#2B2B2B`). Inter from Google Fonts.
- Google Analytics `G-HC8N876HCR` (gtag) on every page; the App Store badge fires `app_store_click`.
- Head, header and footer are copied into each page by hand. Keep them identical across pages.

## Pages and links that must keep working

| File | Notes |
|---|---|
| `index.html` | Home page |
| `privacy-policy.html` | Legal. Linked from the App Store listing and the app (`https://buzzoffapp.com/privacy-policy.html`). Last updated 25 Nov 2026 to match the app's `docs/PRIVACY-DATA.md` |
| `terms.html` | Legal. Linked from the listing as `https://www.buzzoffapp.com/terms` |
| `contact.html` | `mailto:support@buzzoffapp.com` + Pro support |
| `assets/images/buzzoff-logo.png`, `assets/icons/app-store-badge.svg` | Logo/favicon, App Store badge |

Never rename or delete those four pages or change their URLs. Only shared head/header/footer and meta changes are allowed on `privacy-policy.html` and `terms.html`; their legal wording changes only when Corey asks.

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

## Comparison pages

- Facts only, each one checkable on the other app's own App Store page, with the date checked shown on the page. No ratings or claims you can't check, no disparagement, no other apps' logos or screenshots.
- Other apps' names are fine on the website (plain text, describing them accurately). They never go into the App Store listing (guideline 2.3.7).

## SEO and quality bar

- Every page: unique `<title>` (≤ 60 characters) and meta description (≤ 155), canonical `https://buzzoffapp.com/...`, `lang="en"`, Open Graph and Twitter tags with a 1200×630 image, one `h1`, headings in order.
- `sitemap.xml` and `robots.txt` at the root, kept current when pages are added.
- Structured data (JSON-LD) only for what's visible on the page: `MobileApplication` on home, `Organization`, `Article` on guides, `FAQPage` only where the Q&A is on the page. No `AggregateRating` or review markup.
- Alt text on every image, visible focus states, AA contrast, readable at 375 px wide.
- Pages stay fast: compressed images with width/height set, no new third-party scripts.

## Workflow

- One session per task, **plan mode first**; wait for Corey's approval before changing files.
- One branch per task (`feat/...`, `fix/...`, `chore/...`), branched from an up-to-date `main`.
- Preview locally (`python3 -m http.server 8000` from the repo root) and check each changed page at 375 px and desktop width. If you need a screenshot tool that isn't installed, ask first.
- Before pushing: every internal link resolves, `sitemap.xml` lists the new pages, no page lost its GA tag, and the legal URLs above still work.
- **Push the branch and stop.** Corey reviews it and approves the merge into `main` (which deploys). Never push to or merge into `main` yourself, never force-push `main`.
- After a merge, check the live URLs once Pages has deployed.
- Commits small and conventional. No `Co-Authored-By` trailers or AI mentions.

## Guardrails

- Never add dependencies, a build step, a framework, or GitHub Actions without asking.
- Never change `CNAME`, DNS, the GitHub Pages settings or the GA property.
- Any new tracker, form, embed or third-party script needs Corey's OK first and a matching privacy-policy update.
- No fake reviews, testimonials, ratings or user counts. No images of real people.
- Don't touch the app repo; if the app's facts look wrong or out of date, say so in your report instead.
