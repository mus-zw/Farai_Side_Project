import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import {defaultClientConditions, defineConfig, type Plugin} from 'vite';

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
function ortWasmAssets(): Plugin {
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
      for (const name of Object.keys(files)) {
        this.emitFile({type: 'asset', fileName: `ort/${name}`, source: fs.readFileSync(path.join(dir, name))});
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), ortWasmAssets()],
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
