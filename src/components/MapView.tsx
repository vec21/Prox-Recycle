import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Zap, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { claimBounty, Bounty } from '../lib/bountyService';

interface MapViewProps {
  onClaim: (bounty: Bounty) => void;
}

export default function MapView({ onClaim }: MapViewProps) {
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);
  const [bounties, setBounties] = useState<Bounty[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'bounties'), where('status', '==', 'available'));
    const unsub = onSnapshot(q, 
      (snapshot) => {
        const bts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bounty));
        setBounties(bts);
      },
      (error) => {
        console.error("MapView snapshot error:", error);
      }
    );
    return unsub;
  }, []);

  const handleClaim = async () => {
    if (!selectedBounty?.id) return;
    try {
      await claimBounty(selectedBounty.id);
      onClaim(selectedBounty);
    } catch (error) {
      console.error(error);
      alert('Could not claim bounty: ' + (error as Error).message);
    }
  };

  return (
    <div className="h-full w-full relative overflow-hidden bg-bg-card">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-20" 
        style={{ backgroundImage: 'radial-gradient(#222 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
      />
      
      {/* Heatmap Blobs (from design HTML) */}
      <div className="absolute top-1/4 left-1/3 w-48 h-48 bg-[#FF4100] blur-[80px] opacity-20"></div>
      <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-accent blur-[100px] opacity-10"></div>

      {/* Floating Bounty Pins */}
      {bounties.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4 opacity-30">
            <div className="w-12 h-12 border border-white/20 rounded-full flex items-center justify-center animate-pulse">
              <MapPin size={24} className="text-white" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em]">Zero_Intel_Detected</p>
            <p className="text-[8px] font-mono text-white/20 uppercase tracking-widest text-center px-12">Waiting for next transmission cycle...</p>
          </div>
        </div>
      ) : (
        bounties.map((b) => (
          <motion.div
            key={b.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            className="absolute"
            style={{ top: `${b.lat}%`, left: `${b.lng}%` }}
            onClick={() => setSelectedBounty(b)}
          >
            <div className="relative cursor-pointer">
              <div className={`w-4 h-4 rounded-full border-2 border-black ${
                b.type === 'surge' 
                  ? 'bg-orange-500 animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.8)] border-white/20' 
                  : 'bg-accent shadow-[0_0_10px_#00FF41]'
              }`} />
              
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded text-[9px] font-mono whitespace-nowrap text-white/60">
                {b.material} • <span className={b.type === 'surge' ? 'text-orange-400' : 'text-accent'}>{b.value}kz</span>
              </div>
            </div>
          </motion.div>
        ))
      )}

      {/* Target Status Panel (from bottom of Map in design HTML) */}
      <div className="absolute bottom-4 left-4 right-4 h-12 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <div className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Intel_Feed</div>
          <div className="text-[10px] font-mono text-accent">Targeting: Bairro Operário Sector-7</div>
        </div>
        <div className="flex gap-1.5">
          <div className="h-1.5 w-6 bg-accent rounded-full"></div>
          <div className="h-1.5 w-6 bg-white/10 rounded-full"></div>
          <div className="h-1.5 w-6 bg-white/10 rounded-full"></div>
        </div>
      </div>

      {/* Bounty Detail Panel */}
      <AnimatePresence>
        {selectedBounty && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="absolute top-6 left-6 w-72 glass p-5 rounded-2xl z-20 border border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${selectedBounty.type === 'surge' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-accent/10 text-accent border border-accent/30'}`}>
                {selectedBounty.type === 'surge' ? 'Surge_Active' : 'Intel_Claim'}
              </span>
              <button 
                onClick={() => setSelectedBounty(null)}
                className="text-white/20 hover:text-white"
              >
                <Info size={14} />
              </button>
            </div>
            
            <h3 className="text-lg font-bold tracking-tight mb-4 uppercase">{selectedBounty.material} REWARD</h3>
            
            <div className="grid grid-cols-2 gap-2 mb-6">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <p className="text-[8px] text-white/40 uppercase font-black mb-1">Payload</p>
                <p className="font-mono text-xs font-bold text-white/80">~2.4 KG</p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <p className="text-[8px] text-white/40 uppercase font-black mb-1">C_Intel</p>
                <p className="font-mono text-xs font-bold text-accent">{selectedBounty.value} Kz</p>
              </div>
            </div>

            <button 
              onClick={handleClaim}
              className="w-full py-3 bg-accent text-black rounded-xl font-bold text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg"
            >
              CLAIM_REWARD_intel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


