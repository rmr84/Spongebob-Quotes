'use client';

import dynamic from 'next/dynamic';

// The game reads localStorage and the player's local date on first render,
// so it only renders in the browser.
const App = dynamic(() => import('@/components/App'), { ssr: false });

export default function Page() {
  return <App />;
}
