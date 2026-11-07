# FXD Downloader

An installable PWA by **FUTURE X DESIGN**. Paste a link, see which platform it comes from, and get
only the download options that platform and the file's owner allow. Direct file links
(mp4, mp3, jpg, pdf and similar) download in the browser.

React 19 + Vite 7. No database. Two optional Vercel functions in `api/`.

## What works, what does not

| Feature | Status |
| --- | --- |
| Link validation, clipboard paste, Android share-sheet target | Works |
| Platform detection: YouTube, TikTok, Instagram, Facebook (incl. short links) | Works |
| Direct file download (browser fetches the file, then saves it) | Works when the file's server allows cross-origin reads (CORS). Otherwise FXD says so and offers manual steps |
| Link previews for YouTube and TikTok | Works on Vercel (public oEmbed, no key) |
| Link previews for Instagram and Facebook | Needs `META_OEMBED_TOKEN` and a Meta app approved for "Meta oEmbed Read" |
| Downloading video files from YouTube, TikTok, Instagram, Facebook pages | **Not offered.** Each result lists the platform's own authorized routes instead |
| Downloading your own media through platform APIs (OAuth) | **Not built.** Needs account-owner sign-in and approval: YouTube Data API, TikTok developer apps, Meta Graph API |
| Install button | Shown only when the browser offers a real install prompt. Otherwise step-by-step instructions for the detected browser |

FXD never says "downloaded" on its own. It reports "received" when the bytes arrive in the browser,
"Save requested" when it hands them to the browser's download handler, and "Saved" only when the
desktop save picker confirms the file was written.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173 (serves /api locally too)
npm test           # 40 unit tests (node --test)
npm run build      # vite build + stamps dist/sw.js with a per-build cache id
npm run verify     # checks dist/ for a valid manifest, icons, iOS tags, service worker
npm run preview    # serve dist/ locally
npm run icons      # regenerate PNG icons from the mark (needs sharp)
```

Requires Node 20.19 or newer.

## Deploy to Vercel

1. Push this folder to a GitHub repository (`node_modules`, `dist` and `.env*` are git-ignored).
2. In Vercel choose **Add New > Project**, import the repository.
3. Leave the detected settings as they are. `vercel.json` already sets framework Vite,
   build command `npm run build` and output directory `dist`.
4. Click **Deploy**. Vercel serves the site over HTTPS, which installation and the service worker require.
5. Optional, for Instagram and Facebook previews: **Settings > Environment Variables**, add
   `META_OEMBED_TOKEN` (and optionally `META_GRAPH_VERSION`), then redeploy. See `.env.example`.
6. Open the live URL, then run `npm run verify` against a local build, or check the Lighthouse
   PWA audit in Chrome DevTools.

CLI alternative: `npm i -g vercel && vercel --prod` from this folder.

Preview deployments use their own `*.vercel.app` URL. Install the app from the production URL.

## Testing on real devices

Automated checks cannot replace these. Test on production HTTPS:

- **Android Chrome:** an "Install FXD Downloader" button should appear. Otherwise use menu > Install app.
  Share a YouTube link to FXD from another app to test the share target.
- **Samsung Internet:** menu > Add page to > Home screen, or the install icon in the address bar.
- **iPhone Safari (including iPhone 7 Plus, up to iOS 15.8):** Share > Add to Home Screen.
  There is no install prompt on iOS, so FXD shows the steps instead.
- **Desktop Chrome and Edge:** install icon in the address bar. Safari: File > Add to Dock (macOS Sonoma or newer).
  Firefox on desktop does not install PWAs.

## Responsible use

Download only content you own or have permission to save. FXD does not bypass platform
protections, DRM, logins or private content, and will not.
