export function chunkText(text, options = {}) {
  const {
    chunkSize = 3500,
    overlap = 300,
    minChunkSize = 200,
  } = options;

  if (!text || typeof text !== "string") return [];

  const normalised = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalised) return [];

  // Short documents
  if (normalised.length <= chunkSize) {
    return [{
      id: 0,
      text: normalised,
      startIndex: 0,
      endIndex: normalised.length
    }];
  }

  const chunks = [];
  let startIndex = 0;
  let chunkId = 0;

  while (startIndex < normalised.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= normalised.length) {
      const remainingText = normalised.slice(startIndex).trim();
      if (remainingText.length >= minChunkSize || chunks.length === 0) {
        chunks.push({
          id: chunkId++,
          text: remainingText,
          startIndex,
          endIndex: normalised.length
        });
      }
      break;
    }

    const windowSlice = normalised.slice(startIndex, endIndex);

    // Look for paragraph break in the second half of window
    const paraBreak = windowSlice.lastIndexOf("\n\n");
    let breakPoint = -1;

    if (paraBreak > chunkSize * 0.5) {
      breakPoint = startIndex + paraBreak;
    } else {
      // Look for sentence boundary (. ! ?)
      let regex = /[.!?](\s+|$)/g;
      let m;
      let lastSentence = -1;
      while ((m = regex.exec(windowSlice)) !== null) {
        if (m.index > chunkSize * 0.4) {
          lastSentence = m.index + 1;
        }
      }

      if (lastSentence > 0) {
        breakPoint = startIndex + lastSentence;
      } else {
        // Fall back to newline or space
        const lastSpace = Math.max(windowSlice.lastIndexOf("\n"), windowSlice.lastIndexOf(" "));
        if (lastSpace > chunkSize * 0.4) {
          breakPoint = startIndex + lastSpace;
        } else {
          breakPoint = endIndex;
        }
      }
    }

    const chunkContent = normalised.slice(startIndex, breakPoint).trim();
    if (chunkContent.length >= minChunkSize || chunks.length === 0) {
      chunks.push({
        id: chunkId++,
        text: chunkContent,
        startIndex,
        endIndex: breakPoint
      });
    }

    // Advance startIndex ensuring strict forward progress
    let nextStart = breakPoint - overlap;
    if (nextStart <= startIndex) {
      nextStart = breakPoint > startIndex ? breakPoint : startIndex + 1;
    }
    startIndex = nextStart;
  }

  return chunks;
}
