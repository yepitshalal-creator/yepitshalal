import { createAdminSupabase } from '@/lib/supabase/admin';

// Writing down a halal check we carried out ourselves. Shared by the two ways
// a check reaches the site: answering a request in the verification queue
// (publishVerification), and recording a call, visit or register check
// straight from a restaurant's admin page (recordCheck), which is where "What
// to check next" and "Certificate claims" send you.
//
// Not a 'use server' file on purpose: everything exported from one of those
// becomes callable over the network, and this must only ever run behind an
// action that has already called requireAdmin().
//
// The rules it keeps:
// - A check we carried out becomes a strong evidence record. The public label
//   is derived from evidence by refresh_halal_status(), through the trigger on
//   restaurant_halal_evidence. Nothing here writes a label directly.
// - "Couldn't confirm" records the attempt and leaves everything public
//   untouched: failing to confirm is not a finding that a place is not halal.
// - "Not halal" is only ever what the restaurant itself told us, never an
//   inference. It is recorded as their statement and search then leaves the
//   place out, the same as a not-halal statement on their own website.
// - Every fact is three-state. A question left at "Don't know" stays null.
// - Every write is checked. Older checks step down before the new one goes
//   in, so a failure part way can only ever show less than the newest check
//   found, never more; if the new one will not save, they step back up. A
//   failure throws a sentence for the admin, which the actions show.

export const METHOD_LABEL: Record<string, string> = {
  visit: 'Visited in person',
  phone: 'Spoke to the restaurant',
  documents: 'Saw certificates or supplier documents',
  certifier_register: "Found on the certifier's register",
};

export type CheckOutcome = 'fully_halal' | 'halal_options' | 'unverified' | 'not_halal';

export async function saveCheck({
  restaurantId,
  requestId,
  formData,
  adminId,
  allowNotHalal,
}: {
  restaurantId: string;
  requestId: string | null;
  formData: FormData;
  adminId: string;
  allowNotHalal: boolean;
}): Promise<{ outcome: CheckOutcome; verified: boolean }> {
  const supabase = createAdminSupabase();

  const raw = String(formData.get('classification'));
  const allowed: CheckOutcome[] = allowNotHalal
    ? ['fully_halal', 'halal_options', 'unverified', 'not_halal']
    : ['fully_halal', 'halal_options', 'unverified'];
  if (!allowed.includes(raw as CheckOutcome)) throw new Error('Choose what the check found.');
  const outcome = raw as CheckOutcome;

  const method = String(formData.get('method') ?? '');
  const publicSummary = String(formData.get('public_summary') ?? '').trim().slice(0, 280);
  const sourceUrl = String(formData.get('source_url') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '');
  const verified = outcome === 'fully_halal' || outcome === 'halal_options';
  const finding = verified || outcome === 'not_halal';
  if (finding && (!METHOD_LABEL[method] || !publicSummary)) {
    throw new Error('Say how you checked and what you found before saving a result.');
  }

  function tri(name: string): boolean | null {
    const v = formData.get(name);
    if (v === 'yes') return true;
    if (v === 'no') return false;
    return null;
  }

  const now = new Date().toISOString();
  const certificationBody = String(formData.get('certification_body') ?? '').trim() || null;
  const facts = {
    restaurant_id: restaurantId,
    all_meat_halal: tri('all_meat_halal'),
    serves_non_halal_meat: tri('serves_non_halal_meat'),
    serves_pork: tri('serves_pork'),
    serves_alcohol: tri('serves_alcohol'),
    has_certification: tri('has_certification'),
    certification_body: certificationBody,
    verification_notes: notes || null,
    verified_at: now,
    last_verified_at: now,
    next_review_due_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    last_outcome: verified ? 'verified' : outcome === 'not_halal' ? 'not_halal' : 'unable_to_verify',
  };

  if (finding) {
    // A newer check replaces an older one rather than stacking beside it.
    const { data: steppedDown, error: downError } = await supabase
      .from('restaurant_halal_evidence')
      .update({ is_current: false })
      .eq('restaurant_id', restaurantId)
      .in('kind', ['yepitshalal_check', 'certification'])
      .eq('is_current', true)
      .select('id');
    if (downError) fail('Nothing was saved. Try again.', downError);

    const evidence: Record<string, string | null>[] = [
      {
        restaurant_id: restaurantId,
        kind: 'yepitshalal_check',
        claim: outcome,
        strength: 'strong',
        source_name: 'YepItsHalal',
        source_url: null,
        excerpt: publicSummary,
        notes: METHOD_LABEL[method],
        checked_at: now,
        checked_by: `admin:${adminId}`,
      },
    ];
    // Certification is only recorded as confirmed when it was confirmed with
    // the certifier, not when a restaurant showed us a logo. This row is what
    // lets the public facts panel say "Certified". Without it, a yes to
    // has_certification shows as what the restaurant says (HalalFactsPanel).
    if (verified && facts.has_certification === true && certificationBody && method === 'certifier_register') {
      evidence.push({
        restaurant_id: restaurantId,
        kind: 'certification',
        claim: outcome,
        strength: 'strong',
        source_name: certificationBody,
        source_url: sourceUrl,
        excerpt: `Listed on ${certificationBody}'s register of certified outlets.`,
        notes: null,
        checked_at: now,
        checked_by: `admin:${adminId}`,
      });
    }
    const { error: addError } = await supabase.from('restaurant_halal_evidence').insert(evidence);
    if (addError) {
      const ids = ((steppedDown ?? []) as { id: string }[]).map((r) => r.id);
      const { error: backError } = ids.length
        ? await supabase.from('restaurant_halal_evidence').update({ is_current: true }).in('id', ids)
        : { error: null };
      if (backError) {
        fail('The check did not save, and the older check could not be put back, so the page shows less than it did. Save it again.', addError);
      }
      fail('Nothing was saved. Try again.', addError);
    }

    const { error: factsError } = await supabase.from('restaurant_halal_facts').upsert(facts, { onConflict: 'restaurant_id' });
    if (factsError) fail('The label is saved, but not the answers to each question. Save it again.', factsError);
  }

  const { error: historyError } = await supabase.from('verification_history').insert({
    restaurant_id: restaurantId,
    verification_request_id: requestId,
    // The history column holds the site's three labels; "not halal" is kept
    // in the snapshot, where it is not mistaken for a label.
    classification_result: outcome === 'not_halal' ? 'unverified' : outcome,
    facts_snapshot: { ...facts, outcome, method, public_summary: publicSummary, source_url: sourceUrl },
  });
  if (historyError) {
    fail(finding ? 'The check is saved, but not its line in the history. Save it again.' : 'Nothing was saved. Try again.', historyError);
  }

  return { outcome, verified };
}

/** Logs what the database said and throws the sentence the admin sees. */
function fail(message: string, cause: { message: string }): never {
  console.error('[check]', message, cause.message);
  throw new Error(message);
}
