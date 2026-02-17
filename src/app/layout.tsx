import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Snake Game',
  description: 'Мини-игра Snake на Next.js + TypeScript + Tailwind',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
