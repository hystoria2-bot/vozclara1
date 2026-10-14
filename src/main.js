import "./styles.css";
import {
  MAX_WORDS,
  countWords,
  estimateDurationSeconds,
  formatDuration,
  splitText,
} from "./audio-utils.js";

const SAMPLE_TEXT =
  "A veces, una idea necesita una voz para empezar a sentirse real. Con Voz Clara puedes convertir tus palabras en un audio natural, escucharlo al instante y descargar el resultado, sin cuentas y con total privacidad.";

const elements = {
  text: document.querySelector("#textInput"),
  wordCounter: document.querySelector("#wordCounter"),
  duration: document.querySelector("#durationEstimate"),
  limit: document.querySelector("#limitMessage"),
  sample: document.querySelector("#sampleButton"),
  file: document.querySelector("#fileInput"),
  fileStatus: document.querySelector("#fileStatus"),
  speed: document.querySelector("#speedInput"),
  speedValue: document.querySelector("#speedValue"),
  quality: document.querySelector("#qualityInput"),
  normalizeNumbers: document.querySelector("#normalizeNumbers"),
  generate: document.querySelector("#generateButton"),
  generateIcon: document.querySelector("#generateIcon"),
  generateLabel: document.querySelector("#generateLabel"),
  progressArea: document.querySelector("#progressArea"),
  progressBar: document.querySelector("#progressBar"),
  progressPercent: document.querySelector("#progressPercent"),
  status: document.querySelector("#statusText"),
  error: document.querySelector("#errorMessage"),
  result: document.querySelector("#resultPanel"),
  player: document.querySelector("#audioPlayer"),
  download: document.querySelector("#downloadButton"),
  waveform: document.querySelector("#waveform"),
};

let currentAudioUrl;
let ttsWorker;
let activeGeneration;
let generationRunning = false;
let generationStartedAt = 0;
let generationTimer;
let statusMessage = "";
const vendorBaseUrl = new URL("vendor/", document.baseURI).href;
const runtimeBaseUrl = new URL("runtime/onnx/", document.baseURI).href;

function selectedVoice() {
  return document.querySelector('input[name="voice"]:checked').value;
}

function selectedSpeed() {
  return Number(elements.speed.value);
}

function selectedQualitySteps() {
  return Number(elements.quality.value);
}

function renderStatus() {
  if (!generationRunning || !generationStartedAt) {
    elements.status.textContent = statusMessage;
    return;
  }
  const elapsed = Math.max(0, Math.floor((performance.now() - generationStartedAt) / 1000));
  elements.status.textContent = `${statusMessage} · ${formatDuration(elapsed)} transcurrido`;
}

function setProgress(percent, message) {
  const normalized = Math.max(0, Math.min(100, Math.round(percent)));
  elements.progressBar.style.width = `${normalized}%`;
  elements.progressPercent.textContent = `${normalized}%`;
  statusMessage = message;
  renderStatus();
}

function setGenerating(running) {
  generationRunning = running;
  elements.generate.classList.toggle("is-loading", running);
  elements.generate.classList.toggle("is-cancel", running);
  elements.generateIcon.textContent = running ? "■" : "▶";
  elements.generateLabel.textContent = running ? "Cancelar generación" : "Crear audio";
  elements.generate.setAttribute("aria-label", running ? "Cancelar generación" : "Crear audio");

  clearInterval(generationTimer);
  if (running) {
    generationStartedAt = performance.now();
    generationTimer = setInterval(renderStatus, 1000);
  } else {
    generationStartedAt = 0;
  }
}

function refreshMeta() {
  const words = countWords(elements.text.value);
  const tooLong = words > MAX_WORDS;
  const speed = selectedSpeed();
  elements.wordCounter.textContent = `${words.toLocaleString("es-ES")} / ${MAX_WORDS.toLocaleString("es-ES")} palabras`;
  elements.duration.textContent = `≈ ${formatDuration(estimateDurationSeconds(elements.text.value, speed))} de audio`;
  elements.limit.hidden = !tooLong;
  elements.wordCounter.classList.toggle("over-limit", tooLong);
  elements.generate.disabled = generationRunning ? false : words === 0 || tooLong;
  elements.speedValue.textContent = `${speed.toLocaleString("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })}×`;
}

