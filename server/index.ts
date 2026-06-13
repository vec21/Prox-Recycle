/**
 * Prox-Recycle backend.
 *
 * Keeps Foundry/Azure credentials server-side (never exposed to the browser) and
 * exposes a thin API the React app calls for Foundry IQ-grounded waste analysis.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { analyzeWaste, foundryConfigured, pipelineStatus } from './foundry.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' }));

const PORT = Number(process.env.PORT || 8787);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    foundryConfigured,
    provider: foundryConfigured ? 'foundry-iq' : 'mock',
    pipeline: pipelineStatus,
  });
});

app.post('/api/scan', async (req, res) => {
  const { image } = req.body ?? {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing base64 "image" field.' });
  }
  try {
    const result = await analyzeWaste(image);
    res.json(result);
  } catch (err: any) {
    console.error('[scan] Foundry analysis failed:', err?.message || err);
    res.status(502).json({ error: 'AI analysis failed', detail: err?.message || 'unknown' });
  }
});

app.listen(PORT, () => {
  console.log(`Prox-Recycle backend on http://localhost:${PORT}`);
  const mode = foundryConfigured
    ? `LIVE pipeline (Groq vision → Foundry IQ ${pipelineStatus.foundryDeployment})`
    : `MOCK (groq=${pipelineStatus.groqConfigured ? 'on' : 'off'}, foundry=${pipelineStatus.foundryReady ? 'on' : 'off'})`;
  console.log(`Scan engine: ${mode}`);
});
