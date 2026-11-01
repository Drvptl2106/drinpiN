/// <reference types="vitest/config" />
// Build settings. The "PWA" part makes drinpiN installable, work offline,
// and appear in Android's Share menu.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative paths, so the same build works on GitHub Pages (/drinpin/) or any other host.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      filename: 'sw.js', // same name as the old app's worker, so installed phones upgrade cleanly
      includeAssets: ['icons/icon.svg', 'icons/icon-180.png', 'icons/icon-32.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['screenshots/**'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true
      },
      manifest: {
        id: './',
        name: 'drinpiN — save outfits, find the pieces',
        short_name: 'drinpiN',
        description: 'Save outfit links from Instagram and anywhere else, tag every piece, and find where to buy it.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#141012',
        theme_color: '#fbf8f4',
        categories: ['lifestyle', 'shopping'],
        lang: 'en',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'Save an outfit', short_name: 'Save', url: './#/new', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'To sort', short_name: 'To sort', url: './#/?filter=unsorted', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Wardrobe', short_name: 'Wardrobe', url: './#/wardrobe', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] }
        ],
        screenshots: [
          { src: 'screenshots/home.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'All your saved outfits' },
          { src: 'screenshots/detail.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Find every piece in your favourite shops' },
          { src: 'screenshots/editor.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Tag pieces in a few taps' }
        ],
        // Sharing a link to drinpiN opens "./?url=…&text=…&title=…", which saves it straight away.
        share_target: {
          action: './',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' }
        }
      }
    })
  ],
  test: {
    environment: 'node'
  }
});
