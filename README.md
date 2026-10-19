# Terra Tour

Landing page and lightweight Node.js backend for Terra Tour Lampung. Requires Node.js 18 or newer; there are no external npm dependencies.

## Run locally

```powershell
npm start
```

Open `http://localhost:3000`. The WhatsApp number provided by Terra Tour is configured by default. To override it, or to connect a separately hosted GitHub Pages frontend, set these values before starting the server:

```powershell
$env:WHATSAPP_NUMBER="628127289020"
npm start
```

The public news form requires a title, content, and exactly 3 different comma-separated keywords. There is no admin password: anyone who can visit the published form can submit a news article. News is stored in `data/articles.jsonl`; new inquiries are appended to `data/inquiries.jsonl`. These local data files are ignored by Git. Older PDF uploads remain available, but new posts are text articles.

The uploaded Terra Tour photos are used directly in the destination cards and Keunggulan section. Their destination mapping is documented in [assets/README.md](assets/README.md). Package cards intentionally do not display prices.

## GitHub

Create an empty repository on GitHub, then from this folder run `git init`, `git add .`, `git commit -m "Build Terra Tour landing page"`, `git branch -M main`, `git remote add origin <repository-url>`, then `git push -u origin main`. GitHub Actions runs backend tests on every push and pull request.

GitHub Pages can host the static website, but cannot run `server.js` or save news posts. To make the article form work on your already-published GitHub Pages website:

1. Deploy this project's Node.js backend to a Node.js hosting service. The backend must have persistent storage for its `data/` directory; GitHub Pages alone cannot store submitted articles.
2. In the backend host's environment settings, set `FRONTEND_ORIGIN` to the exact published website origin (for example, `https://username.github.io` or your custom domain). Set `WHATSAPP_NUMBER` if needed. No `ARTICLE_UPLOAD_KEY` is required.
3. In this repository's `index.html`, set the `api-base` meta tag to the backend's public origin, for example `<meta name="api-base" content="https://api.example.com" />`.
4. Upload/push the updated files to GitHub using the steps below. GitHub Pages will publish the updated website; wait for its deployment to finish, then open the published address and test the article form.

The publishing endpoint is intentionally public with no password, so it can be abused for spam. A backend host with temporary disk storage may also lose articles after a restart; use persistent storage for production.

### Upload changes to the GitHub repository

From this project folder, open a terminal and run:

```powershell
git status
git add index.html app.js styles.css server.js test/server.test.js README.md
git commit -m "Add public news publishing form"
git push
```

If `git push` says there is no upstream branch, use `git push -u origin main` (replace `main` with your branch name if it is different). You can do the same in VS Code by opening **Source Control**, reviewing the changed files, entering a commit message, selecting **Commit**, then **Sync Changes** or **Push**. After pushing, open the repository's **Actions** tab and wait for the checks to finish. If GitHub Pages is already enabled, its deployment will update the live site automatically.

## API

- `GET /api/health` returns server health.
- `GET /api/config` returns the configured public WhatsApp number.
- `POST /api/contact` validates and saves an inquiry.
- `GET /api/articles` returns published news.
- `POST /api/articles` publishes news without authentication; send `title`, `content`, and exactly three comma-separated `keywords` as JSON.
