import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    {
      name: 'fix-admin-manifest',
      enforce: 'post',
      generateBundle(options, bundle) {
        if (bundle['admin.html']) {
          bundle['admin.html'].source = bundle['admin.html'].source.replace(
            'manifest.webmanifest',
            'admin.webmanifest'
          );
        }
      }
    },
    react(),
    VitePWA({
      // injectManifest: VitePWA injicerar precache-manifestet i vår custom sw.js
      // via self.__WB_MANIFEST. Detta möjliggör push/notificationclick-handlers.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
      },
      manifest: {
        name: 'Hammarö Maskin & Smide',
        short_name: 'Hammarö',
        description: 'Hammarö Maskin & Smide',
        theme_color: '#1e2123',
        background_color: '#1e2123',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: './index.html',
        admin: './admin.html'
      }
    }
  },
})
