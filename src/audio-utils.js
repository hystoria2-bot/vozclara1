export const MAX_WORDS = 5000;
export const WORDS_PER_MINUTE = 150;

export function countWords(text) {
  const normalized = text.trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

export function estimateDurationSeconds(text, speed = 1) {
  return Math.round((countWords(text) / WORDS_PER_MINUTE / speed) * 60);
}

export function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function splitText(text, maxLength = 420) {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (!normalized) return [];

  const sentences = normalized.match(/[^.!?…]+(?:[.!?…]+|$)/gu) ?? [normalized];
  const chunks = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;

    if (sentence.length <= maxLength) {
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (candidate.length <= maxLength) {
        current = candidate;
      } else {
        pushCurrent();
        current = sentence;
      }
      continue;
    }

    pushCurrent();
    const words = sentence.split(/\s+/u);
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxLength && current) pushCurrent();
      current = current ? `${current} ${word}` : word;
    }
  }

  pushCurrent();
  return chunks;
}

export function joinAudioParts(parts, sampleRate, pauseSeconds = 0.14) {
  if (!parts.length) return new Float32Array();
  const pauseLength = Math.round(sampleRate * pauseSeconds);
  const totalLength = parts.reduce((total, part) => total + part.length, 0) + pauseLength * (parts.length - 1);
  const result = new Float32Array(totalLength);
  let offset = 0;

  parts.forEach((part, index) => {
    result.set(part, offset);
    offset += part.length;
    if (index < parts.length - 1) offset += pauseLength;
  });

  return result;
}

export function floatToInt16(samples) {
  const result = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    result[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return result;
}
