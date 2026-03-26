import type {Metadata} from 'next';
import { Space_Grotesk } from 'next/font/google';
import './globals.css'; // Global styles

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
});

export const metadata: Metadata = {
  title: 'Boss Rush: The First Encounter',
  description: 'A top-down boss rush game featuring dash combat, attack abilities, and a challenging boss fight.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable}`}>
      <body className="font-space" suppressHydrationWarning>{children}</body>
    </html>
  );
}
