import type { Metadata, Viewport } from 'next';
import '../styles.css';

export const metadata: Metadata = {
  title: 'Bikini Bottom Daily — Who Said It?',
  description: 'A daily guessing game: one quote from Bikini Bottom, six tries to name who said it.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍍</text></svg>",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // let the background run under the notch; content uses safe-area padding
  themeColor: '#2ec4d6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
