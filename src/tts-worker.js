import { env as transformersEnv, pipeline } from "@huggingface/transformers";
import * as lame from "@breezystack/lamejs";
import { floatToInt16 } from "./audio-utils.js";
import { normalizeSpanishForSpeech } from "./spanish-normalizer.js";

const MODEL_ID = "onnx-community/Supertonic-TTS-2-ONNX";
const SAMPLE_RATE = 44100;
const threadCount = 1;

// The interface already runs inference in this dedicated worker. One WASM
// thread is the most stable fallback in Chromium; compatible GPUs use WebGPU.
transformersEnv.backends.onnx.wasm.numThreads = threadCount;
transformersEnv.allowLocalModels = false;

let enginePromise;
let activeDevice = "wasm";
const voiceCache = new Map();

function post(id, type, detail = {}, transfer = []) {
  self.postMessage({ id, type, ...detail }, transfer);
}

async function loadVoiceVector(voice) {
  if (voiceCache.has(voice)) return voiceCache.get(voice);

  const url = `https://huggingface.co/${MODEL_ID}/resolve/main/voices/${voice}.bin`;
  let response;

  try {
    const cache = await caches.open("voz-clara-supertonic-voices-v1");
    response = await cache.match(url);
    if (!response) {
      response = await fetch(url);
      if (!response.ok) throw new Error(`No se pudo descargar la voz (${response.status})`);
      await cache.put(url, response.clone());
    }
  } catch (error) {
    response = await fetch(url);
    if (!response.ok) throw error;
  }

  const vector = new Float32Array(await response.arrayBuffer());
  voiceCache.set(voice, vector);
  return vector;
}

async function createEngine(progressCallback) {
  const devices = self.navigator?.gpu ? ["webgpu", "wasm"] : ["wasm"];
  let lastError;

  for (const device of devices) {
    try {
      const synthesizer = await pipeline("text-to-speech", MODEL_ID, {
        device,
        progress_callback: progressCallback,
      });
      activeDevice = device;
      return synthesizer;
    } catch (error) {
      lastError = error;
      if (device !== "webgpu") throw error;
    }
  }

  throw lastError;
}

async function getEngine(progressCallback) {
  if (!enginePromise) {
    enginePromise = createEngine(progressCallback).catch((error) => {
      enginePromise = undefined;
      throw error;
    });
  }
  return enginePromise;
}

class Mp3StreamEncoder {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.encoder = new lame.Mp3Encoder(1, sampleRate, 128);
    this.chunks = [];
  }

  add(samples) {
    const pcm = floatToInt16(samples);
    const blockSize = 1152;
    for (let offset = 0; offset < pcm.length; offset += blockSize) {
      const encoded = this.encoder.encodeBuffer(pcm.subarray(offset, offset + blockSize));
      if (encoded.length) this.chunks.push(new Uint8Array(encoded));
    }
  }

  addSilence(seconds) {
    this.add(new Float32Array(Math.round(this.sampleRate * seconds)));
  }

  finish() {
    const finalChunk = this.encoder.flush();
    if (finalChunk.length) this.chunks.push(new Uint8Array(finalChunk));
    const size = this.chunks.reduce((total, chunk) => total + chunk.length, 0);
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}

function samplePeaks(samples, targetBucket = 2200) {
  const peaks = [];
  for (let start = 0; start < samples.length; start += targetBucket) {
    let peak = 0;
    for (let index = start; index < Math.min(start + targetBucket, samples.length); index += 1) {
      peak = Math.max(peak, Math.abs(samples[index]));
    }
    peaks.push(peak);
  }
  return peaks;
}

self.addEventListener("message", async (event) => {
  const { type, id, chunks, voice, speed, qualitySteps, normalizeNumbers, runtimeBaseUrl } = event.data ?? {};
  if (type !== "generate" || !id) return;

  try {
    transformersEnv.backends.onnx.wasm.wasmPaths = runtimeBaseUrl;
    const engine = await getEngine((progress) => {
      const safeProgress = {
        status: progress?.status,
        file: progress?.file,
        loaded: progress?.loaded,
        total: progress?.total,
        progress: progress?.progress,
      };
      post(id, "model-progress", { progress: safeProgress });
    });
    const speakerEmbeddings = await loadVoiceVector(voice);
    post(id, "engine-ready", { device: activeDevice, threads: threadCount });

    const encoder = new Mp3StreamEncoder(SAMPLE_RATE);
    const peaks = [];
    const startTime = performance.now();

    for (let index = 0; index < chunks.length; index += 1) {
      post(id, "chunk-start", { index, total: chunks.length });
      const spokenText = normalizeNumbers ? normalizeSpanishForSpeech(chunks[index]) : chunks[index];
      const output = await engine(`<es>${spokenText}</es>`, {
        speaker_embeddings: speakerEmbeddings,
        num_inference_steps: qualitySteps,
        speed,
      });
      const samples = output.audio;
      encoder.add(samples);
      peaks.push(...samplePeaks(samples));
      if (index < chunks.length - 1) encoder.addSilence(0.14);

      const averageMs = (performance.now() - startTime) / (index + 1);
      const estimatedRemainingMs = averageMs * (chunks.length - index - 1);
      post(id, "chunk-complete", {
        index,
        total: chunks.length,
        estimatedRemainingMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    post(id, "encoding");
    const mp3 = encoder.finish();
    const peakData = new Float32Array(peaks);
    post(
      id,
      "complete",
      { mp3: mp3.buffer, peaks: peakData.buffer, device: activeDevice },
      [mp3.buffer, peakData.buffer],
    );
  } catch (error) {
    post(id, "error", { message: error?.message || "No se pudo generar el audio." });
  }
});
