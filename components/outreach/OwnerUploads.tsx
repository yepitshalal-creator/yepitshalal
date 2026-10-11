'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { finishUpload, startUpload, uploadsSent, type UploadPart } from '@/lib/outreach/uploads';
import { CheckIcon, PlusIcon } from '@/components/icons';

// Lets an owner who said yes send photos and videos from their phone. Photos
// are made into the site's two sizes right here, in the browser, so the
// website never needs an image tool and never uses Vercel's image optimiser.
// Nothing sent here is on the site until someone at YepItsHalal publishes it.

const BUCKET = 'owner-uploads';

type Item = { name: string; state: 'working' | 'done' | 'failed'; note?: string };

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Draws the picture into w x h, cropped to fill ('cover') or whole ('inside'). */
function draw(img: ImageBitmap, w: number, h: number, mode: 'cover' | 'inside'): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  if (mode === 'inside') {
    const scale = Math.min(1, w / img.width, h / img.height);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  canvas.width = w;
  canvas.height = h;
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
  return canvas;
}

async function photoParts(file: File): Promise<{ part: UploadPart; blob: Blob }[]> {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' });
  // WebP where the browser can make it, JPEG where it cannot. Card and
  // thumbnail share one type, because the site finds a thumbnail by path.
  const card0 = draw(img, 960, 720, 'cover');
  let type = 'image/webp';
  let card = await canvasBlob(card0, type, 0.8);
  if (!card || card.type !== type) {
    type = 'image/jpeg';
    card = await canvasBlob(card0, type, 0.82);
  }
  const thumb = await canvasBlob(draw(img, 320, 240, 'cover'), type, 0.8);
  const full = await canvasBlob(draw(img, 2048, 2048, 'inside'), 'image/jpeg', 0.88);
  img.close();
  if (!card || !thumb || !full) throw new Error('unreadable');
  return [
    { part: 'full', blob: full },
    { part: 'card', blob: card },
    { part: 'thumb', blob: thumb },
  ];
}

export function OwnerUploads({ token }: { token: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  async function send(files: FileList | null, kind: 'photo' | 'video') {
    if (!files?.length) return;
    setBusy(true);
    const supabase = createClient();
    let sent = 0;
    for (const file of Array.from(files)) {
      const index = items.length + sent;
      setItems((prev) => [...prev, { name: file.name, state: 'working' }]);
      const fail = (note: string) =>
        setItems((prev) => prev.map((it, i) => (i === index && it.state === 'working' ? { ...it, state: 'failed', note } : it)));
      try {
        const parts = kind === 'photo' ? await photoParts(file) : [{ part: 'video' as const, blob: file }];
        const start = await startUpload(
          token,
          kind,
          parts.map((p) => ({ part: p.part, contentType: p.blob.type, bytes: p.blob.size }))
        );
        if (start.error || !start.id || !start.targets) {
          fail(start.error ?? 'Did not send. Try again.');
          sent++;
          continue;
        }
        for (const t of start.targets) {
          const blob = parts.find((p) => p.part === t.part)!.blob;
          const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(t.path, t.token, blob, { contentType: t.contentType });
          if (error) throw new Error(error.message);
        }
        const done = await finishUpload(token, start.id);
        if (!done.ok) throw new Error('not saved');
        setItems((prev) => prev.map((it, i) => (i === index ? { ...it, state: 'done' } : it)));
      } catch {
        fail(kind === 'photo' ? 'We could not read this photo. Try a JPG.' : 'Did not send. Try again.');
      }
      sent++;
    }
    await uploadsSent(token, sent);
    setBusy(false);
    if (photoInput.current) photoInput.current.value = '';
    if (videoInput.current) videoInput.current.value = '';
  }

  const button =
    'inline-flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-4 text-[15px] font-semibold text-white transition active:scale-[0.99] has-[:disabled]:opacity-60';

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <h2 className="text-sm font-semibold text-ink">Add photos and videos</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Pick them from your phone. We look at each one before it goes on your page.
      </p>
      <div className="mt-3 flex gap-2">
        <label className={button}>
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          Photos
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(e) => send(e.target.files, 'photo')}
          />
        </label>
        <label className={button}>
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          Videos
          <input
            ref={videoInput}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(e) => send(e.target.files, 'video')}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">Videos up to 50 MB each. Bigger ones: reply to our email with them.</p>
      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-live="polite">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              {it.state === 'done' ? (
                <CheckIcon className="h-4 w-4 shrink-0 text-halal-full" aria-hidden="true" />
              ) : (
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${it.state === 'failed' ? 'bg-halal-partial' : 'animate-pulse bg-ink/40'}`}
                />
              )}
              <span className="min-w-0 flex-1 truncate text-ink/80">{it.name}</span>
              <span className="shrink-0 text-xs text-muted">
                {it.state === 'done' ? 'Sent' : it.state === 'failed' ? it.note : 'Sending…'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
