import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Mountain Cabin · Out Of Office',
  description: 'A small place in a vast world. Explore a living alpine landscape and your own refuge above the clouds.',
};

export default function MountainCabinLayout({ children }: { children: ReactNode }) {
  return children;
}
