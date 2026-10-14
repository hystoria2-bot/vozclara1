import { defineConfig } from "vite";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const runtimeFiles = [
  {
    source: "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs",
    target: "runtime/onnx/ort-wasm-simd-threaded.asyncify.mjs",
  },
  {
    source: "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm",
    target: "runtime/onnx/ort-wasm-simd-threaded.asyncify.wasm",
  },
  {
    source:
      "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs",
    target: "runtime/onnx/ort-wasm-simd-threaded.jsep.mjs",
  },
  {
    source:
      "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm",
    target: "runtime/onnx/ort-wasm-simd-threaded.jsep.wasm",
  },
  {
    source: "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jspi.mjs",
    target: "runtime/onnx/ort-wasm-simd-threaded.jspi.mjs",
  },
  {
    source: "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jspi.wasm",
    target: "runtime/onnx/ort-wasm-simd-threaded.jspi.wasm",
  },
  {
    source:
      "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs",
    target: "runtime/onnx/ort-wasm-simd-threaded.mjs",
  },
  {
    source:
      "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm",
    target: "runtime/onnx/ort-wasm-simd-threaded.wasm",
  },
];

function prepareLocalVoiceRuntime() {
  return {
    name: "prepare-local-voice-runtime",
    async configResolved(config) {
      for (const file of runtimeFiles) {
        const source = resolve(config.root, file.source);
        const target = resolve(config.publicDir, file.target);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(source, target);
      }
    },
  };
}

export default defineConfig({
  base: "./",
  server: {
    host: "127.0.0.1",
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  plugins: [prepareLocalVoiceRuntime()],
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