function drawWaveform(peaks) {
  const canvas = elements.waveform;
  const context = canvas.getContext("2d");
  const { width, height } = canvas;
  const center = height / 2;
  const bars = 110;
  const gap = 3;
  const barWidth = Math.max(2, (width - gap * (bars - 1)) / bars);
  const peaksPerBar = Math.max(1, Math.ceil(peaks.length / bars));

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#d9e4df";
  context.fillRect(0, center - 1, width, 2);
  context.fillStyle = "#1a6656";

  for (let bar = 0; bar < bars; bar += 1) {
    const start = bar * peaksPerBar;
    let peak = 0;
    for (let index = start; index < Math.min(start + peaksPerBar, peaks.length); index += 1) {
      peak = Math.max(peak, peaks[index]);
    }
    const barHeight = Math.max(3, peak * (height - 10));
    context.fillRect(bar * (barWidth + gap), center - barHeight / 2, barWidth, barHeight);
  }
}

function showError(error) {
  console.error(error);
  const offline = !navigator.onLine;
  elements.error.textContent = offline
    ? "No hay conexión. La primera generación necesita descargar el modelo; después quedará guardado en este navegador."
    : "No pudimos generar el audio. Prueba a recargar la página o usa un texto algo más corto.";
  elements.error.hidden = false;
}

function updateModelProgress(event) {
  if (event?.status !== "progress") return;
  const ratio = event.total ? event.loaded / event.total : (event.progress ?? 0) / 100;
  const isModel = String(event.file ?? "").includes("onnx");
  const percent = isModel ? 8 + ratio * 48 : 8 + ratio * 12;
  if (isModel && ratio >= 0.999) {
    setProgress(56, "Inicializando el modelo en segundo plano; la primera vez puede tardar");
  } else {
    setProgress(percent, `Descargando el modelo natural… ${Math.round(ratio * 100)}%`);
  }
}

function ensureWorker() {
  if (!ttsWorker) {
    ttsWorker = new Worker(new URL("./tts-worker.js", import.meta.url), { type: "module" });
  }
  return ttsWorker;
}

function stopWorker() {
  ttsWorker?.terminate();
  ttsWorker = undefined;
}

function requestAudioFromWorker(chunks, voice, speed, qualitySteps, normalizeNumbers, onProgress) {
  const worker = ensureWorker();
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleWorkerError);
    };
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const handleMessage = (messageEvent) => {
      const data = messageEvent.data;
      if (data?.id !== id) return;
      if (data.type === "error") {
        finish(() => reject(new Error(data.message)));
      } else if (data.type === "complete") {
        finish(() => resolve(data));
      } else {
        onProgress(data);
      }
    };
    const handleWorkerError = (errorEvent) => {
      finish(() => reject(errorEvent.error ?? new Error(errorEvent.message)));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleWorkerError);
    activeGeneration = {
      cancel() {
        finish(() => {
          stopWorker();
          reject(new DOMException("Generación cancelada", "AbortError"));
        });
      },
    };
    worker.postMessage({ type: "generate", id, chunks, voice, speed, qualitySteps, normalizeNumbers, runtimeBaseUrl });
  });
}

