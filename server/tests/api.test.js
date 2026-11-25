const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const env = require('../config/env');

const servicePath = path.resolve(__dirname, '../services/ai/aiService.js');
const originalLoad = Module._load;
const originalApiKey = env.geminiApiKey;
const originalModel = env.geminiModel;
let generateContentRequest;
let generateContentAttempts = 0;
let transientFailures = 0;

class FakeGoogleGenAI {
  constructor({ apiKey }) {
    assert.equal(apiKey, 'test-gemini-key');
    this.models = {
      generateContent: async (request) => {
        generateContentRequest = request;
        generateContentAttempts += 1;
        if (transientFailures > 0) {
          transientFailures -= 1;
          const error = new Error('Temporary service unavailability.');
          error.status = 503;
          throw error;
        }
        return { text: 'नमस्ते, मुझे एक घर चाहिए।' };
      },
    };
  }
}

Module._load = function loadWithFakeGemini(request, parent, isMain) {
  if (request === '@google/genai') {
    return { GoogleGenAI: FakeGoogleGenAI };
  }
  return originalLoad.call(this, request, parent, isMain);
};

delete require.cache[servicePath];
const aiService = require(servicePath);
Module._load = originalLoad;

async function run() {
  try {
    env.geminiApiKey = 'test-gemini-key';
    env.geminiModel = 'test-gemini-model';

    const audioBuffer = Buffer.from('audio fixture');
    transientFailures = 1;
    const result = await aiService.transcribeAudio({
      audioBuffer,
      mimeType: 'audio/webm;codecs=opus',
      language: 'hi',
    });

    assert.deepEqual(result, {
      text: 'नमस्ते, मुझे एक घर चाहिए।',
      model: 'test-gemini-model',
    });
    assert.equal(generateContentRequest.model, 'test-gemini-model');
    assert.equal(generateContentAttempts, 2);
    assert.match(generateContentRequest.contents[0].parts[0].text, /Hindi/);
    assert.deepEqual(generateContentRequest.contents[0].parts[1].inlineData, {
      mimeType: 'audio/webm',
      data: audioBuffer.toString('base64'),
    });

    env.geminiApiKey = '';
    await assert.rejects(
      aiService.transcribeAudio({ audioBuffer, mimeType: 'audio/webm' }),
      (error) => error.statusCode === 503 && /GEMINI_API_KEY/.test(error.message)
    );

    env.geminiApiKey = 'test-gemini-key';
    await assert.rejects(
      aiService.transcribeAudio({
        audioBuffer: Buffer.alloc(0),
        mimeType: 'audio/webm',
      }),
      (error) => error.statusCode === 400
    );

    console.log('Voice transcription API tests passed.');
  } finally {
    env.geminiApiKey = originalApiKey;
    env.geminiModel = originalModel;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
