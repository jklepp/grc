import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Meta-tag CSP only covers what a static GitHub Pages deploy can control.
// It's build-only: Vite dev injects an inline React-refresh preamble script
// that a script-src without 'unsafe-inline' would block.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ')

function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
  }
}

export default defineConfig({
  base: '/grc/',
  plugins: [react(), tailwindcss(), cspPlugin()],
})