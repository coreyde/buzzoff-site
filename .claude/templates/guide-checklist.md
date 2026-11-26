# Guide checklist

Use with `.claude/templates/guide.html` for every new guide. The rules behind it are in `.claude/CLAUDE.md` (health copy, sources, workflow).

## Picking the topic

- Start from Search Console → Performance → Queries, filtered with the regex `^(?:\S+\s+){7,}\S+$` (8+ word questions). Pick questions with impressions that no page answers well, or add the answer to the page that already ranks.
- One question per page. Check it doesn't duplicate an existing guide (`/guides/`).

## Sources (before writing)

- Open every source and quote figures exactly as it states them. Never fill a gap from memory.
- PubMed abstracts: NCBI E-utilities (`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=<PMID>&rettype=abstract&retmode=text`). Full text: open the PMC page in the browser pane. Don't spoof user agents or get around bot checks.
- Prefer primary research and official bodies (FDA, EFSA, NHS, USDA FoodData Central, National Academies). Start from the app's Research & Citations list.
- Name the source for each figure. Never mix ranges from different sources in one sentence (for example, the National Academies' 1.5–9.5 h half-life and EFSA's figures).
- If a figure is only in a paper's full text and not its abstract, say so in the report and let Corey decide.

## Writing

- H1 = the question. The short answer box answers it in two sentences, each figure with its numbered citation.
- 3–6 H2 sections named after real follow-up questions. Short paragraphs and lists.
- House style: "many people", "may", "some people". No promises, no diagnosing, no "cure", "detox" or "addiction" as a diagnosis, no percentage outcomes, no invented or average figures. Warm, calm, no guilt.
- Units: number, `&nbsp;`, unit in body text (`90&nbsp;mg`, `200&nbsp;ml`, `2–9&nbsp;days`, `12&nbsp;fl&nbsp;oz`), never "95mg" (that's the app's UI style, not the site's). Plain spaces in the title, meta tags and JSON-LD.
- Worked examples (half-life maths, cups of decaf) say they're estimates and only use cited inputs.
- The "In the app" aside states Buzz Off facts only.
- 2–4 internal links: up to the pillar, across to siblings, plus the tools once they exist.
- 3–5 FAQs at the end. The same questions, and only those, go in the FAQPage JSON-LD.
- Numbered citations, Wikipedia style: `claim.<sup class="cite" id="cite-1"><a href="#src-1" aria-label="Source 1: Juliano and Griffiths, 2004">[1]</a></sup>`, right after the punctuation with no space. Numbered by first use; a repeat keeps its number; only the first use has `id="cite-N"`. Keep the evidence type in the sentence ("a review of 66 studies found…"); author and year go in the Sources list.
- The Sources list is an ordered list in that same order (`id="src-N"`), each with a `src-back` link to `#cite-N`. Every [n] has a source and every source is cited (check-site.py fails otherwise).
- FAQPage JSON-LD answers are the visible answers word for word, as plain text without [n].
- End with the not-medical-advice note (in the template).

## Page details

- Title ≤ 60 characters, question or answer first, `| Buzz Off` last. Description ≤ 155, with the key figure.
- Canonical `https://buzzoffapp.com/guides/<slug>/`, OG image `og/guides.jpg`, campaign code `ct=web-guides`, badge `data-placement="guide-<slug>"`.
- Byline "By Corey De Ponte, founder of Buzz Off". "Last reviewed" shows the `review-pending` marker until Corey approves; then his approval date, and the same date as `datePublished`/`dateModified` in the Article JSON-LD.
- Add the page to `/guides/` (its cluster), `sitemap.xml` (with lastmod) and `llms.txt` (one line with its key fact).

## Before pushing

- `python3 .claude/scripts/check-site.py`: 0 errors. The only warnings allowed are the review-pending ones (fix any units warning).
- Check the page at 375 px (no sideways scroll; wide tables scroll inside `.table-wrap`) and at desktop width, with screenshots for the report.
- Push the branch and stop. Every guide goes to Corey for approval before merge.
