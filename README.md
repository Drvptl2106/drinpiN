# Outfit & Reel Saver

Save links from Instagram, WhatsApp and other apps in one place.

- **Outfits:** save a creator's outfit, tag each piece (top, shoes, …) and tap a shop button to search for it on Myntra, Ajio, Amazon.in, Google Shopping or Nykaa Fashion.
- **Reels:** a watch-later queue. Tap **🎲 Pick one for me** when you want something to watch.
- **Wardrobe:** every tagged piece, grouped by category, filtered by Owned, Wishlist or Bought.

There's no account and no server. Everything is saved in your phone's browser.

---

## Try it on your computer

The easiest way is to double-click `index.html`. Everything works except offline mode and installing as an app, because those need a web address.

For the full experience, open a terminal in this folder and run:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000> in Chrome.

## Put it online for free (so you can install it on your phone)

Installing and sharing need the app on an `https://` address. Pick one of these:

**Netlify (easiest, no account setup beyond sign-up)**
1. Go to <https://app.netlify.com/drop>.
2. Drag the whole `outfit-saver` folder onto the page.
3. You'll get an address like `https://something.netlify.app`.

**GitHub Pages**
1. Create a new repository on GitHub and upload all the files in this folder.
2. Go to the repository's **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
3. After a minute your app is at `https://<your-username>.github.io/<repository-name>/`.

## Install on your phone

- **Android (Chrome):** open your app's address, tap the **⋮** menu, then **Add to Home screen / Install app**.
- **iPhone (Safari):** open the address, tap the **Share** button, then **Add to Home Screen**.

After the first visit, the app opens without internet.

## Saving a link from another app

- **Android:** once the app is installed, it appears in the **Share** menu. In Instagram, WhatsApp, YouTube and similar apps, tap **Share**, pick **Saver**, and the add form opens with the link already filled in. The app guesses Reel or Outfit from the link, and you can switch it.
- **iPhone:** ⚠️ Safari doesn't let web apps appear in the Share menu, so this won't work on iPhone. Instead, tap **Copy link** in the other app, open Saver, tap **+ Add** and paste the link into the **Link** box.

## Changing the shops

Open `stores.js`. Each shop is one line with a name and a search address, and `{q}` marks where the piece name goes. You can add, remove or fix shops there without touching anything else.

## Updating the app after it's online

Upload the changed files again. The app picks up changes on the **second** time it's opened. To make everyone get them on the first open, open `sw.js` and bump the version (`saver-v1` → `saver-v2`).

## Files

| File | What it does |
|---|---|
| `index.html` | The page itself |
| `styles.css` | Colours and layout (light and dark mode) |
| `app.js` | All the screens and buttons |
| `storage.js` | Saves and loads items (browser storage key `saver.items`) |
| `stores.js` | Shop search links |
| `manifest.json` | Makes it installable and adds it to Android's Share menu |
| `sw.js` | Keeps a copy of the app so it works offline |
| `icons/` | App icons |

## Good to know

- Your data lives only in the browser where you saved it. Clearing your browser data deletes it, and it doesn't sync between your phone and your computer.
- The app saves only links and text, never photos or videos.
