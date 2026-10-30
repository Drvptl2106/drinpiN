/*
  app.js — all the screens and buttons.

  How it works, in short:
  - The end of the page address says which screen to show, for example
    "#/reels" or "#/item/abc123". Whenever it changes, render() draws the
    matching screen into <main id="view">.
  - Data comes from ItemStore (storage.js). Shop links come from STORES (stores.js).
*/
(function () {
  'use strict';

  var CATEGORIES = ItemStore.CATEGORIES;
  var STATUS_LABELS = { wishlist: 'Wishlist', owned: 'Owned', bought: 'Bought' };

  var view = document.getElementById('view');
  var searchBar = document.getElementById('search-bar');
  var searchInput = document.getElementById('search');
  var tabLinks = document.querySelectorAll('#tabs a');
  var addButton = document.getElementById('add-button');
  var toastBox = document.getElementById('toast');

  // Screen settings that don't need saving.
  var ui = {
    wardrobeStatus: 'owned', // Owned / Wishlist / Bought / all
    wardrobeCategory: 'all',
    pickedReelId: null,      // the reel chosen by "Pick one for me"
    shared: null             // a link that arrived from the phone's Share menu
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

  function shortDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function toast(message) {
    toastBox.textContent = message;
    toastBox.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { toastBox.classList.remove('show'); }, 2600);
  }

  function go(hash) {
    location.hash = hash;
  }

  // Turn whatever was pasted into a proper web address, or '' if it isn't one.
  // "instagram.com/p/abc" becomes "https://instagram.com/p/abc".
  function normaliseUrl(raw) {
    var text = String(raw || '').trim();
    if (!text) return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = 'https://' + text;
    try {
      var u = new URL(text);
      return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.indexOf('.') > 0 ? u.href : '';
    } catch (e) {
      return '';
    }
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
    var site = names[first] || (first.charAt(0).toUpperCase() + first.slice(1));
    return site + ' ' + type;
  }

  function newestFirst(a, b) {
    return String(b.createdAt).localeCompare(String(a.createdAt));
  }

  function ofType(type) {
    return ItemStore.all().filter(function (i) { return i.type === type; }).sort(newestFirst);
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
      '<div class="meta">' + esc(hostOf(item.url)) + ' · saved ' + esc(shortDate(item.createdAt)) + '</div>' +
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

  function emptyBox(text) {
    return '<div class="empty">' + text + '</div>';
  }

  /* ================= Screens ================= */

  // Outfits tab: every saved outfit, newest first.
  function renderOutfits() {
    var outfits = ofType('outfit');
    view.innerHTML = outfits.length
      ? '<div class="list">' + outfits.map(outfitCard).join('') + '</div>'
      : emptyBox('No outfits yet.<br>Tap <b>+ Add</b> to save an outfit link.');
  }

  // Reels tab: unwatched queue, "Pick one for me", and watched reels below.
  function renderReels() {
    var reels = ofType('reel');
    var unwatched = reels.filter(function (r) { return !r.watched; });
    var watched = reels.filter(function (r) { return r.watched; });
    var pick = unwatched.filter(function (r) { return r.id === ui.pickedReelId; })[0];
    if (!pick) ui.pickedReelId = null;

    var html = '<div class="row"><h2 style="margin:0">Unwatched (' + unwatched.length + ')</h2>' +
      '<button class="btn btn-primary" type="button" data-action="pick">🎲 Pick one for me</button></div>';

    if (pick) html += '<div class="list" style="margin-top:12px">' + reelCard(pick, true) + '</div>';

    var rest = unwatched.filter(function (r) { return r !== pick; });
    if (rest.length) {
      html += '<div class="list" style="margin-top:12px">' + rest.map(function (r) { return reelCard(r, false); }).join('') + '</div>';
    } else if (!pick) {
      html += '<div style="margin-top:12px">' + emptyBox('Your watch-later queue is empty.<br>Tap <b>+ Add</b> to save a reel link.') + '</div>';
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

    var statusChoices = ['owned', 'wishlist', 'bought', 'all'];
    var html = '<div class="filters">' +
      '<div class="chips" role="group" aria-label="Filter by status">' +
        statusChoices.map(function (s) {
          return '<button class="chip" type="button" data-action="wardrobe-status" data-status="' + s + '" aria-pressed="' + (ui.wardrobeStatus === s) + '">' +
            (s === 'all' ? 'All' : STATUS_LABELS[s]) + '</button>';
        }).join('') +
      '</div>' +
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

  function cap(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
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
      '<a class="btn btn-primary btn-block" href="' + esc(safeHref(item.url)) + '" target="_blank" rel="noopener">Open original post ↗</a>' +
      (item.note ? '<h2>Note</h2><p style="margin:0;overflow-wrap:anywhere">' + esc(item.note) + '</p>' : '') +
      (item.budget ? '<h2>Budget</h2><p style="margin:0">' + esc(item.budget) + '</p>' : '') +

      '<h2>Status</h2><div class="chips" role="group" aria-label="Status">' +
        ItemStore.STATUSES.map(function (s) {
          return '<button class="chip" type="button" data-action="set-status" data-status="' + s + '" data-id="' + esc(item.id) + '" aria-pressed="' + (item.status === s) + '">' + STATUS_LABELS[s] + '</button>';
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

    view.innerHTML =
      '<a class="back" href="' + (existing ? '#/item/' + encodeURIComponent(existing.id) : (isOutfit ? '#/outfits' : '#/reels')) + '">← Cancel</a>' +
      '<h1>' + (existing ? 'Edit item' : 'Save a link') + '</h1>' +
      '<form id="item-form" class="form" novalidate>' +
        '<label class="field"><span>Link</span>' +
          '<input type="text" name="url" inputmode="url" autocomplete="off" placeholder="Paste a link, e.g. https://instagram.com/…" value="' + esc(item.url) + '"></label>' +

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

    var editingId = view.dataset.editing;
    var saved = editingId ? ItemStore.update(editingId, data) : ItemStore.add(data);
    if (!saved) {
      toast('Could not save — your browser storage may be full.');
      return;
    }
    toast(editingId ? 'Changes saved' : 'Saved!');
    go(saved.type === 'reel' ? '#/reels' : '#/item/' + encodeURIComponent(saved.id));
  }

  /* ================= Choosing which screen to show ================= */

  function currentRoute() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    return { name: parts[0] || 'outfits', arg: decodeURIComponent(parts.slice(1).join('/')) };
  }

  function render() {
    var route = currentRoute();
    var isTab = ['outfits', 'reels', 'wardrobe'].indexOf(route.name) >= 0;

    // Search and "+ Add" only appear on the three main tabs.
    searchBar.hidden = !isTab;
    addButton.hidden = !isTab;

    // Which tab is underlined. Detail/edit screens underline the item's own section.
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

    var query = searchInput.value.trim();
    if (isTab && query) return renderSearch(query);

    switch (route.name) {
      case 'reels': return renderReels();
      case 'wardrobe': return renderWardrobe();
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

    switch (target.dataset.action) {
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
        toast('Marked as watched');
        render();
        return;
      case 'unwatched':
        ItemStore.update(id, { watched: false });
        toast('Back in your queue');
        render();
        return;
      case 'set-status':
        ItemStore.update(id, { status: target.dataset.status });
        toast('Status: ' + STATUS_LABELS[target.dataset.status]);
        render();
        return;
      case 'delete': {
        var item = ItemStore.get(id);
        if (!item || !confirm('Delete “' + item.title + '”? This can’t be undone.')) return;
        ItemStore.remove(id);
        toast('Deleted');
        go(item.type === 'reel' ? '#/reels' : '#/outfits');
        return;
      }
      case 'add-piece': {
        var list = document.getElementById('pieces');
        list.insertAdjacentHTML('beforeend', pieceRow(null));
        list.lastElementChild.querySelector('input').focus();
        return;
      }
      case 'remove-piece':
        target.closest('.piece-row').remove();
        return;
      case 'wardrobe-status':
        ui.wardrobeStatus = target.dataset.status;
        render();
        return;
      case 'clear-search':
        searchInput.value = '';
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

  /* ================= Links shared from other apps ================= */

  // When Android's Share menu opens the app, the shared link arrives in the
  // address as ?url=…, ?text=… or ?title=… (apps differ in which one they use).
  function readSharedLink() {
    var params = new URLSearchParams(location.search);
    if (!params.has('url') && !params.has('text') && !params.has('title')) return;

    var sharedTitle = params.get('title') || '';
    var sharedText = params.get('text') || '';
    var all = [params.get('url'), sharedText, sharedTitle].filter(Boolean).join(' ');
    var match = all.match(/https?:\/\/[^\s<>"]+/i);
    var url = match ? match[0] : '';

    ui.shared = {
      url: url,
      title: /https?:\/\//i.test(sharedTitle) ? '' : sharedTitle,
      // Any extra text (like a caption) goes into the note, minus the link itself.
      note: sharedText.replace(url, '').trim()
    };
    // Remove the ?… part so a reload doesn't add the link again, and open the form.
    history.replaceState(null, '', location.pathname + '#/add/' + (url ? guessType(url) : 'outfit'));
  }

  /* ================= Start ================= */

  readSharedLink();
  render();

  // Offline support: only works when served from a web address (not a file on disk).
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.warn('Offline mode not available:', err);
    });
  }
})();
