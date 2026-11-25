const pdfParse = require('pdf-parse');
const db = require('../../config/database');

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about',
  'into', 'over', 'after', 'and', 'or', 'but', 'if', 'then', 'so', 'than',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you',
  'your', 'he', 'she', 'it', 'they', 'their', 'what', 'which', 'who', 'whom',
  'when', 'where', 'why', 'how', 'can', 'could', 'would', 'should', 'will',
  'do', 'does', 'did', 'have', 'has', 'had', 'please', 'tell', 'know', 'want',
  'need', 'looking', 'find', 'give', 'more', 'any', 'some', 'available',
]);

const SYNONYMS = {
  price: ['pricing', 'cost', 'rate', 'budget', 'sqft', 'crore', 'lakh'],
  pricing: ['price', 'cost', 'rate', 'budget', 'sqft'],
  cost: ['price', 'pricing', 'budget', 'charges'],
  book: ['booking', 'reserve', 'reservation', 'schedule', 'visit', 'appointment'],
  booking: ['book', 'procedure', 'token', 'allotment', 'schedule'],
  amenities: ['facilities', 'clubhouse', 'pool', 'gym', 'park', 'security'],
  location: ['area', 'address', 'hyderabad', 'bengaluru', 'bangalore', 'kokapet', 'gachibowli', 'whitefield'],
  flat: ['apartment', '2bhk', '3bhk', '4bhk', 'bhk', 'penthouse', 'unit'],
  villa: ['villas', 'duplex', 'gated', 'bungalow'],
  loan: ['emi', 'bank', 'financing', 'mortgage', 'hdfc', 'sbi', 'icici'],
};

function tokenize(text) {
  const raw = String(text || '')
    .toLowerCase()
    .replace(/(\d)\s+(bhk)/g, '$1$2')
    .replace(/[^a-z0-9\u0900-\u097f\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return raw;
}

function expandTokens(tokens) {
  const expanded = new Set(tokens);
  for (const t of tokens) {
    if (SYNONYMS[t]) {
      for (const s of SYNONYMS[t]) expanded.add(s);
    }
  }
  return Array.from(expanded);
}

function chunkText(text, maxChars = 550, overlapChars = 90) {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let current = '';

  const pushChunk = (content) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const keywords = Array.from(new Set(tokenize(trimmed))).slice(0, 20);
    chunks.push({
      chunkId: `chk_${chunks.length + 1}_${Date.now().toString(36)}`,
      index: chunks.length,
      content: trimmed,
      keywords,
    });
  };

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      if (current) {
        pushChunk(current);
        current = '';
      }
      const sentences = para.split(/(?<=[.!?])\s+/);
      let buf = '';
      for (const s of sentences) {
        if ((buf + ' ' + s).trim().length > maxChars && buf) {
          pushChunk(buf);
          const tail = buf.slice(-overlapChars);
          buf = `${tail} ${s}`.trim();
        } else {
          buf = buf ? `${buf} ${s}` : s;
        }
      }
      if (buf) pushChunk(buf);
    } else if ((current + '\n\n' + para).trim().length > maxChars && current) {
      pushChunk(current);
      const tail = current.slice(-overlapChars);
      current = `${tail}\n\n${para}`.trim();
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current) pushChunk(current);
  return chunks;
}

async function extractTextFromFile(file) {
  const ext = (file.originalname || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    const parsed = await pdfParse(file.buffer);
    return {
      text: (parsed.text || '').trim(),
      sourceType: 'pdf',
    };
  }
  if (ext === 'txt' || ext === 'md' || ext === 'csv') {
    return {
      text: file.buffer.toString('utf8').trim(),
      sourceType: 'txt',
    };
  }
  throw new Error('Unsupported file format. Only .txt and .pdf documents are allowed.');
}

