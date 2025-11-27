// src/common/supportedFiles.ts
export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'unknown';

export const EXT_TO_KIND: Record<string, MediaKind> = {
  // images
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  tiff: 'image',
  tif: 'image',
  webp: 'image',
  bmp: 'image',
  heic: 'image', // ✅ NEW

  // video
  mp4: 'video',
  mov: 'video',
  m4v: 'video',
  mkv: 'video',
  avi: 'video',
  webm: 'video',

  // audio
  mp3: 'audio',
  wav: 'audio',
  flac: 'audio',
  m4a: 'audio',
  ogg: 'audio',

  // docs
  pdf: 'document',
  docx: 'document',
  xlsx: 'document',
  pptx: 'document',
  txt: 'document'
};

export function getExt(path: string): string {
  const m = path.split('.').pop();
  return (m || '').toLowerCase();
}

export function getKind(path: string): MediaKind {
  const ext = getExt(path);
  return EXT_TO_KIND[ext] ?? 'unknown';
}

export const FILE_DIALOG_FILTERS = [
  {
    name: 'All Supported',
    extensions: [
      // images
      'jpg','jpeg','png','gif','tiff','tif','webp','bmp','heic', // ✅ includes heic
      // video
      'mp4','mov','m4v','mkv','avi','webm',
      // audio
      'mp3','wav','flac','m4a','ogg',
      // docs
      'pdf','docx','xlsx','pptx','txt'
    ]
  },
  { name: 'Images', extensions: ['jpg','jpeg','png','gif','tiff','tif','webp','bmp','heic'] }, // ✅
  { name: 'Video',  extensions: ['mp4','mov','m4v','mkv','avi','webm'] },
  { name: 'Audio',  extensions: ['mp3','wav','flac','m4a','ogg'] },
  { name: 'Docs',   extensions: ['pdf','docx','xlsx','pptx','txt'] },
  { name: 'All Files', extensions: ['*'] }
];