async function generateAudio() {
  const text = elements.text.value.trim();
  if (!text || countWords(text) > MAX_WORDS) return;

  setGenerating(true);
  refreshMeta();
  elements.progressArea.hidden = false;
  elements.error.hidden = true;
  elements.result.hidden = true;
  setProgress(3, "Preparando el motor en segundo plano");

  try {
    const chunks = splitText(text, 420);
    const result = await requestAudioFromWorker(
      chunks,
      selectedVoice(),
      selectedSpeed(),
      selectedQualitySteps(),
      elements.normalizeNumbers.checked,
      (event) => {
        if (event.type === "model-progress") {
          updateModelProgress(event.progress);
        } else if (event.type === "engine-ready") {
          const acceleration = event.device === "webgpu" ? "aceleración gráfica activa" : "modo CPU compatible";
          setProgress(57, `Motor listo · ${acceleration}`);
        } else if (event.type === "chunk-start") {
          const progress = 58 + (event.index / event.total) * 35;
          setProgress(progress, `Creando fragmento ${event.index + 1} de ${event.total} en segundo plano`);
        } else if (event.type === "chunk-complete") {
          const progress = 58 + ((event.index + 1) / event.total) * 35;
          const remaining = Math.max(0, Math.round(event.estimatedRemainingMs / 1000));
          const estimate = remaining ? ` · quedan aprox. ${formatDuration(remaining)}` : "";
          setProgress(progress, `Fragmento ${event.index + 1} de ${event.total} terminado${estimate}`);
        } else if (event.type === "encoding") {
          setProgress(96, "Preparando el archivo MP3");
        }
      },
    );

    const mp3Blob = new Blob([result.mp3], { type: "audio/mpeg" });
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = URL.createObjectURL(mp3Blob);

    elements.player.src = currentAudioUrl;
    elements.download.href = currentAudioUrl;
    const date = new Date().toISOString().slice(0, 10);
    elements.download.download = `voz-clara-${date}.mp3`;
    drawWaveform(new Float32Array(result.peaks));
    setProgress(100, "Audio terminado");
    elements.result.hidden = false;
    elements.result.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    if (error?.name === "AbortError") {
      setProgress(0, "Generación cancelada");
    } else {
      showError(error);
    }
  } finally {
    activeGeneration = undefined;
    setGenerating(false);
    refreshMeta();
  }
}

async function readPdf(file) {
  const pdfModuleUrl = `${vendorBaseUrl}pdf.mjs`;
  const pdfjs = await import(/* @vite-ignore */ pdfModuleUrl);
  pdfjs.GlobalWorkerOptions.workerSrc = `${vendorBaseUrl}pdf.worker.mjs`;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    elements.fileStatus.textContent = `Leyendo PDF… página ${pageNumber} de ${pdf.numPages}`;
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n\n");
}

async function readDocument(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt" || extension === "md") return file.text();
  if (extension === "pdf") return readPdf(file);
  if (extension === "docx") {
    if (!window.mammoth) throw new Error("El lector de Word no está disponible.");
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  throw new Error("Formato no compatible. Usa TXT, Markdown, Word o PDF.");
}

async function importFile(file) {
  if (!file) return;
  elements.fileStatus.classList.remove("is-error");
  elements.fileStatus.textContent = `Leyendo ${file.name}…`;
  elements.file.disabled = true;

  try {
    const importedText = (await readDocument(file)).replace(/\u0000/gu, "").trim();
    if (!importedText) throw new Error("No se encontró texto seleccionable en el documento.");
    elements.text.value = importedText;
    elements.fileStatus.textContent = `${file.name} cargado · ${countWords(importedText).toLocaleString("es-ES")} palabras`;
    refreshMeta();
    elements.text.focus();
  } catch (error) {
    console.error(error);
    elements.fileStatus.classList.add("is-error");
    elements.fileStatus.textContent = error.message || "No se pudo leer el documento.";
  } finally {
    elements.file.disabled = false;
    elements.file.value = "";
  }
}

elements.text.addEventListener("input", refreshMeta);
elements.speed.addEventListener("input", refreshMeta);
elements.sample.addEventListener("click", () => {
  elements.text.value = SAMPLE_TEXT;
  elements.fileStatus.textContent = "";
  refreshMeta();
  elements.text.focus();
});
elements.file.addEventListener("change", () => importFile(elements.file.files[0]));
elements.generate.addEventListener("click", () => {
  if (generationRunning) {
    activeGeneration?.cancel();
  } else {
    generateAudio();
  }
});

refreshMeta();
