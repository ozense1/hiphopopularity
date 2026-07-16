# What Makes Hip-Hop Popular? — Dashboard

A static, client-side dashboard analyzing what drives Spotify popularity for hip-hop tracks (1986–2023), built with D3.js and PapaParse. No backend required — everything runs in the browser.

## Files

- `index.html` — page structure
- `styles.css` — all styling
- `data_pipeline.js` — data processing (correlations, word frequency, decade aggregation, etc.)
- `app.js` — rendering logic and interactivity (charts, filters, word cloud)
- `data.csv` — the built-in dataset (2,531 hip-hop tracks)

## Deploying to GitHub Pages

1. Create a new GitHub repository (or use an existing one).
2. Add all 5 files above to the repository root (or to a `/docs` folder — either works, just match your Pages settings).
3. Commit and push.
4. In the repo settings, go to **Settings → Pages**, and under "Build and deployment," set:
   - **Source:** Deploy from a branch
   - **Branch:** `main` (or your default branch), folder `/ (root)` or `/docs` — whichever you used
5. Save. GitHub will give you a URL like `https://yourusername.github.io/your-repo-name/` within a minute or two.

## Notes

- The dashboard loads `data.csv` via `fetch`, which requires the files to be served over HTTP(S) — this works automatically on GitHub Pages, but **won't work if you just double-click `index.html` locally** (opening a file directly via `file://` blocks the fetch). To test locally before deploying, run a simple local server from the folder, e.g.:
  ```
  python3 -m http.server 8000
  ```
  then open `http://localhost:8000` in your browser.
- D3, d3-cloud, and PapaParse load from a CDN (cdnjs.cloudflare.com), so the deployed site needs normal internet access to render — no local install needed.
- Visitors can upload their own CSV (same column structure as `data.csv`) via the "Upload CSV" button to replace the dataset live in the browser, without needing to redeploy anything.
