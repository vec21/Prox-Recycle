/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map as MapIcon, Camera, Wallet, Trophy, Bell, Settings, ArrowRight, LogIn, UserRound } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { seedInitialBounties } from './lib/bountyService';

// Components
import MapView from './components/MapView';
import ScannerView from './components/ScannerView';
import WalletView from './components/WalletView';
import LeaderboardView from './components/LeaderboardView';
import SettingsView from './components/SettingsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'scan' | 'wallet' | 'leaderboard' | 'settings'>('map');
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeBounty, setActiveBounty] = useState<any>(null);

  useEffect(() => {
    let unsubData: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      try {
        if (u) {
          setUser(u);
          setAuthError(null);
          const userRef = doc(db, 'users', u.uid);
          
          if (unsubData) unsubData();
          unsubData = onSnapshot(userRef, 
            (snapshot) => {
              if (snapshot.exists()) {
                setUserData(snapshot.data());
              }
            },
            (error) => {
              console.error("Firestore user data listener error:", error);
              // Only set error if we don't have cached data
              if (!userData) {
                setAuthError("Failed to sync user data: " + error.message);
              }
            }
          );

          // Run seed in background
          seedInitialBounties().catch(err => {
            console.warn("Seeding error (usually index related):", err);
          });
          setLoading(false);
        } else {
          // Attempt anonymous if no user, but handle restriction
          try {
            await signInAnonymously(auth);
          } catch (anonErr: any) {
            console.warn("Auth status: Anonymous restricted.", anonErr.code);
            if (anonErr.code === 'auth/admin-restricted-operation') {
              setAuthError("Sign-in required to access mapping nodes.");
            } else {
              setAuthError(anonErr.message || "Authentication restricted");
            }
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error("Auth initialization error:", err);
        setAuthError(err.message || "Auth Error");
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubData) unsubData();
    };
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/admin-restricted-operation') {
        setAuthError("Guest access is off. Enable Anonymous sign-in in Firebase Console to let judges enter without an account.");
      } else {
        setAuthError(err.message || "Guest sign-in failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClaimStart = (bounty: any) => {
    setActiveBounty(bounty);
    setActiveTab('scan');
  };

  const handleScanComplete = () => {
    setActiveBounty(null);
    setActiveTab('wallet');
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-black font-mono">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-accent text-4xl mb-4"
        >
          ECO-BOUNTY
        </motion.div>
        <div className="text-[10px] text-white/30 uppercase tracking-[0.5em] animate-pulse">Syncing_Nodes...</div>
      </div>
    );
  }

  if (!user || authError) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg-base p-8 font-mono">
        <div className="w-16 h-16 border border-accent/20 rounded-2xl flex items-center justify-center mb-8 bg-accent/5">
          <div className="w-8 h-8 border-4 border-accent rounded-sm transform rotate-45 animate-pulse"></div>
        </div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2 italic">Connection_Required</h1>
        <p className="text-[10px] text-white/40 uppercase tracking-widest text-center mb-10 leading-relaxed">
          {authError || "Secure transmission tunnel establishing..."}
        </p>

        <button 
          onClick={handleGoogleLogin}
          className="w-full max-w-xs py-4 bg-accent text-black rounded-xl font-bold text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-[0_5px_20px_rgba(0,255,65,0.2)] active:scale-95 transition-all"
        >
          <LogIn size={18} />
          Authenticate_With_Google
        </button>

        <button
          onClick={handleGuestLogin}
          className="w-full max-w-xs mt-3 py-4 bg-white/5 border border-white/10 text-white/70 rounded-xl font-bold text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-white/10 hover:text-white active:scale-95 transition-all"
        >
          <UserRound size={18} />
          Enter_As_Guest
        </button>

        <p className="text-[8px] text-white/20 uppercase tracking-[0.3em] mt-6 text-center">
          Judges_&amp;_Reviewers — use Guest for instant access
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-base max-w-[480px] mx-auto border-x border-white/5 relative shadow-2xl">
      {/* Header */}
      <header className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-accent rounded-lg flex items-center justify-center bg-accent/5">
            <div className="w-5 h-5 border-[3px] border-accent rounded-sm transform rotate-45"></div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tighter uppercase text-white leading-none">
              {userData?.displayName || 'Eco-Bounty'}
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <p className="text-[8px] font-mono text-accent uppercase leading-none">Status: Optimal</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-2">
            <p className="text-[8px] uppercase text-white/30 mb-0.5 leading-none font-bold tracking-widest">Balance</p>
            <p className="text-lg font-mono leading-none tracking-tighter text-accent">
              {userData?.balance?.toLocaleString() || '0'} <span className="text-[10px] text-white/40 italic">Kz</span>
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <MapView onClaim={handleClaimStart} />
            </motion.div>
          )}
          {activeTab === 'scan' && (
            <motion.div
              key="scan"
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              className="absolute inset-0 z-20"
            >
              <ScannerView 
                activeBounty={activeBounty} 
                onComplete={handleScanComplete} 
              />
            </motion.div>
          )}
          {activeTab === 'wallet' && (
            <motion.div
              key="wallet"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="absolute inset-0"
            >
              <WalletView userData={userData} onOpenSettings={() => setActiveTab('settings')} />
            </motion.div>
          )}
          {activeTab === 'leaderboard' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0"
            >
              <LeaderboardView />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="absolute inset-0 z-40 bg-bg-base"
            >
              <SettingsView userData={userData} onBack={() => setActiveTab('wallet')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>


      {/* Navigation */}
      <nav className="h-20 bg-black/60 backdrop-blur-xl border-t border-white/10 px-8 flex items-center justify-between text-[10px] font-mono text-white/40 uppercase z-30">
        <div className="flex gap-10 items-center">
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'map' ? 'text-accent' : 'hover:text-white'}`}
          >
            <MapIcon size={18} />
            <span className="text-[8px] font-bold">Map</span>
          </button>
          <button 
            onClick={() => setActiveTab('wallet')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'wallet' ? 'text-accent' : 'hover:text-white'}`}
          >
            <Wallet size={18} />
            <span className="text-[8px] font-bold">Base</span>
          </button>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 -top-8">
          <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab('scan')}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all border-2 border-white/20 bg-black/80 backdrop-blur-xl group`}
          >
            <Camera size={28} className={`transition-colors ${activeTab === 'scan' ? 'text-accent' : 'text-white/60 group-hover:text-accent'}`} />
          </motion.button>
        </div>

        <button 
          onClick={() => setActiveTab('leaderboard')}
          className={`flex items-center gap-2 transition-colors ${activeTab === 'leaderboard' ? 'text-accent' : 'hover:text-white'}`}
        >
          <Trophy size={14} className={activeTab === 'leaderboard' ? 'text-accent' : 'text-white/20'} />
          <span className={`font-black ${activeTab === 'leaderboard' ? 'text-accent' : ''}`}>LDR_BRD</span>
        </button>
      </nav>
    </div>
  );
}



function NavBtn({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all duration-300 ${active ? 'text-neon-green' : 'text-white/40'}`}
    >
      <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-neon-green/10' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

