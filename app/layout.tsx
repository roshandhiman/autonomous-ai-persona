import { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Ada - AI Security Feed',
  description: 'An autonomous AI security persona publishing live technology analysis.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
