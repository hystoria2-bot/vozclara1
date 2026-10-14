import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_WORDS,
  countWords,
  estimateDurationSeconds,
  floatToInt16,
  formatDuration,
  joinAudioParts,
  splitText,
} from "../src/audio-utils.js";
import { integerToSpanish, normalizeSpanishForSpeech } from "../src/spanish-normalizer.js";

test("admite textos de hasta cinco mil palabras", () => {
  assert.equal(MAX_WORDS, 5000);
  assert.equal(formatDuration(estimateDurationSeconds("palabra ".repeat(450))), "3:00");
});

test("cuenta palabras y estima la duración", () => {
  assert.equal(countWords("  hola   mundo "), 2);
  assert.equal(estimateDurationSeconds("uno dos tres", 1), 1);
  assert.equal(formatDuration(125), "2:05");
});

test("divide textos largos sin perder palabras", () => {
  const text = "Primera frase bastante corta. Segunda frase también corta. Una tercera frase para cerrar.";
  const chunks = splitText(text, 42);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(" "), text);
  assert.ok(chunks.every((chunk) => chunk.length <= 42));
});

test("une audio insertando silencios", () => {
  const joined = joinAudioParts([new Float32Array([1, 0.5]), new Float32Array([-1])], 10, 0.2);
  assert.deepEqual(Array.from(joined), [1, 0.5, 0, 0, -1]);
});

test("convierte muestras flotantes y limita sus extremos", () => {
  assert.deepEqual(Array.from(floatToInt16(new Float32Array([-2, -1, 0, 1, 2]))), [-32768, -32768, 0, 32767, 32767]);
});

test("convierte números, fechas, porcentajes e importes al español", () => {
  assert.equal(integerToSpanish(2026), "dos mil veintiséis");
  assert.equal(
    normalizeSpanishForSpeech("El 13/10/2026 costó 12,50 € y subió un 3,5 %."),
    "El trece de octubre de dos mil veintiséis costó doce euros con cincuenta céntimos y subió un tres coma cinco por ciento.",
  );
});

test("expande referencias bíblicas y siglos", () => {
  assert.equal(
    normalizeSpanishForSpeech("Ap 21,2 y Jn 3,16-18, en el siglo XXI."),
    "Apocalipsis, capítulo veintiuno, versículo dos y Juan, capítulo tres, versículos dieciséis a dieciocho, en el siglo veintiuno.",
  );
});

test("pronuncia numeración de monarcas y normaliza mayúsculas", () => {
  assert.equal(
    normalizeSpanishForSpeech("ISABEL II Y FELIPE VI HABLARON ANTE LA ONU."),
    "isabel segunda y felipe sexto hablaron ante la ONU.",
  );
  assert.equal(normalizeSpanishForSpeech("Juan Pablo II"), "Juan Pablo segundo");
});

test("aplica yeísmo y ayudas para palabras difíciles", () => {
  assert.equal(
    normalizeSpanishForSpeech("El alimento llegó a la calle con lluvia y ayuda."),
    "El aliménto yegó a la caye con yuvia y ayuda.",
  );
  assert.equal(normalizeSpanishForSpeech("LLUVIA Y ALIMENTOS"), "yuvia y aliméntos");
});
