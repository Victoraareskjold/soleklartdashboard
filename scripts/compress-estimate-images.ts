/**
 * Komprimerer eksisterende estimatbilder (mappene <leadId>/) i `estimate-images` på samme sti (URL-ene endres ikke).
 * Maks 1600 px, JPEG kvalitet 80. Bilder under 300 kB, eller som ikke blir minst 20 % mindre, røres ikke.
 *
 *   Prøvekjøring (laster ned og regner ut besparelse, endrer ingenting):
 *     npx tsx --env-file=.env scripts/compress-estimate-images.ts
 *   Faktisk komprimering (originalene lagres først i ./estimate-images-backup/):
 *     npx tsx --env-file=.env scripts/compress-estimate-images.ts --apply
 *   Valg: --limit=N (bare de N første filene), --no-backup
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BUCKET = "estimate-images";
const MAX_SIZE = 1600;
const QUALITY = 80;
const MIN_BYTES = 300 * 1024;
const MIN_SAVING = 0.2;
const BACKUP_DIR = "estimate-images-backup";

const apply = process.argv.includes("--apply");
const backup = !process.argv.includes("--no-backup");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const mb = (b: number) => (b / 1024 / 1024).toFixed(1) + " MB";

async function list(prefix: string) {
  const out: { name: string; id: string | null; size: number }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const f of data ?? []) out.push({ name: f.name, id: f.id, size: Number(f.metadata?.size ?? 0) });
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function allFiles() {
  const files: { path: string; size: number }[] = [];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const entry of await list("")) {
    // Bare lead-mapper. Rotfiler og andre mapper (f.eks. produktblad/ med PDF-er) røres ikke.
    if (entry.id || !uuid.test(entry.name)) continue;
    for (const f of await list(entry.name)) if (f.id) files.push({ path: `${entry.name}/${f.name}`, size: f.size });
  }
  return files;
}

async function main() {
  const files = (await allFiles()).filter((f) => f.size >= MIN_BYTES).slice(0, limit);
  console.log(`${apply ? "KOMPRIMERER" : "PRØVEKJØRING"} — ${files.length} bilder over ${MIN_BYTES / 1024} kB`);

  let before = 0, after = 0, changed = 0, skipped = 0;
  const errors: string[] = [];

  for (const [i, f] of files.entries()) {
    try {
      const { data, error } = await admin.storage.from(BUCKET).download(f.path);
      if (error || !data) throw error ?? new Error("tom fil");
      const input = Buffer.from(await data.arrayBuffer());
      const output = await sharp(input)
        .rotate() // respekter EXIF-orientering
        .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toBuffer();

      if (output.length > input.length * (1 - MIN_SAVING)) {
        skipped++;
        continue;
      }
      before += input.length;
      after += output.length;
      changed++;

      if (apply) {
        if (backup) {
          const dest = path.join(BACKUP_DIR, f.path);
          await mkdir(path.dirname(dest), { recursive: true });
          await writeFile(dest, input);
        }
        const { error: upErr } = await admin.storage
          .from(BUCKET)
          .upload(f.path, output, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
        if (upErr) throw upErr;
      }
    } catch (e) {
      errors.push(`${f.path}: ${(e as Error).message}`);
    }
    process.stdout.write(`\r  ${i + 1}/${files.length} · ${changed} komprimert · ${mb(before)} → ${mb(after)}`);
  }

  console.log(
    `\n${apply ? "Komprimerte" : "Ville komprimert"} ${changed} bilder: ${mb(before)} → ${mb(after)} ` +
      `(sparer ${mb(before - after)}). ${skipped} hoppet over (lite å spare).`,
  );
  if (apply && backup && changed) console.log(`Originalene ligger i ./${BACKUP_DIR}/`);
  if (errors.length) {
    console.error(`${errors.length} feil:`);
    for (const e of errors.slice(0, 20)) console.error("  " + e);
    process.exitCode = 1;
  }
  if (!apply) console.log("Kjør med --apply for å komprimere.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
