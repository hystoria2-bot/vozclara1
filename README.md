# Voz Clara

Aplicación web privada para convertir texto en voz natural y descargar el resultado en MP3. Usa Supertonic 2 en el navegador: no requiere cuenta, API ni servidor.

## Desarrollo local

Requiere Node.js 22 o superior.

En Windows, haz doble clic en **`Abrir Voz Clara.bat`**. No abras `index.html` directamente: los módulos de voz necesitan un servidor local.

```bash
npm install
npm run dev
```

Comprobaciones:

```bash
npm test
npm run build
```

## Publicación en GitHub Pages

1. Crea un repositorio de GitHub y sube este proyecto a la rama `main`.
2. En **Settings → Pages → Build and deployment**, selecciona **GitHub Actions**.
3. El flujo `.github/workflows/deploy.yml` ejecutará las pruebas, compilará y publicará la web.

## Privacidad y funcionamiento

- El texto y el audio se procesan en el navegador.
- La primera generación descarga Supertonic 2 (aprox. 265 MB) desde Hugging Face y el navegador lo guarda en caché.
- Los componentes WebAssembly de ONNX se sirven desde la propia aplicación para evitar bloqueos de CDN.
- Incluye tres perfiles de voz predeterminados: Clara (`F1`), Alba (`F2`) y Mateo (`M1`).
- Usa WebGPU cuando está disponible y cambia automáticamente a WebAssembly/CPU en equipos no compatibles.
- Permite elegir generación rápida, natural o detallada mediante los pasos de inferencia.
- Normaliza automáticamente números, fechas, porcentajes, importes, numeración romana, referencias bíblicas y frases en mayúsculas antes de sintetizar. También aplica yeísmo (`ll` con sonido de `y`) y un diccionario ampliable para palabras difíciles. El texto escrito no se modifica y la opción puede desactivarse.
- Admite hasta 5.000 palabras, aproximadamente 30–35 minutos a velocidad normal.
- Los textos largos se dividen en fragmentos y se codifican progresivamente en un único MP3 para reducir el uso de memoria.
- La síntesis se ejecuta en un Web Worker para que la página siga respondiendo durante los cálculos intensivos.
- Durante la generación se muestra el tiempo transcurrido, una estimación restante y un botón para cancelar.
- Permite pegar texto o importar archivos TXT, Markdown, DOCX y PDF. Los PDF escaneados necesitan OCR previo.

## Licencias relevantes

- Supertonic 2: OpenRAIL-M.
- `@huggingface/transformers`: Apache-2.0.
- Mammoth: BSD-2-Clause.
- PDF.js: Apache-2.0.
- `@breezystack/lamejs`: LGPL-3.0.
