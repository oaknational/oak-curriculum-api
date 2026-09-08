import type { Metadata } from 'next';
import { Lexend } from 'next/font/google';
import { PostHogProvider } from '@/context/AnalyticsProvider';
import StyleContext from '@/context/StyleContext';

const lexend = Lexend({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
  variable: '--font-lexend',
  weight: ['300', '400', '600'],
});

export const metadata: Metadata = {
  title: 'Oak Curriculum API - Oak National Academy',
  icons: [
    { rel: 'icon', type: 'image/x-icon', url: '/images/favicon.ico' },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '48x48',
      url: '/images/favicon-48x48.png',
    },
  ],
};

export default function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en-GB" className={lexend.variable}>
      <body>
        <PostHogProvider>
          <StyleContext>{children}</StyleContext>
        </PostHogProvider>
      </body>
    </html>
  );
}
