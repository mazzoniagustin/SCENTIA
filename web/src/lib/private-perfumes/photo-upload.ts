"use client";

// Procesamiento y subida de la foto en el navegador: se achica con un canvas, se convierte a WebP (o JPEG si el navegador no puede) y se sube directo a Storage
// con el token de un solo uso que entrega el servidor (no pasa por las funciones de Vercel).

import { requestPhotoUploadAction } from "@/app/actions/private-perfumes";
import { createClient } from "@/lib/supabase/client";

import { PHOTO_BUCKET, type PhotoExtension } from "./photo";
import { acceptPhotoFile, fitWithin, MAX_SIDE, WEBP_QUALITY } from "./photo-client";

export type UploadedPhoto = { path: string; previewUrl: string };
export type UploadResult = ({ ok: true } & UploadedPhoto) | { ok: false; message: string };

type EncodedPhoto = { blob: Blob; extension: PhotoExtension; contentType: string };

// Safari en iOS no codifica WebP en un canvas: `toBlob` devuelve un PNG en su lugar. En ese caso se vuelve a codificar como JPEG.
// Decodifica con createImageBitmap y, si el navegador no puede (o no existe), con un <img>: los dos respetan la orientación EXIF.
async function decodePhoto(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => {} };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function compressPhoto(file: File): Promise<EncodedPhoto> {
  const bitmap = await decodePhoto(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    context.drawImage(bitmap.source, 0, 0, width, height);
    const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, WEBP_QUALITY));
    const webp = await encode("image/webp");
    if (webp?.type === "image/webp") return { blob: webp, extension: "webp", contentType: "image/webp" };
    const jpeg = await encode("image/jpeg");
    if (jpeg?.type === "image/jpeg") return { blob: jpeg, extension: "jpg", contentType: "image/jpeg" };
    throw new Error("encode");
  } finally {
    bitmap.close();
  }
}

/** Achica la foto y la sube. Devuelve la ruta guardada y una vista previa local; nunca lanza. */
export async function processAndUploadPhoto(file: File): Promise<UploadResult> {
  const accepted = acceptPhotoFile(file);
  if (!accepted.ok) return accepted;

  let encoded: EncodedPhoto;
  try {
    encoded = await compressPhoto(file);
  } catch {
    return { ok: false, message: "No pudimos leer esa foto. Probá con otra en JPG o PNG, o sacala de nuevo." };
  }

  const target = await requestPhotoUploadAction(encoded.extension);
  if (!target.ok) return target;

  const { error } = await createClient().storage.from(PHOTO_BUCKET).uploadToSignedUrl(target.path, target.token, encoded.blob, { contentType: encoded.contentType });
  if (error) return { ok: false, message: "No pudimos subir la foto. Probá de nuevo." };
  return { ok: true, path: target.path, previewUrl: URL.createObjectURL(encoded.blob) };
}
