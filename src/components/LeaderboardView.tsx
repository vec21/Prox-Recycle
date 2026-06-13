import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Medal, User } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function LeaderboardView() {
  const [leaders, setLeaders] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      orderBy('recycledWeight', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, 
      (snapshot) => {
        const docs = snapshot.docs.map(doc => doc.data());
        setLeaders(docs);
      },
      (error) => {
        console.error("Leaderboard snapshot error:", error);
      }
    );
    return unsub;
  }, []);

  return (
    <div className="h-full w-full bg-bg-base flex flex-col p-6 overflow-y-auto pb-32">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="p-2 rounded-xl bg-accent/10 border border-accent/20">
          <Trophy className="text-accent" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold uppercase tracking-tighter">Sector_Leaders</h2>
          <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Ranked_By_Total_Mass_Offset</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {leaders.length === 0 && (
          <div className="py-12 text-center text-white/20 font-mono text-xs uppercase tracking-widest">
            Syncing_Leaderboard_Data...
          </div>
        )}
        {leaders.map((leader, i) => (
          <motion.div
            key={leader.uid}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
              i === 0 ? 'bg-accent/10 border-accent/30' : 'bg-white/5 border-white/5'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-xs ${
                i === 0 ? 'bg-accent text-black' : 'bg-white/10 text-white/40'
              }`}>
                {i + 1}
              </div>
              <div>
                <h4 className="font-bold text-sm uppercase truncate max-w-[120px]">
                  {leader.displayName || leader.email?.split('@')[0] || 'Unknown_Agent'}
                </h4>
                <p className="text-[8px] text-white/30 font-mono uppercase tracking-wider">Sector-7 Guardian</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-mono font-black text-white/80">{leader.recycledWeight?.toFixed(1) || '0.0'}</div>
              <div className="text-[8px] text-white/20 font-bold uppercase tracking-widest">Total_KG</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-10 p-6 rounded-[32px] border border-white/10 bg-accent/5 relative overflow-hidden group">
        <div className="relative z-10">
          <Medal className="text-accent mb-4" size={32} />
          <h3 className="text-sm font-bold uppercase mb-2">Next_Tier_Unlock</h3>
          <p className="text-xs text-white/40 leading-relaxed font-medium">Reach 50KG Total Mass to unlock the <span className="text-accent italic">"Sector Guardian"</span> badge and 1.5x Multiplier.</p>
        </div>
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Trophy size={80} />
        </div>
      </div>
    </div>
  );
}
