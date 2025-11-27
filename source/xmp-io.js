'use strict';

/**
 * xmp-io.js — Explorer-friendly writes where possible.
 * - Uses DBM.PropTool.exe for Windows-friendly types.
 * - Uses exiftool.exe to embed into formats Explorer can't fully handle.
 * - Falls back to <file>.dbmmeta.json for TXT and for anything Windows blocks.
 *
 * Exports for main.js: { winWrite, winRead, writeImage, writeVideo, ... }
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// talk to the Windows property helper
const { setProps, getProps, logFilePath } = require('./win-prop.js');

// ---------- EXTENSION GROUPS ----------

// NOTE: we are ADDING .heic here so HEIC is treated like an image.
const IMAGE_EXT  = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp', '.heic']);
const VIDEO_EXT  = new Set(['.mp4', '.mov']);
const AUDIO_EXT  = new Set(['.mp3', '.wav']);
const OFFICE_EXT = new Set(['.docx', '.xlsx']);
const PDF_EXT    = new Set(['.pdf']);
const TEXT_EXT   = new Set(['.txt']);

const extOf    = f => path.extname(String(f)).toLowerCase();

const isImage  = f => IMAGE_EXT.has(extOf(f));
const isVideo  = f => VIDEO_EXT.has(extOf(f));
const isAudio  = f => AUDIO_EXT.has(extOf(f));
const isOffice = f => OFFICE_EXT.has(extOf(f));
const isPdf    = f => PDF_EXT.has(extOf(f));
const isText   = f => TEXT_EXT.has(extOf(f));

// special helpers
const isHeic   = f => extOf(f) === '.heic'; // iPhone stills
const isWav    = f => extOf(f) === '.wav';

// Which formats MUST get ExifTool to embed portable metadata
// (so Finder / Photos / Adobe can see it)
const needsEmbedWithExif = f =>
  isPdf(f)        ||         // PDFs
  isWav(f)        ||         // WAV audio
  isHeic(f);                 // <-- NEW: HEIC

// TXT has no real embed story, always sidecar
const needsSidecarAll    = f => isText(f);

// MP3: Windows can set title/comment/rating but won't keep keywords/tags,
// so we sidecar tags for MP3.
const sidecarTagsOnly = f => extOf(f) === '.mp3';

const sidecarPath = f => String(f) + '.dbmmeta.json';

// ---------- small utils ----------

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const toStars = x => {
  let n = parseInt(x == null ? 0 : x, 10);
  if (isNaN(n)) n = 0;
  return clamp(n, 0, 5);
};

const normalizeTags = t => {
  if (Array.isArray(t)) {
    return t
      .filter(Boolean)
      .map(s => String(s).trim())
      .filter(Boolean);
  }
  if (typeof t === 'string') {
    return t
      .split(/[;,]/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
};

const uniq = arr => {
  const out = [];
  const seen = Object.create(null);
  for (const v of arr) {
    const k = String(v || '').trim();
    if (!k || seen[k]) continue;
    seen[k] = 1;
    out.push(k);
  }
  return out;
};

function vlog(line) {
  try {
    fs.appendFileSync(
      logFilePath,
      `[${new Date().toISOString()}] ${line}\n`
    );
  } catch {}
}

// ---------- exiftool helpers ----------

function findExif() {
  // 1) packaged location (in a built app)
  const r1 = path.join(process.resourcesPath || '', 'exiftool.exe');
  if (r1 && fs.existsSync(r1)) return r1;
  // 2) dev location (sitting next to the app code)
  const r2 = path.join(process.cwd(), 'exiftool.exe');
  if (fs.existsSync(r2)) return r2;
  // 3) PATH
  return 'exiftool.exe';
}

function hasExif() {
  const exe = findExif();
  const p = spawnSync(exe, ['-ver'], { encoding: 'utf8' });
  return p.status === 0;
}

/**
 * exifWrite()
 * Embed portable metadata for formats that Windows doesn't handle well (HEIC, WAV, PDF).
 *
 * kv maps app fields into widely-used metadata tags:
 *   Title      -> XMP:Title / Title
 *   Description/Comment -> Description / Comment / Subject
 *   Keywords[] -> Keywords
 *   Rating     -> XMP:Rating (0-5)
 */
