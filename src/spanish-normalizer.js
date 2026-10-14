const SMALL_NUMBERS = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
];

const TENS = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const HUNDREDS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
const DIGITS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];

const BIBLE_BOOKS = new Map([
  ["gn", "Génesis"],
  ["gen", "Génesis"],
  ["ex", "Éxodo"],
  ["lv", "Levítico"],
  ["nm", "Números"],
  ["dt", "Deuteronomio"],
  ["jos", "Josué"],
  ["jue", "Jueces"],
  ["sal", "Salmos"],
  ["is", "Isaías"],
  ["mt", "Mateo"],
  ["mc", "Marcos"],
  ["lc", "Lucas"],
  ["jn", "Juan"],
  ["hch", "Hechos"],
  ["rm", "Romanos"],
  ["rom", "Romanos"],
  ["1cor", "Primera de Corintios"],
  ["2cor", "Segunda de Corintios"],
  ["gal", "Gálatas"],
  ["ef", "Efesios"],
  ["flp", "Filipenses"],
  ["col", "Colosenses"],
  ["1tes", "Primera de Tesalonicenses"],
  ["2tes", "Segunda de Tesalonicenses"],
  ["1tim", "Primera de Timoteo"],
  ["2tim", "Segunda de Timoteo"],
  ["heb", "Hebreos"],
  ["st", "Santiago"],
  ["sant", "Santiago"],
  ["1pe", "Primera de Pedro"],
  ["2pe", "Segunda de Pedro"],
  ["1jn", "Primera de Juan"],
  ["2jn", "Segunda de Juan"],
  ["3jn", "Tercera de Juan"],
  ["jud", "Judas"],
  ["ap", "Apocalipsis"],
]);

const ORDINALS = {
  1: ["primero", "primera"],
  2: ["segundo", "segunda"],
  3: ["tercero", "tercera"],
  4: ["cuarto", "cuarta"],
  5: ["quinto", "quinta"],
  6: ["sexto", "sexta"],
  7: ["séptimo", "séptima"],
  8: ["octavo", "octava"],
  9: ["noveno", "novena"],
  10: ["décimo", "décima"],
};

const ROYAL_NAMES = new Map([
  ["isabel", "f"], ["juana", "f"], ["maría", "f"], ["ana", "f"], ["catalina", "f"], ["leonor", "f"], ["victoria", "f"], ["margarita", "f"], ["cristina", "f"],
  ["felipe", "m"], ["carlos", "m"], ["alfonso", "m"], ["fernando", "m"], ["juan", "m"], ["pablo", "m"], ["luis", "m"], ["enrique", "m"], ["eduardo", "m"], ["jorge", "m"], ["guillermo", "m"], ["pedro", "m"], ["jaime", "m"], ["benedicto", "m"], ["pío", "m"], ["león", "m"], ["clemente", "m"], ["inocencio", "m"], ["alejandro", "m"], ["adriano", "m"], ["gregorio", "m"], ["nicolás", "m"], ["sixto", "m"], ["urbano", "m"], ["martín", "m"], ["esteban", "m"], ["bonifacio", "m"], ["honorio", "m"], ["eugenio", "m"], ["víctor", "m"],
]);

const SPOKEN_ACRONYMS = new Set(["ADN", "DNI", "EEUU", "ESO", "FBI", "IA", "IVA", "MP3", "NASA", "ONG", "ONU", "OTAN", "PDF", "UE", "UNESCO", "URL", "USB"]);

// Estas grafías solo se envían al sintetizador: nunca modifican el texto del usuario.
// Las tildes explícitas ayudan al modelo a conservar el acento prosódico correcto.
const PRONUNCIATION_OVERRIDES = new Map([
  ["alimento", "aliménto"],
  ["alimentos", "aliméntos"],
]);

function underOneHundred(value) {
  if (value < SMALL_NUMBERS.length) return SMALL_NUMBERS[value];
  const tens = Math.floor(value / 10);
  const units = value % 10;
  return units ? `${TENS[tens]} y ${SMALL_NUMBERS[units]}` : TENS[tens];
}

function underOneThousand(value) {
  if (value < 100) return underOneHundred(value);
  if (value === 100) return "cien";
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  return rest ? `${HUNDREDS[hundreds]} ${underOneHundred(rest)}` : HUNDREDS[hundreds];
}

