// Copia o runtime do onnxruntime-web (JS + WASM) para public/ort, para o "Contador ao vivo"
// rodar o YOLO no navegador sem depender de CDN. Executado antes de `dev` e `build`.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const src = "node_modules/onnxruntime-web/dist";
const dst = "public/ort";
mkdirSync(dst, { recursive: true });
const files = readdirSync(src).filter((f) => f === "ort.webgpu.min.js" || /^ort-wasm-simd-threaded\.asyncify\.(mjs|wasm)$/.test(f));
for (const f of files) copyFileSync(join(src, f), join(dst, f));
console.log(`onnxruntime-web → ${dst}: ${files.join(", ")}`);
