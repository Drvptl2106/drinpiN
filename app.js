/*
  app.js — all the screens and buttons of drinpiN.

  How it works, in short:
  - The end of the page address says which screen to show, for example
    "#/reels" or "#/item/abc123". Whenever it changes, render() draws the
    matching screen into <main id="view">.
  - Data comes from ItemStore (storage.js). Shop links come from STORES (stores.js).
*/
(function () {
  'use strict';

  var APP_VERSION = '1.1';
  var CATEGORIES = ItemStore.CATEGORIES;
  var STATUS_LABELS = { wishlist: 'Wishlist', owned: 'Owned', bought: 'Bought' };
  var DAY = 24 * 60 * 60 * 1000;

  // Small settings remembered on this device (separate from your saved items).
  var PREFS = { welcomed: 'saver.welcomed', rediscoverHidden: 'saver.rediscoverHiddenDay' };

  var view = document.getElementById('view');
  var searchBar = document.getElementById('search-bar');
  var searchInput = document.getElementById('search');
  var tabLinks = document.querySelectorAll('#tabs a');
  var reelBadge = document.getElementById('reel-badge');
  var addButton = document.getElementById('add-button');
  var toastBox = document.getElementById('toast');
  var toastText = document.getElementById('toast-text');
  var toastAction = document.getElementById('toast-action');

  // Screen settings that don't need saving.
  var ui = {
    outfitFilter: 'all',     // Outfits tab: all / wishlist / owned / bought
    wardrobeStatus: 'owned', // Wardrobe tab: owned / wishlist / bought / all
    wardrobeCategory: 'all',
    pickedReelId: null,      // the reel chosen by "Pick one for me"
    shared: null,            // a link that arrived from the phone's Share menu
    installPrompt: null      // Android's "Install app" prompt, saved for the More screen
  };

  /* ================= Small helpers ================= */

  // Make text safe to put inside the page (so a note like "<b>" shows as text).
  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Only allow normal web links to be opened.
  function safeHref(url) {
    return /^https?:\/\//i.test(url || '') ? url : '#';
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function cap(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  function shortDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // "today", "yesterday", "12 days ago"
  function daysAgo(iso) {
    var days = Math.floor((Date.now() - Date.parse(iso)) / DAY);
    if (!(days > 0)) return 'today';
    return days === 1 ? 'yesterday' : days + ' days ago';
  }

  function getPref(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function setPref(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* not important */ }
  }

  // Show a short message at the bottom. Optionally with a button, e.g. "Undo".
  function toast(message, actionLabel, onAction, duration) {
    toastText.textContent = message;
    if (actionLabel) {
      toastAction.textContent = actionLabel;
      toastAction.hidden = false;
      toastAction.onclick = function () {
        toastBox.classList.remove('show');
        onAction();
      };
    } else {
      toastAction.hidden = true;
      toastAction.onclick = null;
    }
    toastBox.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { toastBox.classList.remove('show'); }, duration || 2600);
  }

  function go(hash) {
    location.hash = hash;
  }

  // Bits that shops and social apps add to links to track clicks. Removed when saving.
  var TRACKING_PARAMS = /^(utm_.*|igsh|igshid|si|fbclid|gclid|feature|ref_src)$/i;

  // Turn whatever was pasted into a proper web address, or '' if it isn't one.
  // "instagram.com/p/abc" becomes "https://instagram.com/p/abc".
  function normaliseUrl(raw) {
    var text = String(raw || '').trim();
    if (!text) return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = 'https://' + text;
    try {
      var u = new URL(text);
      if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.hostname.indexOf('.') < 1) return '';
      Array.from(u.searchParams.keys()).forEach(function (key) {
        if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
      });
      return u.href;
    } catch (e) {
      return '';
    }
  }

  // Two links count as "the same" if they point at the same page,
  // ignoring "www.", a trailing "/", and extra bits after "?" (except YouTube's video id).
  function sameLinkKey(url) {
    try {
      var u = new URL(url);
      return u.hostname.replace(/^(www|m)\./, '') + u.pathname.replace(/\/+$/, '') + (u.searchParams.get('v') || '');
    } catch (e) {
      return url;
    }
  }

  // Find the first web link inside some text (shared messages often include other words).
  function findLink(text) {
    var match = String(text || '').match(/https?:\/\/[^\s<>"]+/i);
    return match ? match[0] : '';
  }

  // Guess "reel" for links that look like short videos, otherwise "outfit".
  function guessType(url) {
    return /\/(reel|reels|shorts)\/|tiktok\.com|youtu\.be/i.test(url) ? 'reel' : 'outfit';
  }

  // A default title when none is typed, e.g. "Instagram reel".
  function autoTitle(url, type) {
    var names = { instagram: 'Instagram', youtube: 'YouTube', youtu: 'YouTube', tiktok: 'TikTok',
      pinterest: 'Pinterest', pin: 'Pinterest', facebook: 'Facebook', fb: 'Facebook', wa: 'WhatsApp' };
    var host = hostOf(url).replace(/^(m|mobile)\./, '');
    var first = host.split('.')[0] || 'Saved';
    var site = names[first] || cap(first);
    return site + ' ' + type;
  }

  function newestFirst(a, b) {
    return String(b.createdAt).localeCompare(String(a.createdAt));
  }

  function ofType(type) {
    return ItemStore.all().filter(function (i) { return i.type === type; }).sort(newestFirst);
  }

  function isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  }

  function isIPhone() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  /* ================= Pieces of screens ================= */

  function statusBadge(status) {
    return '<span class="badge badge-' + esc(status) + '">' + esc(STATUS_LABELS[status] || status) + '</span>';
  }

  function outfitCard(item) {
    var pieces = item.pieces || [];
    var summary = pieces.length
      ? pieces.length + (pieces.length === 1 ? ' piece' : ' pieces') + ': ' + pieces.map(function (p) { return p.name; }).join(', ')
      : 'No pieces tagged';
    return '<a class="card" href="#/item/' + encodeURIComponent(item.id) + '">' +
      '<div class="card-top"><span class="card-title">' + esc(item.title) + '</span>' + statusBadge(item.status) + '</div>' +
      '<div class="meta">' + esc(summary) + '</div>' +
      (item.note ? '<p class="card-note">' + esc(item.note) + '</p>' : '') +
    '</a>';
  }

  function reelCard(item, isPick) {
    return '<article class="card' + (isPick ? ' picked' : '') + '">' +
      (isPick ? '<div class="pick-label">Your pick</div>' : '') +
      '<div class="card-top"><span class="card-title">' + esc(item.title) + '</span>' +
        (item.watched ? '<span class="badge badge-owned">Watched</span>' : '') + '</div>' +
      '<div class="meta">' + esc(hostOf(item.url)) + ' · saved ' + esc(daysAgo(item.createdAt)) + '</div>' +
      (item.note ? '<p class="card-note">' + esc(item.note) + '</p>' : '') +
      '<div class="card-actions">' +
        '<a class="btn btn-primary btn-small" href="' + esc(safeHref(item.url)) + '" target="_blank" rel="noopener">Watch ↗</a>' +
        (item.watched
          ? '<button class="btn btn-small" type="button" data-action="unwatched" data-id="' + esc(item.id) + '">Mark unwatched</button>'
          : '<button class="btn btn-small" type="button" data-action="watched" data-id="' + esc(item.id) + '">Mark watched</button>') +
        '<a class="btn btn-small" href="#/edit/' + encodeURIComponent(item.id) + '">Edit</a>' +
      '</div>' +
    '</article>';
  }

  function emptyBox(html) {
    return '<div class="empty">' + html + '</div>';
  }

  function filterChips(action, current, choices, labels) {
    return '<div class="chips" role="group">' + choices.map(function (c) {
      return '<button class="chip" type="button" data-action="' + action + '" data-value="' + c + '" aria-pressed="' + (current === c) + '">' + labels[c] + '</button>';
    }).join('') + '</div>';
  }

  /* ================= Screens ================= */

  // First-time welcome screen.
  function renderWelcome() {
    view.innerHTML =
      '<div class="welcome">' +
        '<img class="welcome-logo" src="icons/icon.svg" alt="">' +
        '<h1>drinpi<span style="color:var(--accent)">N</span></h1>' +
        '<p class="tagline">Save it. Find it. Wear it.</p>' +
        '<div class="steps">' +
          '<div class="step"><div class="step-num">1</div><div><b>Save any link</b><span>Share an outfit or reel from Instagram, WhatsApp or YouTube straight to drinpiN, or paste it.</span></div></div>' +
          '<div class="step"><div class="step-num">2</div><div><b>Tag the pieces</b><span>Top, bottom, shoes… then search Myntra, Ajio, Amazon and more in one tap.</span></div></div>' +
          '<div class="step"><div class="step-num">3</div><div><b>Actually come back to it</b><span>Your reel queue picks something to watch, and old wishlist finds pop back up.</span></div></div>' +
        '</div>' +
        '<button class="btn btn-primary btn-block" type="button" data-action="start">Get started</button>' +
        '<p class="hint" style="margin-top:12px">No account needed. Everything stays on this phone.</p>' +
      '</div>';
  }

  // A wishlist outfit saved 3+ days ago, so saved things come back around.
  // The same one shows all day, and a different one tomorrow.
  function rediscoverItem() {
    var today = Math.floor(Date.now() / DAY);
    if (getPref(PREFS.rediscoverHidden) === String(today)) return null;
    var older = ofType('outfit').filter(function (o) {
      return o.status === 'wishlist' && Date.now() - Date.parse(o.createdAt) >= 3 * DAY;
    });
    return older.length ? older[today % older.length] : null;
  }

  // Outfits tab: a "rediscover" nudge, then every saved outfit, newest first.
  function renderOutfits() {
    var all = ofType('outfit');
    if (!all.length) {
      view.innerHTML = emptyBox('<b>No outfits yet.</b><br>Saw a look you love? Share it to drinpiN or tap <b>Add</b> to paste the link.');
      return;
    }

    var html = '';
    var again = rediscoverItem();
    if (again) {
      html += '<section class="rediscover">' +
        '<div class="eyebrow">Still on your wishlist · saved ' + esc(daysAgo(again.createdAt)) + '</div>' +
        '<span class="card-title">' + esc(again.title) + '</span>' +
        '<div class="meta">' + esc((again.pieces || []).map(function (p) { return p.name; }).join(', ') || 'No pieces tagged') + '</div>' +
        '<div class="card-actions">' +
          '<a class="btn btn-primary btn-small" href="#/item/' + encodeURIComponent(again.id) + '">Take a look</a>' +
          '<button class="btn btn-small" type="button" data-action="set-status" data-value="bought" data-id="' + esc(again.id) + '">I bought it</button>' +
          '<button class="btn btn-small" type="button" data-action="hide-rediscover">Not today</button>' +
        '</div></section>';
    }

    var shown = all.filter(function (o) { return ui.outfitFilter === 'all' || o.status === ui.outfitFilter; });
    html += filterChips('outfit-filter', ui.outfitFilter, ['all', 'wishlist', 'owned', 'bought'],
      { all: 'All (' + all.length + ')', wishlist: 'Wishlist', owned: 'Owned', bought: 'Bought' });
    html += '<div style="margin-top:12px">' + (shown.length
      ? '<div class="list">' + shown.map(outfitCard).join('') + '</div>'
      : emptyBox('No outfits with this status.')) + '</div>';
    view.innerHTML = html;
  }

  // Reels tab: unwatched queue, "Pick one for me", and watched reels below.
  function renderReels() {
    var reels = ofType('reel');
    var unwatched = reels.filter(function (r) { return !r.watched; });
    var watched = reels.filter(function (r) { return r.watched; });
    var pick = unwatched.filter(function (r) { return r.id === ui.pickedReelId; })[0];
    if (!pick) ui.pickedReelId = null;

    var html = '<div class="row page-head"><h2 style="margin:0">Watch later (' + unwatched.length + ')</h2>' +
      '<button class="btn btn-primary" type="button" data-action="pick">🎲 Pick one for me</button></div>';

    if (pick) html += '<div class="list" style="margin-bottom:10px">' + reelCard(pick, true) + '</div>';

    var rest = unwatched.filter(function (r) { return r !== pick; });
    if (rest.length) {
      html += '<div class="list">' + rest.map(function (r) { return reelCard(r, false); }).join('') + '</div>';
    } else if (!pick) {
      html += emptyBox(reels.length
        ? '<b>All caught up!</b> 🎉<br>Save more reels to watch later.'
        : '<b>Your watch-later queue is empty.</b><br>Share a reel to drinpiN or tap <b>Add</b> to paste one.');
    }

    if (watched.length) {
      html += '<h2>Watched (' + watched.length + ')</h2><div class="list">' +
        watched.map(function (r) { return reelCard(r, false); }).join('') + '</div>';
    }
    view.innerHTML = html;
  }

  // Wardrobe tab: every tagged piece, grouped by category, filtered by status and category.
  function renderWardrobe() {
    var rows = [];
    ofType('outfit').forEach(function (outfit) {
      (outfit.pieces || []).forEach(function (piece) {
        if (ui.wardrobeStatus !== 'all' && outfit.status !== ui.wardrobeStatus) return;
        if (ui.wardrobeCategory !== 'all' && piece.category !== ui.wardrobeCategory) return;
        rows.push({ piece: piece, outfit: outfit });
      });
    });

    var html = '<div class="filters">' +
      filterChips('wardrobe-status', ui.wardrobeStatus, ['owned', 'wishlist', 'bought', 'all'],
        { owned: 'Owned', wishlist: 'Wishlist', bought: 'Bought', all: 'All' }) +
      '<label class="field"><span>Category</span><select id="wardrobe-category">' +
        '<option value="all">All categories</option>' +
        CATEGORIES.map(function (c) {
          return '<option value="' + c + '"' + (ui.wardrobeCategory === c ? ' selected' : '') + '>' + cap(c) + '</option>';
        }).join('') +
      '</select></label>' +
    '</div>';

    if (!rows.length) {
      html += emptyBox('No pieces match these filters.<br>Pieces come from the outfits you tag.');
    } else {
      CATEGORIES.forEach(function (cat) {
        var inCat = rows.filter(function (r) { return r.piece.category === cat; });
        if (!inCat.length) return;
        html += '<section class="group"><h2>' + esc(cat) + ' <small>' + inCat.length + '</small></h2><div class="list">' +
          inCat.map(function (r) {
            return '<a class="card" href="#/item/' + encodeURIComponent(r.outfit.id) + '">' +
              '<div class="card-top"><span class="card-title">' + esc(r.piece.name) + '</span>' + statusBadge(r.outfit.status) + '</div>' +
              '<div class="meta">From: ' + esc(r.outfit.title) + '</div></a>';
          }).join('') +
        '</div></section>';
      });
    }
    view.innerHTML = html;
  }

  // Search results: matches title, note, or piece name. Every typed word must match.
  function renderSearch(query) {
    var words = query.toLowerCase().split(/\s+/).filter(Boolean);
    var results = ItemStore.all().filter(function (item) {
      var text = [item.title, item.note].concat((item.pieces || []).map(function (p) { return p.name; })).join(' ').toLowerCase();
      return words.every(function (w) { return text.indexOf(w) >= 0; });
    }).sort(newestFirst);

    var html = '<div class="row"><p class="hint" style="margin:0">' + results.length + ' result' + (results.length === 1 ? '' : 's') +
      ' for “' + esc(query) + '”</p><button class="btn btn-small" type="button" data-action="clear-search">Clear search</button></div>';
    html += results.length
      ? '<div class="list" style="margin-top:10px">' + results.map(function (i) { return i.type === 'reel' ? reelCard(i, false) : outfitCard(i); }).join('') + '</div>'
      : '<div style="margin-top:10px">' + emptyBox('Nothing found. Try a different word.') + '</div>';
    view.innerHTML = html;
  }

  // Outfit detail: original link, pieces with "where to buy" buttons, status, edit, delete.
  function renderDetail(item) {
    if (!item) {
      view.innerHTML = emptyBox('This item no longer exists.<br><a href="#/outfits">Back to outfits</a>');
      return;
    }
    if (item.type === 'reel') {
      view.innerHTML = '<a class="back" href="#/reels">← Reels</a><div class="list">' + reelCard(item, false) + '</div>';
      return;
    }

    var pieces = item.pieces || [];
    var html = '<a class="back" href="#/outfits">← Outfits</a>' +
      '<h1>' + esc(item.title) + '</h1>' +
      '<p class="meta">Saved ' + esc(shortDate(item.createdAt)) + ' · ' + esc(hostOf(item.url)) + '</p>' +
      '<div class="form-actions">' +
        '<a class="btn btn-primary" href="' + esc(safeHref(item.url)) + '" target="_blank" rel="noopener">Open original post ↗</a>' +
        (navigator.share ? '<button class="btn" type="button" data-action="share" data-id="' + esc(item.id) + '">Share</button>' : '') +
      '</div>' +
      (item.note ? '<h2>Note</h2><p style="margin:0;overflow-wrap:anywhere">' + esc(item.note) + '</p>' : '') +
      (item.budget ? '<h2>Budget</h2><p style="margin:0">' + esc(item.budget) + '</p>' : '') +

      '<h2>Status</h2>' +
      '<div class="chips" role="group" aria-label="Status">' +
        ItemStore.STATUSES.map(function (s) {
          return '<button class="chip" type="button" data-action="set-status" data-value="' + s + '" data-id="' + esc(item.id) + '" aria-pressed="' + (item.status === s) + '">' + STATUS_LABELS[s] + '</button>';
        }).join('') +
      '</div>' +

      '<h2>Pieces &amp; where to buy</h2>';

    if (pieces.length) {
      html += pieces.map(function (p) {
        return '<div class="piece"><div><span class="chip-cat">' + esc(p.category) + '</span><span class="piece-name">' + esc(p.name) + '</span></div>' +
          '<div class="store-links">' +
            STORES.map(function (store) {
              return '<a class="btn btn-small" href="' + esc(storeSearchLink(store, p.name)) + '" target="_blank" rel="noopener">' + esc(store.name) + '</a>';
            }).join('') +
          '</div></div>';
      }).join('');
    } else {
      html += emptyBox('No pieces tagged yet. Tap <b>Edit</b> to add some.');
    }

    html += '<div class="form-actions" style="margin-top:20px">' +
      '<a class="btn" href="#/edit/' + encodeURIComponent(item.id) + '">Edit</a>' +
      '<button class="btn btn-danger" type="button" data-action="delete" data-id="' + esc(item.id) + '">Delete</button>' +
    '</div>';
    view.innerHTML = html;
  }

  // One row in the form's "Pieces" list.
  function pieceRow(piece) {
    piece = piece || { category: 'top', name: '' };
    return '<div class="piece-row">' +
      '<select name="piece-category" aria-label="Piece category">' +
        CATEGORIES.map(function (c) {
          return '<option value="' + c + '"' + (piece.category === c ? ' selected' : '') + '>' + cap(c) + '</option>';
        }).join('') +
      '</select>' +
      '<input type="text" name="piece-name" placeholder="e.g. white linen kurti" aria-label="Piece name" value="' + esc(piece.name) + '">' +
      '<button class="btn" type="button" data-action="remove-piece" aria-label="Remove this piece">✕</button>' +
    '</div>';
  }

  // Add/Edit form. "existing" is the item being edited (or null for a new one).
  function renderForm(existing, preferredType) {
    var shared = existing ? null : ui.shared;
    ui.shared = null; // a shared link is only used once
    var item = existing || {
      type: preferredType === 'reel' ? 'reel' : 'outfit',
      url: shared ? shared.url : '',
      title: shared ? shared.title : '',
      note: shared ? shared.note : '',
      status: 'wishlist',
      pieces: [],
      budget: ''
    };
    var isOutfit = item.type !== 'reel';
    var pieces = (item.pieces && item.pieces.length) ? item.pieces : [null];
    var canPaste = !!(navigator.clipboard && navigator.clipboard.readText);

    view.innerHTML =
      '<a class="back" href="' + (existing ? '#/item/' + encodeURIComponent(existing.id) : (isOutfit ? '#/outfits' : '#/reels')) + '">← Cancel</a>' +
      '<h1>' + (existing ? 'Edit item' : 'Save a link') + '</h1>' +
      '<form id="item-form" class="form" novalidate>' +
        '<label class="field"><span>Link</span>' +
          '<div class="' + (canPaste ? 'input-with-button' : '') + '">' +
            '<input type="text" name="url" inputmode="url" autocomplete="off" placeholder="https://instagram.com/…" value="' + esc(item.url) + '">' +
            (canPaste ? '<button class="btn" type="button" data-action="paste">Paste</button>' : '') +
          '</div></label>' +

        '<div class="field"><span class="label">Section</span><div class="segmented">' +
          '<label><input type="radio" name="type" value="outfit"' + (isOutfit ? ' checked' : '') + '><span>Outfit</span></label>' +
          '<label><input type="radio" name="type" value="reel"' + (!isOutfit ? ' checked' : '') + '><span>Reel</span></label>' +
        '</div></div>' +

        '<label class="field"><span>Title <small class="meta">(optional)</small></span>' +
          '<input type="text" name="title" placeholder="e.g. Ananya\'s brunch look" value="' + esc(item.title) + '"></label>' +
        '<label class="field"><span>Note <small class="meta">(optional)</small></span>' +
          '<textarea name="note" placeholder="Anything to remember">' + esc(item.note) + '</textarea></label>' +

        '<div id="outfit-fields" class="form"' + (isOutfit ? '' : ' hidden') + '>' +
          '<div class="field"><span class="label">Pieces</span>' +
            '<p class="hint" style="margin:0 0 4px">Tag each piece so you can search for it in shops.</p>' +
            '<div id="pieces">' + pieces.map(pieceRow).join('') + '</div>' +
            '<button class="btn" type="button" data-action="add-piece">+ Add piece</button>' +
          '</div>' +
          '<label class="field"><span>Status</span><select name="status">' +
            ItemStore.STATUSES.map(function (s) {
              return '<option value="' + s + '"' + (item.status === s ? ' selected' : '') + '>' + STATUS_LABELS[s] + '</option>';
            }).join('') +
          '</select></label>' +
          '<label class="field"><span>Budget <small class="meta">(optional)</small></span>' +
            '<input type="text" name="budget" placeholder="e.g. ₹800" value="' + esc(item.budget) + '"></label>' +
        '</div>' +

        '<div class="form-actions">' +
          '<button class="btn btn-primary" type="submit">Save</button>' +
          (existing ? '<button class="btn btn-danger" type="button" data-action="delete" data-id="' + esc(existing.id) + '">Delete</button>' : '') +
        '</div>' +
      '</form>';

    if (shared && !shared.url) toast('No link found in what you shared — paste it in the Link box.');
    view.dataset.editing = existing ? existing.id : '';
    if (!existing && !item.url) view.querySelector('input[name="url"]').focus();
  }

  // Read the form and save it.
  function saveForm(form) {
    var fields = form.elements;
    var url = normaliseUrl(fields.namedItem('url').value);
    if (!url) {
      toast('Please paste a valid link (like https://instagram.com/…)');
      fields.namedItem('url').focus();
      return;
    }
    var editingId = view.dataset.editing;

    // Warn when the same link is already saved.
    var duplicate = ItemStore.all().filter(function (i) {
      return i.id !== editingId && sameLinkKey(i.url) === sameLinkKey(url);
    })[0];
    if (duplicate && !confirm('You already saved this link as “' + duplicate.title + '”. Save it again anyway?')) return;

    var type = form.querySelector('input[name="type"]:checked').value;
    var data = {
      type: type,
      url: url,
      title: fields.namedItem('title').value.trim() || autoTitle(url, type),
      note: fields.namedItem('note').value.trim()
    };
    if (type === 'outfit') {
      data.status = fields.namedItem('status').value;
      data.budget = fields.namedItem('budget').value.trim();
      data.pieces = Array.prototype.map.call(form.querySelectorAll('.piece-row'), function (row) {
        return {
          category: row.querySelector('[name="piece-category"]').value,
          name: row.querySelector('[name="piece-name"]').value.trim()
        };
      });
    }

    var saved = editingId ? ItemStore.update(editingId, data) : ItemStore.add(data);
    if (!saved) {
      toast('Could not save — your phone storage may be full.');
      return;
    }
    toast(editingId ? 'Changes saved' : 'Saved!');
    go(saved.type === 'reel' ? '#/reels' : '#/item/' + encodeURIComponent(saved.id));
  }

  // More tab: install, how to save from other apps, backup/restore, about.
  function renderMore() {
    var items = ItemStore.all();
    var outfits = items.filter(function (i) { return i.type === 'outfit'; }).length;
    var reels = items.filter(function (i) { return i.type === 'reel'; });
    var unwatched = reels.filter(function (r) { return !r.watched; }).length;

    var install;
    if (isInstalled()) {
      install = '<p>✅ drinpiN is installed on this device.</p>';
    } else if (ui.installPrompt) {
      install = '<p>Add drinpiN to your home screen so it opens like any other app, and shows up in your Share menu.</p>' +
        '<button class="btn btn-primary btn-block" type="button" data-action="install">Install app</button>';
    } else if (isIPhone()) {
      install = '<p>In Safari, tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</p>';
    } else {
      install = '<p>In Chrome, open the <b>⋮</b> menu and tap <b>Install app</b> or <b>Add to Home screen</b>.</p>';
    }

    view.innerHTML =
      '<h1 class="page-head">More</h1>' +

      '<section class="panel"><h2>Install drinpiN</h2>' + install + '</section>' +

      '<section class="panel"><h2>Save from other apps</h2>' +
        (isIPhone()
          ? '<ol><li>In Instagram or WhatsApp, tap <b>Share → Copy link</b>.</li><li>Open drinpiN, tap <b>Add</b>, then <b>Paste</b>.</li></ol>' +
            '<p class="hint" style="margin:6px 0 0">iPhones don\'t let web apps appear in the Share menu, so copy and paste is the way.</p>'
          : '<ol><li>Install drinpiN (above).</li><li>In Instagram, WhatsApp or YouTube, tap <b>Share</b>.</li><li>Choose <b>drinpiN</b>, and the link is filled in for you.</li></ol>') +
      '</section>' +

      '<section class="panel"><h2>Your data</h2>' +
        '<div class="stats">' +
          '<div class="stat"><b>' + outfits + '</b><span>outfits</span></div>' +
          '<div class="stat"><b>' + reels.length + '</b><span>reels</span></div>' +
          '<div class="stat"><b>' + unwatched + '</b><span>to watch</span></div>' +
        '</div>' +
        '<p class="hint">Everything is stored only on this device. Make a backup now and then, especially before changing phones or clearing your browser.</p>' +
        '<div class="button-stack">' +
          '<button class="btn" type="button" data-action="export">⬇ Download backup</button>' +
          '<button class="btn" type="button" data-action="import">⬆ Restore from backup</button>' +
          '<input id="import-file" type="file" accept="application/json,.json" hidden>' +
          '<button class="btn btn-danger" type="button" data-action="clear-all">Delete everything</button>' +
        '</div>' +
      '</section>' +

      '<section class="panel"><h2>About</h2>' +
        '<p>drinpiN v' + APP_VERSION + ' · Save it. Find it. Wear it.</p>' +
        '<p class="hint" style="margin:0">No account, no ads, no tracking. Shop buttons open each store\'s own search; drinpiN never collects prices or your data.</p>' +
      '</section>';
  }

  /* ================= Backup & restore ================= */

  function exportBackup() {
    var items = ItemStore.all();
    var backup = { app: 'drinpiN', version: 1, exportedAt: new Date().toISOString(), items: items };
    var blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'drinpin-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    toast('Backup downloaded (' + items.length + ' items)');
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var list;
      try {
        var data = JSON.parse(reader.result);
        list = Array.isArray(data) ? data : data.items;
        if (!Array.isArray(list)) throw new Error('no items');
      } catch (e) {
        toast('That file isn\'t a drinpiN backup.');
        return;
      }
      if (!confirm('Restore ' + list.length + ' items from this backup? Items you already have are kept.')) return;
      var count = ItemStore.importItems(list);
      toast(count < 0 ? 'Could not restore — storage may be full.' : 'Restored ' + count + ' items');
      render();
    };
    reader.readAsText(file);
  }

  /* ================= Choosing which screen to show ================= */

  function currentRoute() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    return { name: parts[0] || 'outfits', arg: decodeURIComponent(parts.slice(1).join('/')) };
  }

  // Keep the unwatched count on the Reels tab (and on the app icon, where phones support it).
  function updateBadges() {
    var unwatched = ItemStore.all().filter(function (i) { return i.type === 'reel' && !i.watched; }).length;
    reelBadge.hidden = !unwatched;
    reelBadge.textContent = unwatched > 99 ? '99+' : unwatched;
    if (navigator.setAppBadge) {
      (unwatched ? navigator.setAppBadge(unwatched) : navigator.clearAppBadge()).catch(function () {});
    }
  }

  function render() {
    var route = currentRoute();
    var isTab = ['outfits', 'reels', 'wardrobe'].indexOf(route.name) >= 0;
    var isWelcome = route.name === 'welcome';

    // Search and "Add" only appear on the main tabs; the welcome screen hides everything.
    searchBar.hidden = !isTab;
    addButton.hidden = !isTab;
    document.body.classList.toggle('no-nav', isWelcome);
    document.body.classList.toggle('no-chrome', isWelcome);

    // Which tab is highlighted. Detail/edit screens highlight the item's own section.
    var activeTab = route.name;
    if (route.name === 'item' || route.name === 'edit') {
      var item = ItemStore.get(route.arg);
      activeTab = item && item.type === 'reel' ? 'reels' : 'outfits';
    } else if (route.name === 'add') {
      activeTab = route.arg === 'reel' ? 'reels' : 'outfits';
    }
    tabLinks.forEach(function (a) {
      var on = a.dataset.tab === activeTab;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    updateBadges();

    var query = searchInput.value.trim();
    if (isTab && query) return renderSearch(query);

    switch (route.name) {
      case 'welcome': return renderWelcome();
      case 'reels': return renderReels();
      case 'wardrobe': return renderWardrobe();
      case 'more': return renderMore();
      case 'item': return renderDetail(ItemStore.get(route.arg));
      case 'add': return renderForm(null, route.arg);
      case 'edit':
        var toEdit = ItemStore.get(route.arg);
        return toEdit ? renderForm(toEdit) : renderDetail(null);
      default: return renderOutfits();
    }
  }

  /* ================= Button clicks ================= */

  view.addEventListener('click', function (event) {
    var target = event.target.closest('[data-action]');
    if (!target) return;
    var id = target.dataset.id;
    var value = target.dataset.value;

    switch (target.dataset.action) {
      case 'start':
        setPref(PREFS.welcomed, '1');
        go('#/outfits');
        return;
      case 'pick': {
        var unwatched = ofType('reel').filter(function (r) { return !r.watched; });
        if (!unwatched.length) {
          toast('No unwatched reels — your queue is empty.');
          return;
        }
        // Avoid picking the same reel twice in a row when there's a choice.
        var choices = unwatched.length > 1
          ? unwatched.filter(function (r) { return r.id !== ui.pickedReelId; })
          : unwatched;
        ui.pickedReelId = choices[Math.floor(Math.random() * choices.length)].id;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      case 'watched':
        ItemStore.update(id, { watched: true });
        if (ui.pickedReelId === id) ui.pickedReelId = null;
        toast('Marked as watched', 'Undo', function () {
          ItemStore.update(id, { watched: false });
          render();
        });
        render();
        return;
      case 'unwatched':
        ItemStore.update(id, { watched: false });
        toast('Back in your queue');
        render();
        return;
      case 'set-status':
        ItemStore.update(id, { status: value });
        toast('Marked as ' + STATUS_LABELS[value]);
        render();
        return;
      case 'hide-rediscover':
        setPref(PREFS.rediscoverHidden, String(Math.floor(Date.now() / DAY)));
        render();
        return;
      case 'outfit-filter':
        ui.outfitFilter = value;
        render();
        return;
      case 'wardrobe-status':
        ui.wardrobeStatus = value;
        render();
        return;
      case 'delete': {
        var item = ItemStore.get(id);
        if (!item) return;
        ItemStore.remove(id);
        go(item.type === 'reel' ? '#/reels' : '#/outfits');
        render(); // in case we were already on that screen
        toast('Deleted “' + item.title + '”', 'Undo', function () {
          ItemStore.restore(item);
          render();
          toast('Restored');
        }, 6000);
        return;
      }
      case 'share': {
        var toShare = ItemStore.get(id);
        if (toShare) navigator.share({ title: toShare.title, url: toShare.url }).catch(function () {});
        return;
      }
      case 'paste':
        navigator.clipboard.readText().then(function (text) {
          var link = findLink(text) || text.trim();
          if (!link) { toast('Your clipboard is empty.'); return; }
          var input = view.querySelector('input[name="url"]');
          input.value = link;
          // Pick Outfit/Reel automatically for a fresh form.
          if (!view.dataset.editing && findLink(link)) {
            var radio = view.querySelector('input[name="type"][value="' + guessType(link) + '"]');
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }).catch(function () {
          toast('Couldn\'t read the clipboard — press and hold the Link box, then tap Paste.');
        });
        return;
      case 'add-piece': {
        var list = document.getElementById('pieces');
        list.insertAdjacentHTML('beforeend', pieceRow(null));
        list.lastElementChild.querySelector('input').focus();
        return;
      }
      case 'remove-piece':
        target.closest('.piece-row').remove();
        return;
      case 'clear-search':
        searchInput.value = '';
        render();
        return;
      case 'install':
        if (!ui.installPrompt) return;
        ui.installPrompt.prompt();
        ui.installPrompt.userChoice.finally(function () {
          ui.installPrompt = null;
          render();
        });
        return;
      case 'export':
        exportBackup();
        return;
      case 'import':
        document.getElementById('import-file').click();
        return;
      case 'clear-all':
        if (!confirm('Delete ALL your outfits and reels from this device? Download a backup first if you might want them back.')) return;
        ItemStore.clearAll();
        ui.pickedReelId = null;
        toast('Everything deleted');
        render();
        return;
    }
  });

  view.addEventListener('change', function (event) {
    // Switching Outfit/Reel in the form shows or hides the outfit-only fields.
    if (event.target.name === 'type') {
      document.getElementById('outfit-fields').hidden = event.target.value !== 'outfit';
    }
    if (event.target.id === 'wardrobe-category') {
      ui.wardrobeCategory = event.target.value;
      render();
    }
    if (event.target.id === 'import-file' && event.target.files[0]) {
      importBackup(event.target.files[0]);
      event.target.value = '';
    }
  });

  view.addEventListener('submit', function (event) {
    event.preventDefault();
    saveForm(event.target);
  });

  searchInput.addEventListener('input', render);

  addButton.addEventListener('click', function () {
    go('#/add/' + (currentRoute().name === 'reels' ? 'reel' : 'outfit'));
  });

  window.addEventListener('hashchange', function () {
    render();
    window.scrollTo(0, 0);
  });

  // Android offers to install the app; keep that offer for the "Install app" button.
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    ui.installPrompt = event;
    if (currentRoute().name === 'more') render();
  });

  window.addEventListener('appinstalled', function () {
    ui.installPrompt = null;
    toast('drinpiN installed! 🎉');
  });

  /* ================= Links shared from other apps ================= */

  // When Android's Share menu opens the app, the shared link arrives in the
  // address as ?url=…, ?text=… or ?title=… (apps differ in which one they use).
  function readSharedLink() {
    var params = new URLSearchParams(location.search);
    if (!params.has('url') && !params.has('text') && !params.has('title')) return false;

    var sharedTitle = params.get('title') || '';
    var sharedText = params.get('text') || '';
    var url = findLink([params.get('url'), sharedText, sharedTitle].filter(Boolean).join(' '));

    ui.shared = {
      url: url,
      title: /https?:\/\//i.test(sharedTitle) ? '' : sharedTitle,
      // Any extra text (like a caption) goes into the note, minus the link itself.
      note: sharedText.replace(url, '').trim()
    };
    // Remove the ?… part so a reload doesn't add the link again, and open the form.
    history.replaceState(null, '', location.pathname + '#/add/' + (url ? guessType(url) : 'outfit'));
    return true;
  }

  /* ================= Start ================= */

  var cameFromShare = readSharedLink();
  // Show the welcome screen once, to brand-new users who didn't arrive by sharing a link.
  if (!cameFromShare && !getPref(PREFS.welcomed) && !ItemStore.all().length) {
    history.replaceState(null, '', location.pathname + '#/welcome');
  }
  if (cameFromShare) setPref(PREFS.welcomed, '1');
  render();

  // Offline support: only works when served from a web address (not a file on disk).
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    var hadWorker = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.warn('Offline mode not available:', err);
    });
    // When a new version of the app takes over, offer a reload.
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hadWorker) toast('drinpiN was updated.', 'Reload', function () { location.reload(); }, 10000);
      hadWorker = true;
    });
  }
})();
