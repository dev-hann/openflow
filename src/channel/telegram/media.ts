export interface MediaInfo {
  type: "photo" | "document" | "voice" | "video" | "sticker" | "animation" | "video_note";
  fileId: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
  caption?: string;
}

export function formatMediaDescription(media: MediaInfo): string {
  const parts: string[] = [`[User sent ${media.type}]`];

  if (media.caption) parts.push(`Caption: ${media.caption}`);
  if (media.fileName) parts.push(`File: ${media.fileName}`);
  if (media.mimeType) parts.push(`Type: ${media.mimeType}`);
  if (media.fileSize) {
    const kb = Math.round(media.fileSize / 1024);
    parts.push(`Size: ${kb > 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${kb}KB`}`);
  }
  if (media.width && media.height) parts.push(`Dimensions: ${media.width}x${media.height}`);
  if (media.duration) parts.push(`Duration: ${Math.round(media.duration)}s`);

  return parts.join("\n");
}

export function extractPhotoMedia(ctx: { msg?: { photo?: Array<{ file_id: string; file_size?: number; width?: number; height?: number }>; caption?: string } | null }): MediaInfo | null {
  const photos = ctx.msg?.photo;
  if (!photos || photos.length === 0) return null;
  const largest = photos[photos.length - 1]!;
  return {
    type: "photo",
    fileId: largest.file_id,
    fileSize: largest.file_size,
    width: largest.width,
    height: largest.height,
    caption: ctx.msg?.caption ?? undefined,
  };
}

export function extractDocumentMedia(ctx: { msg?: { document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number } | null; caption?: string } | null }): MediaInfo | null {
  const doc = ctx.msg?.document;
  if (!doc) return null;
  return {
    type: "document",
    fileId: doc.file_id,
    fileName: doc.file_name ?? undefined,
    mimeType: doc.mime_type ?? undefined,
    fileSize: doc.file_size ?? undefined,
    caption: ctx.msg?.caption ?? undefined,
  };
}

export function extractVoiceMedia(ctx: { msg?: { voice?: { file_id: string; file_size?: number; duration?: number; mime_type?: string } | null; caption?: string } | null }): MediaInfo | null {
  const voice = ctx.msg?.voice;
  if (!voice) return null;
  return {
    type: "voice",
    fileId: voice.file_id,
    fileSize: voice.file_size ?? undefined,
    duration: voice.duration ?? undefined,
    mimeType: voice.mime_type ?? undefined,
    caption: ctx.msg?.caption ?? undefined,
  };
}

export function extractVideoMedia(ctx: { msg?: { video?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number; width?: number; height?: number; duration?: number } | null; caption?: string } | null }): MediaInfo | null {
  const video = ctx.msg?.video;
  if (!video) return null;
  return {
    type: "video",
    fileId: video.file_id,
    fileName: video.file_name ?? undefined,
    mimeType: video.mime_type ?? undefined,
    fileSize: video.file_size ?? undefined,
    width: video.width ?? undefined,
    height: video.height ?? undefined,
    duration: video.duration ?? undefined,
    caption: ctx.msg?.caption ?? undefined,
  };
}

export function extractStickerMedia(ctx: { msg?: { sticker?: { file_id: string; width?: number; height?: number; emoji?: string } | null } | null }): MediaInfo | null {
  const sticker = ctx.msg?.sticker;
  if (!sticker) return null;
  return {
    type: "sticker",
    fileId: sticker.file_id,
    width: sticker.width ?? undefined,
    height: sticker.height ?? undefined,
  };
}
