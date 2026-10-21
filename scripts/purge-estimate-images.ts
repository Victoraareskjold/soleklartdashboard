/**
 * Backfill: slett estimatbilder for alle leads med status «Ikke interessert» (3, 16)
 * eller «Nyhetsbrev» (11),
 * og bilder i mapper der leaden er slettet.
 *
 *   Tørrkjøring (standard, sletter ingenting):
 *     npx tsx --env-file=.env scripts/purge-estimate-images.ts
 *   Faktisk sletting:
 *     npx tsx --env-file=.env scripts/purge-estimate-images.ts --apply
 *
 * Krever service role-nøkkelen i .env.
 * Idempotent: kan kjøres på nytt når som helst.
 */
import { createClient } from "@supabase/supabase-js";
import {
  ESTIMATE_IMAGES_BUCKET,
  PURGE_IMAGE_STATUSES,
  UUID_RE,
  purgeEstimateImagesForLeads,
} from "../lib/storage/estimateImages.ts";

const apply = process.argv.includes("--apply");
const BATCH = 50;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function allNotInterestedLeadIds(): Promise<string[]> {
  const ids: string[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await admin
      .from("leads")
      .select("id")
      .in("status", [...PURGE_IMAGE_STATUSES])
      .order("id")
      .range(from, from + page - 1);
    if (error) throw error;
    ids.push(...(data ?? []).map((r) => r.id as string));
    if (!data || data.length < page) break;
  }
  return ids;
}

/** Mappenavn (leadId) i bucketen som ikke lenger finnes i leads-tabellen. */
async function orphanFolders(): Promise<string[]> {
  const folders: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(ESTIMATE_IMAGES_BUCKET).list("", { limit: 1000, offset });
    if (error) throw error;
    // Bare lead-mapper. Andre mapper (f.eks. produktblad/) hoppes over.
    for (const f of data ?? []) if (!f.id && UUID_RE.test(f.name)) folders.push(f.name);
    if (!data || data.length < 1000) break;
  }
  const orphans: string[] = [];
  for (let i = 0; i < folders.length; i += 100) {
    const chunk = folders.slice(i, i + 100);
    const { data, error } = await admin.from("leads").select("id").in("id", chunk);
    if (error) throw error;
    const existing = new Set((data ?? []).map((r) => r.id as string));
    orphans.push(...chunk.filter((f) => !existing.has(f)));
  }
  return orphans;
}

const mb = (b: number) => (b / 1024 / 1024).toFixed(1) + " MB";

async function main() {
  const ids = await allNotInterestedLeadIds();
  console.log(`${apply ? "SLETTER" : "TØRRKJØRING"} — ${ids.length} leads med status ${PURGE_IMAGE_STATUSES.join("/")}`);

  const total = { files: 0, bytes: 0, estimatesCleared: 0, errors: [] as string[] };
  for (let i = 0; i < ids.length; i += BATCH) {
    const res = await purgeEstimateImagesForLeads(admin, ids.slice(i, i + BATCH), { dryRun: !apply });
    total.files += res.files;
    total.bytes += res.bytes;
    total.estimatesCleared += res.estimatesCleared;
    total.errors.push(...res.errors);
    process.stdout.write(`\r  ${Math.min(i + BATCH, ids.length)}/${ids.length} leads · ${total.files} filer · ${mb(total.bytes)}`);
  }
  const orphans = await orphanFolders();
  if (orphans.length) {
    const res = await purgeEstimateImagesForLeads(admin, orphans, { dryRun: !apply });
    total.files += res.files;
    total.bytes += res.bytes;
    total.errors.push(...res.errors);
    console.log(`\n  + ${orphans.length} mapper fra slettede leads · ${res.files} filer · ${mb(res.bytes)}`);
  }

  console.log(
    `\n${apply ? "Slettet" : "Ville slettet"} ${total.files} filer (${mb(total.bytes)}), ` +
      `nullet image_url på ${total.estimatesCleared} estimater.`,
  );
  if (total.errors.length) {
    console.error(`${total.errors.length} feil:`);
    for (const e of total.errors.slice(0, 20)) console.error("  " + e);
    process.exitCode = 1;
  }
  if (!apply) console.log("Kjør med --apply for å slette.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
