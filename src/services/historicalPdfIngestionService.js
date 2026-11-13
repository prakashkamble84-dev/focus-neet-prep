const QUESTION_MARKER = /^\s*(?:Q(?:uestion)?\s*)?(\d{1,3})[.)\]:-]\s+\S.*$/gim;

export function splitQuestionsFromPage(text, pageNumber = 1) {
  const source = String(text || '');
  const matches = [...source.matchAll(QUESTION_MARKER)];
  if (matches.length < 2) return [];

  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
    const body = source.slice(start, end).trim();
    const number = match[1];
    const hasOptions = /(?:^|\n)\s*(?:\([A-D]\)|[A-D][.)])\s+\S/im.test(body);
    return {
      key: String(pageNumber) + '-' + number + '-' + index,
      pageNumber,
      questionNumber: number,
      body,
      questionType: hasOptions ? 'MCQ' : 'Other'
    };
  }).filter((candidate) => candidate.body.length >= 20);
}

function countMathMarkers(text) {
  const markers = String(text || '').match(/(?:=|≠|≤|≥|∫|√|∑|∏|∞|∂|∇|\b(?:sin|cos|tan|log|ln|lim)\b|\b(?:dx|dy|dt)\b)/gi);
  return markers?.length || 0;
}

function countPageImages(operatorList, ops) {
  const imageOperators = new Set([
    ops?.paintImageXObject,
    ops?.paintInlineImageXObject,
    ops?.paintImageMaskXObject,
    ops?.paintImageXObjectRepeat
  ].filter((value) => value !== undefined));
  return (operatorList?.fnArray || []).filter((operation) => imageOperators.has(operation)).length;
}

async function renderPageToCanvas(page, scale = 1.55) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas rendering is not available in this browser.');

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

export async function extractPdfPagesFromFile(file, language = 'eng', onProgress = () => {}) {
  if (!file || !(file instanceof File)) {
    throw new Error('Choose a local PDF file before starting extraction.');
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only PDF files can be analysed.');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('The PDF is larger than the 20 MB source limit.');
  }

  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const document = await pdfjs.getDocument({
    data: await file.arrayBuffer(),
    useSystemFonts: true,
    isEvalSupported: false
  }).promise;

  let ocrWorker = null;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      onProgress({
        current: pageNumber,
        total: document.numPages,
        stage: 'Reading page text'
      });

      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const nativeText = textContent.items
        .map((item) => typeof item.str === 'string' ? item.str : '')
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      let extractedText = nativeText;
      let extractionMethod = 'NativeText';
      let confidence = nativeText.length ? 0.88 : 0;

      if (nativeText.length < 45) {
        if (!ocrWorker) {
          onProgress({
            current: pageNumber,
            total: document.numPages,
            stage: 'Loading OCR language data'
          });
          const { createWorker } = await import('tesseract.js');
          ocrWorker = await createWorker(language, 1, {
            logger: (message) => {
              if (message.status === 'recognizing text') {
                onProgress({
                  current: pageNumber,
                  total: document.numPages,
                  stage: 'OCR page ' + pageNumber,
                  progress: message.progress
                });
              }
            }
          });
        }

        onProgress({
          current: pageNumber,
          total: document.numPages,
          stage: 'Rendering scanned page'
        });
        const canvas = await renderPageToCanvas(page);
        const recognition = await ocrWorker.recognize(canvas);
        extractedText = String(recognition.data?.text || '').trim();
        confidence = Math.max(0, Math.min(1, Number(recognition.data?.confidence || 0) / 100));
        extractionMethod = 'OCR';
        canvas.width = 0;
        canvas.height = 0;
      }

      const operatorList = await page.getOperatorList();
      const imageCount = countPageImages(operatorList, pdfjs.OPS);
      const equationCount = countMathMarkers(extractedText);
      const hasTabularLayout = /\S\s{3,}\S/.test(extractedText) || /\t/.test(extractedText);
      const contentKind = imageCount > 0
        ? 'Diagram'
        : equationCount > 0
          ? 'Equation'
          : hasTabularLayout
            ? 'Table'
            : 'Text';

      pages.push({
        pageNumber,
        text: extractedText,
        method: extractionMethod,
        confidence,
        imageCount,
        equationCount,
        contentKind,
        candidates: splitQuestionsFromPage(extractedText, pageNumber),
        reviewerNotes: [
          'Automatically extracted using ' + extractionMethod + '.',
          'Confidence is an OCR/text-extraction estimate, not an academic correctness score.',
          equationCount ? equationCount + ' possible mathematical markers detected; manually check every formula, sign and unit.' : 'No equation markers were detected by the heuristic scan.',
          imageCount ? imageCount + ' embedded image object(s) detected; diagram labels and relationships need manual review.' : 'No embedded raster image objects detected.'
        ].join(' ')
      });

      onProgress({
        current: pageNumber,
        total: document.numPages,
        stage: 'Page ' + pageNumber + ' complete'
      });
    }
  } finally {
    if (ocrWorker) {
      await ocrWorker.terminate();
    }
    await document.destroy();
  }

  return pages;
}