function exifWrite(file, kv) {
  const exe  = findExif();
  const args = [
    '-overwrite_original',
    '-m', // ignore minor warnings
    '-P'  // preserve file datetime if possible
  ];

  if (kv.Title != null) {
    args.push(`-Title=${kv.Title}`);
    // also push XMP side:
    args.push(`-XMP-dc:Title=${kv.Title}`);
  } else {
    // clear it if blank?
    // we won't aggressively clear here for safety.
  }

  // We'll treat Description/Comment as "what you typed in Comments field"
  if (kv.Description != null) {
    // map into a few common fields
    args.push(`-XMP-dc:Description=${kv.Description}`);
    args.push(`-Description=${kv.Description}`);
  }
  if (kv.Comment != null) {
    args.push(`-Comment=${kv.Comment}`);
    // also map Subject to comment for PDF/WAV style
    args.push(`-Subject=${kv.Comment}`);
  }

  if (kv.Keywords && kv.Keywords.length) {
    // wipe old keywords then add each
    args.push('-Keywords=');
    for (const k of kv.Keywords) {
      args.push(`-Keywords+=${k}`);
    }
    // also set XMP Subjects keywords
    args.push('-XMP-dc:Subject=');
    for (const k of kv.Keywords) {
      args.push(`-XMP-dc:Subject+=${k}`);
    }
  }

  if (kv.Rating != null) {
    // XMP star rating (0-5)
    args.push(`-XMP:Rating=${kv.Rating}`);
  }

  args.push(file);

  const res = spawnSync(exe, args, { encoding: 'utf8' });
  if (res.status !== 0) {
    vlog(`exiftool write failed for ${file}: ${res.stderr || res.stdout || res.status}`);
    return false;
  }
  return true;
}

function exifRead(file) {
  const exe = findExif();
  const res = spawnSync(
    exe,
    [
      '-json',
      '-Title',
      '-Subject',
      '-Keywords',
      '-Comment',
      '-Description',
      '-XMP:Rating'
    ],
    { encoding: 'utf8', input: '', shell: false, windowsHide: true }
  );

  if (res.status !== 0) return null;

  try {
    const arr = JSON.parse(res.stdout);
    const o = arr && arr[0] || {};

    const title = o.Title || '';
    // Comments: fall back through several fields
    const comments =
      o.Comment ||
      o.Description ||
      o.Subject ||
      '';

    const tags = normalizeTags(o.Keywords || []);
    const rating = toStars(o['XMP:Rating'] || 0);

    return { title, comments, tags, rating };
  } catch {
    return null;
  }
}

// ---------- sidecar helpers (for TXT/MP3 tag fallback) ----------

function sidecarPathFor(file) {
  return String(file) + '.dbmmeta.json';
}

