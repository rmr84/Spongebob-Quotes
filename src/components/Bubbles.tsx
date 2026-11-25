/**
 * Bubbles rising through the sea: on the home screen and behind every page on phones.
 * Negative delays start each bubble partway up, so a page opens with bubbles already in view.
 */
export function Bubbles() {
  return (
    <div className="bubbles" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `-${(i * 1.3) % 9}s`, width: 8 + ((i * 7) % 22), height: 8 + ((i * 7) % 22) }} />
      ))}
    </div>
  );
}
