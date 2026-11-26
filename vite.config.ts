import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import {defaultClientConditions, defineConfig, loadEnv, type Plugin} from 'vite';

/**
 * Makes ONNX Runtime Web's wasm files available at /ort/ for in-browser
 * detection (src/services/browserInference.ts points the runtime there).
 *
 * The default `onnxruntime-web` entry is the JSEP build: one wasm file serves
 * both the WebGPU and the CPU/WASM backends. It is about 30 MB, so it is
 * copied from node_modules into the build output instead of being committed,
 * and served straight from node_modules by the dev server. It is only
 * downloaded when someone runs detection in the browser.
 */
function ortWasmAssets(external: boolean): Plugin {
  const dir = path.resolve(__dirname, 'node_modules/onnxruntime-web/dist');
  const files: Record<string, string> = {
    'ort-wasm-simd-threaded.jsep.wasm': 'application/wasm',
    'ort-wasm-simd-threaded.jsep.mjs': 'text/javascript',
  };
  return {
    name: 'ort-wasm-assets',
    configureServer(server) {
      server.middlewares.use('/ort/', (req, res, next) => {
        const name = path.basename((req.url ?? '').split('?')[0]);
        if (!(name in files)) return next();
        res.setHeader('Content-Type', files[name]);
        fs.createReadStream(path.join(dir, name)).pipe(res);
      });
    },
    generateBundle() {
      // With VITE_ORT_WASM_BASE_URL set the runtime is served from elsewhere (R2, a CDN), so the
      // ~28 MiB wasm is left out of the build instead of breaking a 25 MiB-per-file static host.
      if (external) {
        this.info('VITE_ORT_WASM_BASE_URL is set: ONNX Runtime wasm is NOT copied into dist/ (host ort-wasm-simd-threaded.jsep.mjs and .wasm there).');
        return;
      }
      for (const name of Object.keys(files)) {
        this.emitFile({type: 'asset', fileName: `ort/${name}`, source: fs.readFileSync(path.join(dir, name))});
      }
    },
  };
}

/**
 * Makes MediaPipe Tasks Vision's wasm files available at /mediapipe/wasm/ for
 * the Form Coach (src/components/fitness/FormCoach.tsx points FilesetResolver
 * there). They are about 29 MB in total, so like the ONNX runtime they are
 * copied from node_modules into the build instead of being committed, and
 * only downloaded when someone opens the Coach tab and starts it.
 */
function mediapipeWasmAssets(external: boolean): Plugin {
  const dir = path.resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm');
  const type = (name: string) => (name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
  const list = () => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /\.(js|wasm)$/.test(n)) : []);
  return {
    name: 'mediapipe-wasm-assets',
    configureServer(server) {
      server.middlewares.use('/mediapipe/wasm/', (req, res, next) => {
        const name = path.basename((req.url ?? '').split('?')[0]);
        if (!list().includes(name)) return next();
        res.setHeader('Content-Type', type(name));
        fs.createReadStream(path.join(dir, name)).pipe(res);
      });
    },
    generateBundle() {
      if (external) return; // VITE_MEDIAPIPE_WASM_BASE_URL is set: served from elsewhere
      for (const name of list()) {
        this.emitFile({type: 'asset', fileName: `mediapipe/wasm/${name}`, source: fs.readFileSync(path.join(dir, name))});
      }
    },
  };
}

const MAX_STATIC_FILE_BYTES = 25 * 1024 * 1024; // Cloudflare Pages: 25 MiB per file

/**
 * After the build, list any output file over Cloudflare Pages' 25 MiB limit and say how to fix it.
 * Locally this is a warning. On Cloudflare Pages (which sets CF_PAGES=1), or with
 * ENFORCE_ASSET_LIMIT=1, it fails the build, so a deploy that would be rejected is caught here.
 */
function assetSizeGuard(): Plugin {
  return {
    name: 'asset-size-guard',
    apply: 'build',
    writeBundle(options) {
      const out = path.resolve(__dirname, options.dir ?? 'dist');
      const big: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else if (fs.statSync(p).size > MAX_STATIC_FILE_BYTES) big.push(`${path.relative(out, p)} (${(fs.statSync(p).size / 1048576).toFixed(1)} MiB)`);
        }
      };
      if (fs.existsSync(out)) walk(out);
      if (big.length === 0) return;
      const msg =
        `\nFiles over Cloudflare Pages' 25 MiB single-file limit:\n  - ${big.join('\n  - ')}\n` +
        `Serve them from object storage instead (see .env.example): set VITE_ORT_WASM_BASE_URL for the ONNX Runtime wasm, ` +
        `VITE_MODEL_BASE_URL for models, then upload those files to R2/CDN.\n`;
      if (process.env.CF_PAGES === '1' || process.env.ENFORCE_ASSET_LIMIT === '1') throw new Error(msg);
      console.warn(msg);
    },
  };
}

/**
 * Whether a VITE_* base URL is really set. Blank or whitespace-only counts as unset, matching
 * resolveBase() in src/utils/modelUrls.ts: if the build and the runtime disagreed, the wasm could be
 * left out of dist/ while the app still looked for it locally.
 */
const isSet = (v: string | undefined) => typeof v === 'string' && v.trim() !== '';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss(), ortWasmAssets(isSet(env.VITE_ORT_WASM_BASE_URL)), mediapipeWasmAssets(isSet(env.VITE_MEDIAPIPE_WASM_BASE_URL)), assetSizeGuard()],
    resolve: {
      // Use onnxruntime-web's "extern wasm" build: it loads its wasm from the
      // /ort/ path set in browserInference.ts (see ortWasmAssets above) instead
      // of making Vite bundle a second, hashed 28 MB copy of the same file.
      conditions: [...defaultClientConditions, 'onnxruntime-web-use-extern-wasm'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
