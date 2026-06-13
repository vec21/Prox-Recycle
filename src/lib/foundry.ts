/**
 * Frontend client for Foundry IQ-grounded waste analysis.
 * Contains NO API keys — all model calls run server-side (see /server).
 */

export interface Citation {
  id: string;
  source: string;
}

export interface ScanResult {
  material: string;
  count: number;
  isWaste: boolean;
  confidence: number;
  estimatedWeight: number;
  fraudDetected: boolean;
  explanation: string;
  rewardKz: number;
  co2SavedKg: number;
  citations: Citation[];
  grounded: boolean;
  provider: 'foundry-iq' | 'mock';
}

export async function analyzeWaste(base64Image: string): Promise<ScanResult> {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error || `Scan failed (${res.status})`);
  }

  return res.json() as Promise<ScanResult>;
}
