import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  serverTimestamp,
  increment,
  runTransaction,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from './firebase';

export interface Bounty {
  id?: string;
  material: string;
  value: number;
  lat: number;
  lng: number;
  status: 'available' | 'claimed' | 'completed';
  type: 'regular' | 'surge';
  createdAt: any;
}

const MATERIALS = ['PET', 'Aluminum', 'Cardboard', 'Glass'];

export async function seedInitialBounties() {
  const q = query(collection(db, 'bounties'), where('status', '==', 'available'));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(addDoc(collection(db, 'bounties'), {
        material: MATERIALS[Math.floor(Math.random() * MATERIALS.length)],
        value: Math.floor(Math.random() * 500) + 50,
        lat: 20 + Math.random() * 60,
        lng: 20 + Math.random() * 60,
        status: 'available',
        type: Math.random() > 0.7 ? 'surge' : 'regular',
        createdAt: serverTimestamp()
      }));
    }
    await Promise.all(promises);
  }
}

export async function claimBounty(bountyId: string) {
  const user = auth.currentUser;
  if (!user) return;

  const bountyRef = doc(db, 'bounties', bountyId);
  
  await runTransaction(db, async (transaction) => {
    const bountyDoc = await transaction.get(bountyRef);
    if (!bountyDoc.exists() || bountyDoc.data().status !== 'available') {
      throw new Error('Bounty is no longer available');
    }

    transaction.update(bountyRef, {
      status: 'claimed',
      claimedBy: user.uid
    });

    const claimDoc = doc(collection(db, 'claims'));
    transaction.set(claimDoc, {
      bountyId,
      userId: user.uid,
      status: 'pending',
      createdAt: serverTimestamp()
    });
  });
}

export async function finalizeClaim(bountyId: string, result: any) {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, 'users', user.uid);
  const bountyRef = doc(db, 'bounties', bountyId);
  // Prefer the Foundry IQ-grounded, citation-backed reward; fall back to a local estimate.
  const rewards = typeof result.rewardKz === 'number' && result.rewardKz > 0
    ? Math.round(result.rewardKz)
    : Math.round(result.estimatedWeight * 150 * (result.material === 'PET' ? 2 : 1));

  // Find the pending claim
  const claimsQ = query(
    collection(db, 'claims'), 
    where('bountyId', '==', bountyId), 
    where('userId', '==', user.uid),
    where('status', '==', 'pending'),
    limit(1)
  );
  const claimsSnap = await getDocs(claimsQ);
  const claimRef = claimsSnap.empty ? null : doc(db, 'claims', claimsSnap.docs[0].id);

  await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) {
      transaction.set(userRef, {
        uid: user.uid,
        email: user.email || 'anonymous@eco.bounty',
        balance: rewards,
        recycledWeight: result.estimatedWeight,
        createdAt: serverTimestamp(),
      });
    } else {
      transaction.update(userRef, {
        balance: increment(rewards),
        recycledWeight: increment(result.estimatedWeight),
        lastClaim: {
          amount: rewards,
          material: result.material,
          weight: result.estimatedWeight,
          co2SavedKg: result.co2SavedKg ?? 0,
          citations: result.citations ?? [],
          provider: result.provider ?? 'mock',
          date: new Date().toISOString()
        },
        updatedAt: serverTimestamp()
      });
    }

    transaction.update(bountyRef, {
      status: 'completed'
    });

    if (claimRef) {
      transaction.update(claimRef, {
        status: 'completed',
        materialValidated: result.material,
        weightValidated: result.estimatedWeight,
        completedAt: serverTimestamp()
      });
    }
  });
}

export async function getUserClaims(userId: string) {
  const q = query(
    collection(db, 'claims'), 
    where('userId', '==', userId), 
    where('status', '==', 'completed'),
    orderBy('createdAt', 'desc'),
    limit(5)
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
