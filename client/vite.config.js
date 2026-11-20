import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API runs on 5050. Port 5000 is taken by AirPlay Receiver on macOS.
const target = process.env.VITE_API_TARGET || 'http://localhost:5050';

// When the API is not running, answer with a clear JSON error instead of an empty 500,
// so the sign-in page can say what is wrong.
const explainProxyErrors = (proxy) => {
  proxy.on('error', (err, req, res) => {
    if (!res || res.headersSent || typeof res.writeHead !== 'function') return;
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `The API server is not running at ${target} (${err.code || err.message}). Start it with "cd server && npm run dev", and make sure MongoDB and Redis are running.` }));
  });
};

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '^/api/': { target, changeOrigin: true, configure: explainProxyErrors },
      '/socket.io': { target, ws: true, changeOrigin: true },
    },
  },
});
