import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In `npm run dev`, serve the Vercel-style functions in /api so link previews work locally.
function devApi() {
  return {
    name: 'fxd-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0];
        const routes = { '/api/oembed': '/api/oembed.js', '/api/status': '/api/status.js' };
        if (!routes[path]) return next();
        try {
          const mod = await server.ssrLoadModule(routes[path]);
          await mod.default(req, res);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, code: 'dev_error', message: String(err && err.message) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  build: {
    // iPhone 7 Plus tops out at iOS 15.8, which is Safari 15.
    // (esbuild cannot transpile destructuring for "safari14", so the floor is safari15.)
    target: ['es2020', 'safari15', 'chrome87', 'firefox78', 'edge88'],
    sourcemap: false,
  },
  server: { host: true },
  preview: { host: true },
});
