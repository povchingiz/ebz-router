import type { Metadata } from 'next';
import './globals.css';
import { SiteGate } from '../components/auth/SiteGate';

export const metadata: Metadata = {
  title: 'ЕБЗ Роутер — Единая база знаний и маршрутизация',
  description: 'Классификатор компетенций и иерархии госорганов РК для точной маршрутизации обращений',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white">
        <SiteGate>{children}</SiteGate>
      </body>
    </html>
  );
}