export function integerToSpanish(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) return String(value);
  if (number < 0) return `menos ${integerToSpanish(-number)}`;
  if (number < 1000) return underOneThousand(number);
  if (number < 1_000_000) {
    const thousands = Math.floor(number / 1000);
    const rest = number % 1000;
    const prefix = thousands === 1 ? "mil" : `${integerToSpanish(thousands)} mil`;
    return rest ? `${prefix} ${underOneThousand(rest)}` : prefix;
  }
  if (number < 1_000_000_000) {
    const millions = Math.floor(number / 1_000_000);
    const rest = number % 1_000_000;
    const prefix = millions === 1 ? "un millón" : `${apocopate(integerToSpanish(millions))} millones`;
    return rest ? `${prefix} ${integerToSpanish(rest)}` : prefix;
  }
  if (number < 1_000_000_000_000) {
    const thousandsOfMillions = Math.floor(number / 1_000_000_000);
    const rest = number % 1_000_000_000;
    const prefix = thousandsOfMillions === 1 ? "mil millones" : `${integerToSpanish(thousandsOfMillions)} mil millones`;
    return rest ? `${prefix} ${integerToSpanish(rest)}` : prefix;
  }
  return String(value);
}

function apocopate(words) {
  return words
    .replace(/veintiuno$/u, "veintiún")
    .replace(/ y uno$/u, " y un")
    .replace(/uno$/u, "un");
}

function decimalToSpanish(raw) {
  const normalized = raw.replace(/\./gu, "");
  const [integerPart, fraction = ""] = normalized.split(",");
  const integerWords = integerToSpanish(Number(integerPart));
  if (!fraction) return integerWords;
  const fractionWords = [...fraction].map((digit) => DIGITS[Number(digit)]).join(" ");
  return `${integerWords} coma ${fractionWords}`;
}

function currencyToSpanish(raw, currency) {
  const normalized = raw.replace(/\./gu, "");
  const [integerPart, fraction = ""] = normalized.split(",");
  const integer = Number(integerPart);
  const unit = currency === "€" ? (integer === 1 ? "euro" : "euros") : integer === 1 ? "dólar" : "dólares";
  let result = `${apocopate(integerToSpanish(integer))} ${unit}`;
  if (fraction && Number(fraction) > 0) {
    const cents = Number(fraction.padEnd(2, "0").slice(0, 2));
    result += ` con ${apocopate(integerToSpanish(cents))} ${cents === 1 ? "céntimo" : "céntimos"}`;
  }
  return result;
}