async function ingestDocument({ title, category, industry, sourceType, fileName, fileSize, content }) {
  const chunks = chunkText(content);
  if (chunks.length === 0) {
    throw new Error('Document contains no extractable text.');
  }
  return db.knowledge.create({
    title: title.trim(),
    category: category || 'General',
    industry: industry || 'real-estate',
    sourceType: sourceType || 'text',
    fileName: fileName || '',
    fileSize: fileSize || Buffer.byteLength(content, 'utf8'),
    content,
    chunks,
    chunkCount: chunks.length,
  });
}

async function retrieveRelevantChunks(query, { topK = 4, minScore = 0.14 } = {}) {
  const docs = await db.knowledge.findAll();
  const queryTokens = tokenize(query);
  const expandedTokens = expandTokens(queryTokens);

  if (docs.length === 0 || expandedTokens.length === 0) {
    return {
      hasRelevantFacts: false,
      chunks: [],
      contextText: '',
      sources: [],
    };
  }

  const allChunks = [];
  for (const doc of docs) {
    const docChunks = Array.isArray(doc.chunks) && doc.chunks.length > 0 ? doc.chunks : chunkText(doc.content);
    for (const chunk of docChunks) {
      allChunks.push({
        docId: doc.id,
        docTitle: doc.title,
        category: doc.category,
        chunkId: chunk.chunkId,
        content: chunk.content,
        tokens: tokenize(`${doc.title} ${doc.category} ${chunk.content}`),
      });
    }
  }

  if (allChunks.length === 0) {
    return { hasRelevantFacts: false, chunks: [], contextText: '', sources: [] };
  }

  // Compute document frequency for IDF weighting
  const df = new Map();
  for (const ch of allChunks) {
    const uniq = new Set(ch.tokens);
    for (const t of uniq) {
      df.set(t, (df.get(t) || 0) + 1);
    }
  }

  const N = allChunks.length;
  const normalizedQuery = String(query || '').toLowerCase();

  const scored = allChunks
    .map((ch) => {
      const tf = new Map();
      for (const t of ch.tokens) tf.set(t, (tf.get(t) || 0) + 1);

      let score = 0;
      let exactHits = 0;
      for (const qt of queryTokens) {
        const count = tf.get(qt) || 0;
        if (count > 0) {
          exactHits += 1;
          const idf = Math.log(1 + N / (1 + (df.get(qt) || 0)));
          score += (1 + Math.log(count)) * idf;
        }
      }

      for (const et of expandedTokens) {
        if (!queryTokens.includes(et) && (tf.get(et) || 0) > 0) {
          const idf = Math.log(1 + N / (1 + (df.get(et) || 0)));
          score += 0.45 * idf;
        }
      }

      // Bonus for multi-word phrase or title match
      const lowerContent = ch.content.toLowerCase();
      const lowerTitle = ch.docTitle.toLowerCase();
      if (normalizedQuery.length > 5 && lowerContent.includes(normalizedQuery)) {
        score += 2.5;
      }
      for (const qt of queryTokens) {
        if (lowerTitle.includes(qt)) score += 0.5;
      }

      const normScore = score / Math.max(1, Math.sqrt(queryTokens.length) * 2.2);
      return {
        ...ch,
        exactHits,
        score: Number(normScore.toFixed(3)),
      };
    })
    .filter((item) => item.score >= minScore && (item.exactHits > 0 || item.score >= 0.35))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const hasRelevantFacts = scored.length > 0;
  const contextText = scored
    .map(
      (s, idx) =>
        `[Source ${idx + 1}: ${s.docTitle} (${s.category}) | Relevance: ${s.score}]\n${s.content}`
    )
    .join('\n\n');

  const sources = Array.from(new Set(scored.map((s) => `${s.docTitle} (${s.category})`)));

  return {
    hasRelevantFacts,
    chunks: scored.map(({ docId, docTitle, category, chunkId, content, score }) => ({
      docId,
      docTitle,
      category,
      chunkId,
      content,
      score,
    })),
    contextText,
    sources,
  };
}

module.exports = {
  chunkText,
  extractTextFromFile,
  ingestDocument,
  retrieveRelevantChunks,
};
