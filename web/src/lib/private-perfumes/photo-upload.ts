"use client";

// Procesamiento y subida de la foto en el navegador: se achica con un canvas, se convierte a WebP y se sube directo a Storage
// con el token de un solo uso que entrega el servidor (no pasa por las funciones de Vercel).

import { requestPhotoUploadAction } from "@/app/actions/private-perfumes";
import { createClient } from "@/lib/supabase/client";

import { PHOTO_BUCKET } from "./photo";
import { acceptPhotoFile, fitWithin, MAX_SIDE, WEBP_QUALITY } from "./photo-client";

export type UploadedPhoto = { path: string; previewUrl: string };
export type UploadResult = ({ ok: true } & UploadedPhoto) | { ok: false; message: string };

async function compressToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    if (!blob || blob.type !== "image/webp") throw new Error("webp");
    return blob;
  } finally {
    bitmap.close();
  }
}

/** Achica la foto y la sube. Devuelve la ruta guardada y una vista previa local; nunca lanza. */
export async function processAndUploadPhoto(file: File): Promise<UploadResult> {
  const accepted = acceptPhotoFile(file);
  if (!accepted.ok) return accepted;

  let blob: Blob;
  try {
    blob = await compressToWebp(file);
  } catch {
    return { ok: false, message: "Tu navegador no pudo leer esa foto. Probá con otra en JPG o PNG." };
  }

  const target = await requestPhotoUploadAction();
  if (!target.ok) return target;

  const { error } = await createClient().storage.from(PHOTO_BUCKET).uploadToSignedUrl(target.path, target.token, blob, { contentType: "image/webp" });
  if (error) return { ok: false, message: "No pudimos subir la foto. Probá de nuevo." };
  return { ok: true, path: target.path, previewUrl: URL.createObjectURL(blob) };
}
