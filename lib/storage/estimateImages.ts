import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sletting av estimatbilder for leads som er satt til «Ikke interessert» eller «Nyhetsbrev».
 *
 * Bildene ligger i bucketen `estimate-images` under `<leadId>/<filnavn>-<timestamp>`
 * (se EstimateSection.uploadImage), og den offentlige URL-en lagres i `estimates.image_url`.
 *
 * Holdes fri for "@/"-aliaser slik at backfill-skriptet (scripts/) kan importere filen direkte.
 */

export const ESTIMATE_IMAGES_BUCKET = "estimate-images";

/**
 * Statuser der estimatbildene slettes:
 * 3 = Ikke interessert (kaldringing), 11 = Nyhetsbrev (langsiktig nurturing),
 * 16 = Ikke interessert (pipeline).
 */
export const PURGE_IMAGE_STATUSES: readonly number[] = [3, 11, 16];

export function shouldPurgeImages(status: unknown): boolean {
  return PURGE_IMAGE_STATUSES.includes(Number(status));
}

export type PurgeResult = {
  leadIds: number;
  files: number;
  bytes: number;
  estimatesCleared: number;
  errors: string[];
};

const REMOVE_CHUNK = 100;

/**
 * Bare mapper som heter som en lead-UUID er estimatbilder. Bucketen deler plass med andre ting,
 * f.eks. `produktblad/` (PDF-er fra ProductDialog), og de må aldri røres.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trekker ut objekt-stien fra en offentlig URL til estimate-images, ellers null. */
export function pathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${ESTIMATE_IMAGES_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

/** Lister alle filer i mappen `<leadId>/` (paginert). */
async function listLeadFolder(admin: SupabaseClient, leadId: string) {
  const files: { path: string; size: number }[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage
      .from(ESTIMATE_IMAGES_BUCKET)
      .list(leadId, { limit: pageSize, offset });
    if (error) throw new Error(`list ${leadId}: ${error.message}`);
    for (const f of data ?? []) {
      if (!f.id) continue; // undermappe, ikke fil
      files.push({ path: `${leadId}/${f.name}`, size: Number(f.metadata?.size ?? 0) });
    }
    if (!data || data.length < pageSize) break;
  }
  return files;
}

/**
 * Sletter alle estimatbilder for de gitte leadene og nuller `estimates.image_url`.
 * Idempotent: trygt å kjøre flere ganger. Krever admin-klient (service role).
 *
 * Tar både filene i `<leadId>/`-mappen (fanger også foreldreløse opplastinger der
 * estimatet aldri ble lagret) og eventuelle image_url-er som peker et annet sted i bucketen.
 */
export async function purgeEstimateImagesForLeads(
  admin: SupabaseClient,
  leadIds: (string | number)[],
  opts: { dryRun?: boolean } = {},
): Promise<PurgeResult> {
  const ids = [...new Set(leadIds.map(String))].filter((id) => UUID_RE.test(id));
  const result: PurgeResult = { leadIds: ids.length, files: 0, bytes: 0, estimatesCleared: 0, errors: [] };
  if (!ids.length) return result;

  // 1. Estimater med bilde
  const { data: estimates, error: estErr } = await admin
    .from("estimates")
    .select("id, image_url")
    .in("lead_id", ids)
    .not("image_url", "is", null)
    .neq("image_url", "");
  if (estErr) {
    result.errors.push(`estimates: ${estErr.message}`);
    return result;
  }

  // 2. Filer som skal bort
  const paths = new Map<string, number>();
  for (const id of ids) {
    try {
      for (const f of await listLeadFolder(admin, id)) paths.set(f.path, f.size);
    } catch (e) {
      result.errors.push((e as Error).message);
    }
  }
  for (const e of estimates ?? []) {
    const p = pathFromPublicUrl(e.image_url);
    if (p && !paths.has(p)) paths.set(p, 0);
  }

  result.files = paths.size;
  result.bytes = [...paths.values()].reduce((a, b) => a + b, 0);
  const estimateIds = (estimates ?? []).filter((e) => pathFromPublicUrl(e.image_url)).map((e) => e.id);
  result.estimatesCleared = estimateIds.length;
  if (opts.dryRun) return result;

  // 3. Slett fra storage i biter
  const all = [...paths.keys()];
  for (let i = 0; i < all.length; i += REMOVE_CHUNK) {
    const { error } = await admin.storage.from(ESTIMATE_IMAGES_BUCKET).remove(all.slice(i, i + REMOVE_CHUNK));
    if (error) result.errors.push(`remove: ${error.message}`);
  }

  // 4. Fjern døde lenker fra estimatene (bare de som pekte inn i bucketen)
  if (estimateIds.length && !result.errors.length) {
    const { error } = await admin.from("estimates").update({ image_url: null }).in("id", estimateIds);
    if (error) result.errors.push(`estimates update: ${error.message}`);
  }

  return result;
}