function romanToInteger(roman) {
  if (!/^(?=[MDCLXVI])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/u.test(roman)) return null;
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let index = 0; index < roman.length; index += 1) {
    const current = values[roman[index]];
    const next = values[roman[index + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  return total;
}

function ordinalToSpanish(value, feminine = false) {
  const direct = ORDINALS[value]?.[feminine ? 1 : 0];
  if (direct) return direct;

  const masculine = {
    11: "undécimo",
    12: "duodécimo",
    13: "decimotercero",
    14: "decimocuarto",
    15: "decimoquinto",
    16: "decimosexto",
    17: "decimoséptimo",
    18: "decimoctavo",
    19: "decimonoveno",
    20: "vigésimo",
  }[value];
  if (masculine) return feminine ? masculine.replace(/o$/u, "a") : masculine;
  if (value > 20 && value < 30) {
    const unit = ORDINALS[value - 20]?.[feminine ? 1 : 0];
    return unit ? `${feminine ? "vigésima" : "vigésimo"} ${unit}` : null;
  }
  return null;
}

function normalizePersonalRomanNumerals(text) {
  const personPattern = /\b(\p{Lu}[\p{L}]+(?:\s+\p{Lu}[\p{L}]+){0,2})\s+([MDCLXVI]+)\b/gu;
  return text.replace(personPattern, (match, fullName, roman) => {
    const firstName = fullName.split(/\s+/u)[0].toLocaleLowerCase("es-ES");
    const gender = ROYAL_NAMES.get(firstName);
    if (!gender) return match;
    const value = romanToInteger(roman);
    const ordinal = value ? ordinalToSpanish(value, gender === "f") : null;
    return ordinal ? `${fullName} ${ordinal}` : match;
  });
}

function normalizeAllCapsWords(text) {
  return text.replace(/\b\p{Lu}+\b/gu, (word) => {
    if (SPOKEN_ACRONYMS.has(word)) return word;
    return word.toLocaleLowerCase("es-ES");
  });
}

function preserveInitialCase(source, replacement) {
  if (source === source.toLocaleUpperCase("es-ES")) return replacement.toLocaleUpperCase("es-ES");
  if (source[0] === source[0].toLocaleUpperCase("es-ES")) {
    return replacement[0].toLocaleUpperCase("es-ES") + replacement.slice(1);
  }
  return replacement;
}

export function normalizeSpanishPronunciation(input) {
  let text = input.replace(/ll/giu, (letters) => preserveInitialCase(letters, "y"));

  for (const [word, spokenForm] of PRONUNCIATION_OVERRIDES) {
    const pattern = new RegExp(`\\b${word}\\b`, "giu");
    text = text.replace(pattern, (match) => preserveInitialCase(match, spokenForm));
  }

  return text;
}

function normalizeBibleReferences(text) {
  const bookPattern = [...BIBLE_BOOKS.keys()]
    .sort((a, b) => b.length - a.length)
    .map((book) => book.replace(/^(\d)/u, "$1\\s*"))
    .join("|");
  const referencePattern = new RegExp(`\\b(${bookPattern})\\.?\\s+(\\d{1,3})\\s*[,.:]\\s*(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?`, "giu");

  return text.replace(referencePattern, (match, rawBook, chapter, verse, finalVerse) => {
    const key = rawBook.toLowerCase().replace(/\s+/gu, "");
    const book = BIBLE_BOOKS.get(key);
    if (!book) return match;
    const verseWords = finalVerse
      ? `versículos ${integerToSpanish(Number(verse))} a ${integerToSpanish(Number(finalVerse))}`
      : `versículo ${integerToSpanish(Number(verse))}`;
    return `${book}, capítulo ${integerToSpanish(Number(chapter))}, ${verseWords}`;
  });
}

export function normalizeSpanishForSpeech(input) {
  let text = normalizeBibleReferences(input);

  text = text.replace(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/gu, (match, day, month, year) => {
    const months = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const dayNumber = Number(day);
    const monthNumber = Number(month);
    const yearNumber = Number(year);
    if (dayNumber < 1 || dayNumber > 31 || monthNumber < 1 || monthNumber > 12) return match;
    return `${integerToSpanish(dayNumber)} de ${months[monthNumber]} de ${integerToSpanish(yearNumber)}`;
  });

  text = text.replace(/(?:€\s*(\d[\d.]*(?:,\d{1,2})?)|(\d[\d.]*(?:,\d{1,2})?)\s*€)/gu, (match, before, after) => currencyToSpanish(before ?? after, "€"));
  text = text.replace(/(?:\$\s*(\d[\d.]*(?:,\d{1,2})?)|(\d[\d.]*(?:,\d{1,2})?)\s*\$)/gu, (match, before, after) => currencyToSpanish(before ?? after, "$"));
  text = text.replace(/\b(\d[\d.]*(?:,\d+)?)\s*%/gu, (match, number) => `${decimalToSpanish(number)} por ciento`);
  text = text.replace(/\b(\d{1,2}):(\d{2})\b/gu, (match, hours, minutes) => {
    const hourNumber = Number(hours);
    const minuteNumber = Number(minutes);
    if (hourNumber > 23 || minuteNumber > 59) return match;
    return minuteNumber
      ? `${integerToSpanish(hourNumber)} horas y ${integerToSpanish(minuteNumber)} minutos`
      : `${integerToSpanish(hourNumber)} horas`;
  });
  text = text.replace(/\b([1-9]|10)\s*[.ºª°]+/gu, (match, number) => {
    const feminine = /ª/u.test(match);
    return ORDINALS[Number(number)][feminine ? 1 : 0];
  });
  text = text.replace(/\b(siglo|capítulo|tomo|volumen|libro)\s+([MDCLXVI]+)\b/giu, (match, label, roman) => {
    const value = romanToInteger(roman.toUpperCase());
    return value ? `${label} ${integerToSpanish(value)}` : match;
  });
  text = normalizePersonalRomanNumerals(text);
  text = text.replace(/\b(\d{1,3}(?:\.\d{3})+,\d+|\d+,\d+)\b/gu, (match) => decimalToSpanish(match));
  text = text.replace(/\b\d{1,3}(?:\.\d{3})+\b/gu, (match) => integerToSpanish(Number(match.replace(/\./gu, ""))));
  text = text.replace(/(^|[^\p{L}\p{N}])(-?\d{1,12})(?![\p{L}\p{N}])/gu, (match, prefix, number) => `${prefix}${integerToSpanish(Number(number))}`);

  text = normalizeAllCapsWords(text);
  text = normalizeSpanishPronunciation(text);
  return text.replace(/\s+/gu, " ").trim();
}
