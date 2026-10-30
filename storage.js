/*
  storage.js — saves and loads your items.

  Everything lives in the browser's own storage ("localStorage") under the
  key "saver.items", as one list written in JSON. There is no server and no
  account: the data stays on this phone/browser only.
*/
var ItemStore = (function () {
  'use strict';

  var KEY = 'saver.items';
  var CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'other'];
  var STATUSES = ['wishlist', 'owned', 'bought'];

  // Read the whole list. If anything is broken or missing, start with an empty list.
  function loadAll() {
    try {
      var raw = localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      console.warn('Could not read saved items:', err);
      return [];
    }
  }

  // Write the whole list back. Returns false if the browser refused (for example, storage full).
  function saveAll(items) {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
      return true;
    } catch (err) {
      console.warn('Could not save items:', err);
      return false;
    }
  }

  // A unique id for each new item.
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Tidy an item so it always has exactly the fields its type needs.
  // Reels keep "watched"; outfits keep "status", "pieces" and "budget".
  function shape(item) {
    var out = {
      id: item.id,
      type: item.type === 'reel' ? 'reel' : 'outfit',
      url: String(item.url || ''),
      title: String(item.title || ''),
      note: String(item.note || ''),
      createdAt: item.createdAt
    };
    if (out.type === 'reel') {
      out.watched = !!item.watched;
    } else {
      out.status = STATUSES.indexOf(item.status) >= 0 ? item.status : 'wishlist';
      out.pieces = (item.pieces || [])
        .map(function (p) {
          return {
            category: CATEGORIES.indexOf(p.category) >= 0 ? p.category : 'other',
            name: String(p.name || '').trim()
          };
        })
        .filter(function (p) { return p.name; });
      out.budget = String(item.budget || '');
    }
    return out;
  }

  function all() {
    return loadAll();
  }

  function get(id) {
    return loadAll().filter(function (i) { return i.id === id; })[0] || null;
  }

  // Add a new item at the top of the list. Returns the saved item, or null if saving failed.
  function add(data) {
    var item = shape(Object.assign({}, data, { id: newId(), createdAt: new Date().toISOString() }));
    var items = loadAll();
    items.unshift(item);
    return saveAll(items) ? item : null;
  }

  // Change some fields of an existing item. Returns the updated item, or null.
  function update(id, changes) {
    var items = loadAll();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        items[i] = shape(Object.assign({}, items[i], changes, { id: items[i].id, createdAt: items[i].createdAt }));
        return saveAll(items) ? items[i] : null;
      }
    }
    return null;
  }

  function remove(id) {
    return saveAll(loadAll().filter(function (i) { return i.id !== id; }));
  }

  return {
    CATEGORIES: CATEGORIES,
    STATUSES: STATUSES,
    all: all,
    get: get,
    add: add,
    update: update,
    remove: remove
  };
})();
