import { useEffect, useState } from 'react';
import { msUntilTomorrow } from '../lib/daily';

export function Countdown({ onRollover }: { onRollover: () => void }) {
  const [ms, setMs] = useState(msUntilTomorrow());

  useEffect(() => {
    const id = setInterval(() => {
      const left = msUntilTomorrow();
      setMs(left);
      if (left < 1000) onRollover();
    }, 1000);
    return () => clearInterval(id);
  }, [onRollover]);

  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="countdown">
      {pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}
    </span>
  );
}
