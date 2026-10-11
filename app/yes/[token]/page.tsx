import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { YesView } from '@/components/outreach/YesView';
import { activePermission, contactByToken, isStopped, outreachDb, targetOf } from '@/lib/outreach/data';

// The page every outreach email and call ends at, one per place (its token).
// It asks once, keeps the exact words agreed to, and lets the same person take
// it back later from the same link. Nothing here changes a halal label.

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Your page on YepItsHalal',
  robots: { index: false, follow: false },
};

export default async function YesPage({ params }: { params: { token: string } }) {
  const db = outreachDb();
  const contact = await contactByToken(db, params.token);
  if (!contact) notFound();
  const target = await targetOf(db, contact);
  if (!target) notFound();
  const permission = await activePermission(db, contact.id);
  const saidNo = !permission && (contact.status === 'said_no' || (await isStopped(db, contact)));

  return <YesView token={params.token} target={target} permission={permission} saidNo={saidNo} />;
}
