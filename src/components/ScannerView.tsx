import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, Camera, BookText, Leaf } from 'lucide-react';
import { analyzeWaste, ScanResult } from '../lib/foundry';
import { finalizeClaim } from '../lib/bountyService';

interface ScannerViewProps {
  activeBounty: any;
  onComplete: () => void;
}

export default function ScannerView({ activeBounty, onComplete }: ScannerViewProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' },
          audio: false
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        setError('Camera access denied. Please enable camera permissions.');
      }
    }
    if (!photo) startCamera();
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [photo]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const data = canvasRef.current.toDataURL('image/jpeg');
        setPhoto(data);
        processImage(data.split(',')[1]);
      }
    }
  };

  const processImage = async (base64: string) => {
    setScanning(true);
    try {
      const res = await analyzeWaste(base64);
      setResult(res);
    } catch (err: any) {
      setError('AI Analysis failed. Try again.');
    } finally {
      setScanning(false);
    }
  };

  const handleCommit = async () => {
    if (!result || !activeBounty) return;
    setCommitting(true);
    try {
      await finalizeClaim(activeBounty.id, result);
      onComplete();
    } catch (err) {
      console.error(err);
      setError('Error finalizing bounty: ' + (err as Error).message);
    } finally {
      setCommitting(false);
    }
  };

  const reset = () => {
    setPhoto(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="h-full w-full bg-black relative flex flex-col pt-20">
      {/* Target Info Header */}
      <div className="absolute top-4 left-6 right-6 h-10 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span className="text-[10px] font-mono text-white/60 tracking-widest uppercase">
            Active_Target: {activeBounty?.material || 'UNSET'}
          </span>
        </div>
        <div className="text-[10px] font-mono text-accent">
          {activeBounty?.value || 0} kz_Reward
        </div>
      </div>

      {!photo ? (
        <div className="flex-1 relative overflow-hidden bg-black mx-4 rounded-[40px] border border-white/10 shadow-2xl">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover grayscale-[0.8] contrast-150"
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-48 border-2 border-accent/20 rounded relative">
              <div className="absolute -top-6 left-0 text-[10px] text-accent font-mono bg-black px-1 uppercase tracking-tighter">Object_Search: {activeBounty?.material || 'SCANNING'}</div>
              <div className="absolute -bottom-6 left-0 text-[10px] text-accent font-mono bg-black px-1 uppercase tracking-tighter">Confidence_Threshold: 0.85</div>
              <div className="absolute inset-0 bg-accent/5 flex flex-col justify-center overflow-hidden">
                <div className="h-0.5 w-full bg-accent shadow-[0_0_15px_#00FF41] animate-scan"></div>
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-8 left-0 right-0 flex justify-center px-8">
            <button 
              onClick={takePhoto}
              className="w-20 h-20 rounded-full border-2 border-white/20 flex items-center justify-center active:scale-90 transition-transform bg-black/40 backdrop-blur-sm"
            >
              <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 active:bg-accent transition-colors" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden mx-4 rounded-[40px] bg-black border border-white/10 shadow-2xl">
          <img src={photo} className="w-full h-full object-cover opacity-40 grayscale" />
          
          <AnimatePresence>
            {scanning && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-30"
              >
                <RefreshCw className="text-accent animate-spin mb-6" size={40} />
                <h3 className="font-mono font-black text-xs text-accent tracking-[0.4em] uppercase">Processing_Intel</h3>
                <p className="text-white/30 font-mono text-[8px] mt-4 uppercase tracking-[0.2em]">Grounding_via_Foundry_IQ</p>
              </motion.div>
            )}

            {result && !scanning && (
              <motion.div 
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-0 left-0 right-0 p-8 glass rounded-t-[40px] z-40"
              >
                {result.fraudDetected ? (
                  <div className="text-center py-4">
                    <div className="inline-flex p-4 rounded-full bg-red-500/10 text-red-500 mb-4 border border-red-500/20">
                      <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-red-500 mb-2 uppercase tracking-tighter italic">Integrity_Fail_Detected</h3>
                    <p className="text-white/40 text-xs mb-6 font-mono tracking-tight">{result.explanation}</p>
                    <button onClick={reset} className="w-full py-4 bg-white/5 border border-white/10 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 transition-all font-mono">
                      Request_ReScan
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-accent text-black">
                          <CheckCircle2 size={24} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold leading-none uppercase tracking-tighter">Object_Validated</h3>
                          <div className="flex items-center gap-1 text-accent mt-1 opacity-70">
                            <ShieldCheck size={12} />
                            <span className="text-[9px] font-mono font-bold uppercase">Confidence: {Math.round(result.confidence * 100)}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-mono font-black text-accent tracking-tighter">+{result.rewardKz} Kz</div>
                        <div className="text-[9px] text-white/30 font-bold uppercase tracking-[0.1em]">Payout_Value</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <span className="text-[8px] text-white/40 block mb-1 uppercase font-bold tracking-widest leading-none">Class</span>
                        <span className="text-sm font-bold uppercase tracking-tight">{result.material}</span>
                      </div>
                      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <span className="text-[8px] text-white/40 block mb-1 uppercase font-bold tracking-widest leading-none">Mass</span>
                        <span className="text-sm font-mono font-bold">{result.estimatedWeight} KG</span>
                      </div>
                    </div>

                    {/* Foundry IQ grounding: citation-backed, auditable reward */}
                    <div className="mb-6 p-4 bg-accent/5 border border-accent/20 rounded-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-accent">
                          <BookText size={12} />
                          <span className="text-[9px] font-mono font-bold uppercase tracking-widest">
                            {result.provider === 'foundry-iq' ? 'Grounded_by_Foundry_IQ' : 'Grounded_Mock'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-white/40">
                          <Leaf size={11} />
                          <span className="text-[9px] font-mono">{result.co2SavedKg} kg CO2 saved</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {result.citations?.map((c) => (
                          <span key={c.id} className="text-[8px] font-mono px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/50">
                            {c.id}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={handleCommit}
                      disabled={committing}
                      className="w-full py-5 bg-accent text-black rounded-2xl font-bold text-xs uppercase tracking-[0.4em] shadow-[0_10px_40px_rgba(0,255,65,0.2)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {committing ? <RefreshCw className="animate-spin" size={20} /> : 'COMMIT_TO_WALLET'}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Hidden Canvas for Capture */}
      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <div className="absolute top-24 left-6 right-6 p-4 bg-red-900/80 backdrop-blur border border-red-500/50 rounded-xl text-xs font-bold text-center z-50">
          {error}
          <button onClick={() => setError(null)} className="block mx-auto mt-2 text-[10px] underline">DISMISS</button>
        </div>
      )}
    </div>
  );
}
