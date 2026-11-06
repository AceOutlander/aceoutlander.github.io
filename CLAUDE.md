# hunteracedev.com

The owner's games site. This repo, `AceOutlander/aceoutlander.github.io`, is the home page; each game lives in its own repo.

## How the site is hosted

- GitHub Pages serves this repo's `main` branch, root folder, at https://hunteracedev.com/ (HTTPS enforced). The
  `CNAME` file holds the custom domain: never delete or change it. The domain's DNS points at GitHub Pages
  (`hunteracedev.com` A records to GitHub's Pages IPs, `www` CNAME to `aceoutlander.github.io`).
- Pages builds this repo with Jekyll, but nothing here uses Jekyll: the page is plain HTML and CSS. `_config.yml` only
  keeps `CLAUDE.md` and `tools/` from being published.
- Every other public repo of the account with Pages turned on appears under the same domain at `/<repo name>/`:

| Path | Repo | How it publishes |
| --- | --- | --- |
| `/` | `aceoutlander.github.io` (this repo) | Pages from `main`, root folder, as-is |
| `/bulwark/` | `bulwark` | Pages from `main`, root folder, as-is |
| `/tin-hats/` | `tin-hats` (source in the sibling folder `..\tin-hats`) | GitHub Actions builds and publishes it |
| `/magic-academy/` | `magic-academy` | Pages from `main`; not linked from the home page (the owner's choice, for now) |

## Rules

- **Never change anything under `/bulwark/`, and never rename the `bulwark` repo.** Players' saves live in their
  browsers and are tied to that address. The same goes for `/tin-hats/` and the `tin-hats` repo.
- Never add a service worker to this repo: one at the site root could take over every game's pages.
- The home page is plain HTML and CSS, phone first, with no frameworks and no build step. Images are compressed (WebP
  with JPEG fallback, small versions for phones), and big tap targets everywhere.
- Each game on the home page is one self-contained entry (one block in `index.html` plus its images in `assets/`), so
  adding a game means adding one entry.
- Nothing personal goes into the repo: no local paths, no personal email addresses. Commits use the owner's GitHub
  no-reply address (set in this repo's local git config).

## Previewing locally

```powershell
..\tin-hats\x.cmd node tools\preview.mjs
```

That serves this folder at http://localhost:8080/ and the built Tin Hats game (`..\tin-hats\dist`, build it first with
`..\tin-hats\x.cmd npm run build`) at `/tin-hats/`, exactly where the live site puts them. Links to games kept in other
repos (`/bulwark/`, `/magic-academy/`) go to the live site. Run it in the background and stop it when done.

## Push to live

"Push to live" means all of these steps, in order. Do it only when the owner says so.

1. **Preview locally** with the command above. Check the page at a phone size (390x844) and a desktop size, and that
   every Play link works. Fix anything broken first.
2. **Commit** on `main` with a short message.
3. **Push:** `git push origin main`.
4. **Wait for the deploy to finish:** Pages builds the site after each push. Watch it with
   `gh run list --repo AceOutlander/aceoutlander.github.io --limit 1` (the run is called "pages build and deployment")
   or `gh api repos/AceOutlander/aceoutlander.github.io/pages/builds/latest --jq .status` until it says `built`.
5. **Confirm the change is really live:** load https://hunteracedev.com/ (add `?v=<something>` to skip caches) and check
   that the new content is there, for example by comparing a line you changed. Also load https://hunteracedev.com/bulwark/
   and https://hunteracedev.com/tin-hats/ to make sure both games still open. Pages can take a minute or two.

To publish a new version of Tin Hats, use the "Push to live" steps in the game's own `CLAUDE.md` (`..\tin-hats`).
