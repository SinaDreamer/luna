import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
} from 'firebase/auth';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { DEFAULT_SETTINGS } from '../lib/cycle.js';
import { DEFAULT_SHARING } from '../lib/constants.js';
import { todayKey } from '../lib/dates.js';
import { cleanEntry, isEmptyEntry, onboardingDays } from './entries.js';

// Firestore layout
//   users/{uid}                     { role: 'tracker'|'partner', coupleId, name }
//   couples/{cid}                   { trackerUid, trackerName, partnerUid, partnerName, inviteCode, sharing, settings, onboarded }
//   couples/{cid}/days/{YYYY-MM-DD} day logs - readable by the tracker only
//   couples/{cid}/shared/summary    prediction model filtered by her sharing choices - readable by both
//   invites/{CODE}                  { coupleId, createdBy } - lets the partner find the couple

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export function useFirebaseBackend() {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [couple, setCouple] = useState(undefined);
  const [days, setDays] = useState({});
  const [summary, setSummary] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setProfile(undefined);
        setCouple(undefined);
        setDays({});
        setSummary(undefined);
      }),
    [],
  );

  useEffect(() => {
    if (!user) return undefined;
    return onSnapshot(
      doc(db, 'users', user.uid),
      (s) => setProfile(s.exists() ? s.data() : null),
      (e) => setError(e.message),
    );
  }, [user]);

  const cid = profile?.coupleId;
  const role = profile?.role;
  const hasProfile = !!profile;

  useEffect(() => {
    if (!cid) {
      if (hasProfile) setCouple(null);
      return undefined;
    }
    // A permission error here means the partner was unlinked.
    return onSnapshot(
      doc(db, 'couples', cid),
      (s) => setCouple(s.exists() ? { id: s.id, ...s.data() } : null),
      () => setCouple(null),
    );
  }, [cid, hasProfile]);

  useEffect(() => {
    if (!cid || role !== 'tracker') return undefined;
    return onSnapshot(
      collection(db, 'couples', cid, 'days'),
      (qs) => {
        const d = {};
        qs.forEach((x) => {
          d[x.id] = x.data();
        });
        setDays(d);
      },
      (e) => setError(e.message),
    );
  }, [cid, role]);

  const linked = role === 'partner' && couple && couple.partnerUid === user?.uid;
  useEffect(() => {
    if (!linked) return undefined;
    return onSnapshot(
      doc(db, 'couples', cid, 'shared', 'summary'),
      (s) => setSummary(s.exists() ? s.data() : null),
      () => setSummary(null),
    );
  }, [cid, linked]);

  let status;
  if (user === undefined) status = 'loading';
  else if (user === null) status = 'signed-out';
  else if (profile === undefined) status = 'loading';
  else if (profile === null) status = 'needs-role';
  else if (role === 'partner') status = !cid ? 'needs-link' : couple === undefined ? 'loading' : linked ? 'ready' : 'needs-link';
  else if (couple === undefined) status = 'loading';
  else if (!couple) status = 'needs-role';
  else status = couple.onboarded ? 'ready' : 'needs-onboarding';

  const uid = user?.uid;
  const name = profile?.name || user?.displayName || '';
  const coupleRef = cid ? doc(db, 'couples', cid) : null;

  const actions = {
    signIn: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
    signUp: async (email, pw, displayName) => {
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      if (displayName) await updateProfile(cred.user, { displayName });
    },
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    signOut: () => signOut(auth),

    chooseRole: async (r, displayName) => {
      if (r === 'tracker') {
        const ref = doc(collection(db, 'couples'));
        await setDoc(ref, {
          trackerUid: uid,
          trackerName: displayName,
          partnerUid: null,
          partnerName: null,
          inviteCode: null,
          sharing: DEFAULT_SHARING,
          settings: DEFAULT_SETTINGS,
          onboarded: false,
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'users', uid), { role: 'tracker', coupleId: ref.id, name: displayName });
      } else {
        await setDoc(doc(db, 'users', uid), { role: 'partner', coupleId: null, name: displayName });
      }
    },

    joinWithCode: async (raw) => {
      const code = raw.trim().toUpperCase();
      const inv = await getDoc(doc(db, 'invites', code));
      if (!inv.exists()) throw new Error("That code doesn't exist. Ask her for a fresh one.");
      const coupleId = inv.data().coupleId;
      await updateDoc(doc(db, 'couples', coupleId), { partnerUid: uid, partnerName: name });
      await updateDoc(doc(db, 'users', uid), { coupleId });
      await deleteDoc(doc(db, 'invites', code)).catch(() => {});
    },

    createInvite: async () => {
      if (couple?.inviteCode) await deleteDoc(doc(db, 'invites', couple.inviteCode)).catch(() => {});
      const code = newCode();
      await setDoc(doc(db, 'invites', code), { coupleId: cid, createdBy: uid, createdAt: serverTimestamp() });
      await updateDoc(coupleRef, { inviteCode: code });
      return code;
    },

    unlinkPartner: () => updateDoc(coupleRef, { partnerUid: null, partnerName: null, inviteCode: null }),

    leaveCouple: async () => {
      if (coupleRef && couple?.partnerUid === uid) await updateDoc(coupleRef, { partnerUid: null, partnerName: null });
      await updateDoc(doc(db, 'users', uid), { coupleId: null });
    },

    // Writes resolve only once the server confirms, so the UI doesn't await them; the
    // local snapshot updates instantly, which also makes this work offline.
    saveDay: (key, entry) => {
      const ref = doc(db, 'couples', cid, 'days', key);
      const p = isEmptyEntry(entry) ? deleteDoc(ref) : setDoc(ref, cleanEntry(entry));
      p.catch((e) => setError(e.message));
    },
    saveSettings: (patch) => updateDoc(coupleRef, { settings: { ...couple.settings, ...patch } }).catch((e) => setError(e.message)),
    saveSharing: (patch) => updateDoc(coupleRef, { sharing: { ...couple.sharing, ...patch } }).catch((e) => setError(e.message)),
    saveName: async (n) => {
      await updateDoc(doc(db, 'users', uid), { name: n });
      if (coupleRef) await updateDoc(coupleRef, role === 'tracker' ? { trackerName: n } : { partnerName: n });
    },

    completeOnboarding: async ({ name: n, settings, starts }) => {
      const batch = writeBatch(db);
      const generated = onboardingDays(starts, settings.periodLength, todayKey());
      for (const [k, v] of Object.entries(generated)) {
        if (!days[k]) batch.set(doc(db, 'couples', cid, 'days', k), v);
      }
      batch.update(coupleRef, { settings: { ...couple.settings, ...settings }, onboarded: true, trackerName: n });
      batch.update(doc(db, 'users', uid), { name: n });
      await batch.commit();
    },

    publishSummary: (data) => setDoc(doc(db, 'couples', cid, 'shared', 'summary'), data).catch((e) => setError(e.message)),

    importData: async (data) => {
      const entries = Object.entries(data.days || {});
      for (let i = 0; i < entries.length; i += 400) {
        const batch = writeBatch(db);
        entries.slice(i, i + 400).forEach(([k, v]) => batch.set(doc(db, 'couples', cid, 'days', k), cleanEntry(v)));
        await batch.commit();
      }
      if (data.settings) await updateDoc(coupleRef, { settings: { ...couple.settings, ...data.settings } });
    },

    deleteAll: async () => {
      const snap = await getDocs(collection(db, 'couples', cid, 'days'));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'couples', cid, 'shared', 'summary')).catch(() => {});
      if (couple?.inviteCode) await deleteDoc(doc(db, 'invites', couple.inviteCode)).catch(() => {});
      await deleteDoc(coupleRef);
      await deleteDoc(doc(db, 'users', uid));
    },
  };

  return {
    mode: 'firebase',
    status,
    error,
    clearError: () => setError(null),
    user,
    role,
    name,
    email: user?.email,
    partnerName: role === 'tracker' ? couple?.partnerName : couple?.trackerName,
    partnerLinked: role === 'tracker' ? !!couple?.partnerUid : linked,
    inviteCode: couple?.inviteCode,
    days,
    settings: { ...DEFAULT_SETTINGS, ...couple?.settings },
    sharing: { ...DEFAULT_SHARING, ...couple?.sharing },
    summary,
    actions,
  };
}
