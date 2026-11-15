import type { Metadata } from 'next';
import { CommonEditorApp } from '@/components/szs/CommonEditorApp';

export const metadata: Metadata = {
  title: 'common.szs',
  description: 'Recolor Mario Kart Wii’s race effects in common.szs in the browser: sparks, boosts, items, splashes.',
};

export default function CommonSzsPage() {
  return <CommonEditorApp />;
}
