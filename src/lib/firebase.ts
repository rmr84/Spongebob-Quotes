import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

// Firebase web config. These values identify the project; they aren't secrets.
// Access is controlled by Firebase Security Rules and API key restrictions.
const firebaseConfig = {
  apiKey: 'AIzaSyCd9Hi2_w6M_WkITuY3QOhf_1oQqA7Jp3A',
  authDomain: 'spongebob-quotes-fb8af.firebaseapp.com',
  projectId: 'spongebob-quotes-fb8af',
  storageBucket: 'spongebob-quotes-fb8af.firebasestorage.app',
  messagingSenderId: '438438139558',
  appId: '1:438438139558:web:20bdb0eca107eae0350667',
  measurementId: 'G-PKJX8568S4',
};

export const app = initializeApp(firebaseConfig);

/** Resolves to null where Analytics can't run (e.g. blocked by the browser or an ad blocker). */
export const analytics: Promise<Analytics | null> = isSupported()
  .then((ok) => (ok ? getAnalytics(app) : null))
  .catch(() => null);

// Firebase is used for sign-in (and Analytics). Player data lives in MongoDB behind /api.
export const auth = getAuth(app);

// `NEXT_PUBLIC_AUTH_EMULATOR=http://127.0.0.1:9099 npm run dev` signs in against the local
// Auth emulator; run the dev server with FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 too.
if (process.env.NEXT_PUBLIC_AUTH_EMULATOR) {
  connectAuthEmulator(auth, process.env.NEXT_PUBLIC_AUTH_EMULATOR, { disableWarnings: true });
}
