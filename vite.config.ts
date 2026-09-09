import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

/* Kalau diakses lewat `tailscale serve`, HMR harus lewat wss di port
   HTTPS-nya bridge — port itu dibaca dari .bridge.json. */
const tunneled = process.env.ZII_TUNNEL === '1';
let bridgePort = 0;
try {
  bridgePort = Number(JSON.parse(readFileSync('.bridge.json', 'utf8')).port) || 0;
} catch {
  /* bridge belum nyala */
}

const extraHosts = (process.env.ZII_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // '.ts.net' nyocokin semua subdomain tailnet
    allowedHosts: ['.ts.net', ...extraHosts],
    proxy: { '/api': 'http://127.0.0.1:8787' },
    ...(tunneled && bridgePort
      ? { hmr: { protocol: 'wss', clientPort: bridgePort } }
      : {}),
  },
  build: { outDir: 'dist' },
});