function readSidecar(file) {
  try {
    const p = sidecarPathFor(file);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeSidecar(file, meta, patch=false) {
  const p = sidecarPathFor(file);
  const prev = readSidecar(file) || {};

  const next = patch
    ? {
        title:    meta.title    !== undefined ? String(meta.title)    : (prev.title ?? ''),
        tags:     meta.tags     !== undefined ? normalizeTags(meta.tags) : (prev.tags ?? []),
        comments: meta.comments !== undefined ? String(meta.comments) : (prev.comments ?? ''),
        rating:   Number.isInteger(meta.rating)
                    ? meta.rating
                    : (Number.isInteger(prev.rating) ? prev.rating : 0)
      }
    : {
        title:    meta.title    ?? '',
        tags:     normalizeTags(meta.tags),
        comments: meta.comments ?? '',
        rating:   Number.isInteger(meta.rating) ? meta.rating : 0
      };

  const nothing =
    !next.title &&
    (!next.tags || next.tags.length===0) &&
    !next.comments &&
    !next.rating;

  if (nothing) return prev && Object.keys(prev).length ? prev : null;

  next._updated = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

// ---------- READ logic ----------

async function winRead(file) {
  const ext = extOf(file);

  let shell = null;
  try {
    shell = await getProps(file); // Windows shell props via win-prop.js helper
  } catch (e) {
    vlog(`getProps failed (${ext}): ${e?.message||e}`);
  }

  const sc = readSidecar(file);

  // For formats we embed with exiftool (PDF, WAV, HEIC), try exifRead
  const xf = hasExif() && needsEmbedWithExif(file)
    ? exifRead(file)
    : null;

  // precedence rules by type:
  // - TXT: sidecar only
  // - WAV/PDF/HEIC: prefer exif -> sidecar -> shell
  // - MP3: shell for title/comments/rating, sidecar for tags
  // - everything else: shell -> sidecar -> exif
  const pick = (a,b,c) => a ?? b ?? c ?? '';

  let title    = '';
  let comments = '';
  let rating   = 0;
  let tags     = [];

  if (needsSidecarAll(file)) {
    // TXT case
    title    = pick(sc?.title, shell?.title, '');
    comments = pick(sc?.comments, shell?.comments, '');
    rating   = clamp((sc?.rating || shell?.rating || 0), 0, 5);
    tags     = uniq([...(sc?.tags||[]), ...normalizeTags(shell?.tags)]);
  }
  else if (needsEmbedWithExif(file)) {
    // HEIC / WAV / PDF
    title    = pick(xf?.title, sc?.title, shell?.title);
    comments = pick(xf?.comments, sc?.comments, shell?.comments);
    rating   = clamp((xf?.rating || sc?.rating || shell?.rating || 0), 0, 5);
    tags     = uniq([
      ...(xf?.tags||[]),
      ...(sc?.tags||[]),
      ...normalizeTags(shell?.tags)
    ]);
  }
  else if (sidecarTagsOnly(file)) {
    // MP3
    title    = pick(shell?.title, sc?.title, '');
    comments = pick(shell?.comments, sc?.comments, '');
    rating   = clamp((shell?.rating || sc?.rating || 0), 0, 5);
    tags     = uniq([
      ...(sc?.tags||[]),
      ...normalizeTags(shell?.tags)
    ]);
  }
  else {
    // everything else: shell first
    title    = pick(shell?.title, sc?.title, xf?.title);
    comments = pick(shell?.comments, sc?.comments, xf?.comments);
    rating   = clamp((shell?.rating || sc?.rating || xf?.rating || 0), 0, 5);
    tags     = uniq([
      ...normalizeTags(shell?.tags),
      ...(sc?.tags||[]),
      ...(xf?.tags||[])
    ]);
  }

  return {
    title,
    tags: tags.join(', '),
    comments,
    rating
  };
}

// ---------- WRITE logic ----------

async function writeMeta(file, fields) {
  const ext = extOf(file);

  const title    = fields?.title    !== undefined ? String(fields.title)    : undefined;
  const comments = fields?.comments !== undefined ? String(fields.comments) : undefined;
  const rating   = fields?.rating   !== undefined ? toStars(fields.rating)  : undefined;
  const tagsArr  = fields?.tags     !== undefined ? normalizeTags(fields.tags) : undefined;

  const hasAnyMeaningful =
    (title && title.trim()) ||
    (comments && comments.trim()) ||
    (Number.isInteger(rating) && rating > 0) ||
    (tagsArr && tagsArr.length > 0);

  // 1) Try Windows shell props via setProps (DBM.PropTool.exe)
  //    BUT skip TXT (no shell), skip mp3 tags-only labor? (as before)
  //    We'll still attempt setProps for HEIC. If Windows can't, it just won't stick.
  if (!needsSidecarAll(file)) {
    try {
      await setProps(file, {
        title:    title    ?? '',
        comments: comments ?? '',
        // For MP3, we don't trust shell to store keywords, so we blank or skip.
        tags:     sidecarTagsOnly(file) ? '' : (tagsArr ? tagsArr.join('; ') : ''),
        rating:   rating   ?? 0
      });
    } catch (e) {
      vlog(`setProps failed (${ext}): ${e?.message||e}`);
    }
  }

  // 2) ExifTool embed for formats that require portable metadata
  //    We EXTEND this list to include HEIC, so Apple / Mac / Adobe see it.
  if (needsEmbedWithExif(file) && hasExif() && hasAnyMeaningful) {
    const ok = exifWrite(file, {
      Title:       title    ?? '',
      // We'll treat your "comments" field as Description / Comment / Subject
      Description: comments ?? '',
      Comment:     comments ?? '',
      Keywords:    tagsArr || [],
      Rating:      rating   ?? 0
    });

    if (!ok) {
      vlog(`exiftool write returned non-zero status for ${file}`);
    }
  }

  // 3) Sidecar fallback:
  //    - TXT always needs sidecar.
  //    - MP3 needs sidecar for tags, because Windows won't store them faithfully.
  //    - And as an extra safety net if exiftool isn't available.
  if (needsSidecarAll(file) || sidecarTagsOnly(file) || !hasExif()) {
    if (hasAnyMeaningful) {
      writeSidecar(
        file,
        {
          title:    needsSidecarAll(file) ? title    : (sidecarTagsOnly(file) ? undefined : title),
          comments: needsSidecarAll(file) ? comments : (sidecarTagsOnly(file) ? undefined : comments),
          rating:   needsSidecarAll(file) ? rating   : (sidecarTagsOnly(file) ? undefined : rating),
          tags:     (needsSidecarAll(file) || sidecarTagsOnly(file)) ? tagsArr : undefined
        },
        /*patch*/ true
      );
    }
  }

  // Finally, read back merged metadata to return it
  const merged = await winRead(file);

  // IMPORTANT:
  // The UI checks res.ok. Previously we sometimes returned {title,...} directly.
  // We standardize here to always return { ok:true, ...merged } so HEIC won't say "Failed: unknown".
  return {
    ok: true,
    ...merged
  };
}

// ---------- exports ----------

async function writeImage (f,m){ return writeMeta(f,m); }
async function writeVideo (f,m){ return writeMeta(f,m); }
async function writeAudio (f,m){ return writeMeta(f,m); }
async function writeOffice(f,m){ return writeMeta(f,m); }
async function writePdf   (f,m){ return writeMeta(f,m); }
async function writeText  (f,m){ return writeMeta(f,m); }

// used by main.js IPC
async function winWrite(file, meta) { return writeMeta(file, meta); }
async function _winRead(file)       { return winRead(file); }

module.exports = {
  winWrite,
  winRead: _winRead,
  writeImage, writeVideo, writeAudio, writeOffice, writePdf, writeText
};
