"use client";

import { startTransition, useActionState, useRef, useState } from "react";

import { createPrivatePerfumeAction, updatePrivatePerfumeAction } from "@/app/actions/private-perfumes";
import { IDLE_STATE } from "@/lib/collection/form";
import { LONGEVITY_LABELS, SILLAGE_LABELS } from "@/lib/community";
import { ACCEPT_ATTRIBUTE } from "@/lib/private-perfumes/photo-client";
import { processAndUploadPhoto } from "@/lib/private-perfumes/photo-upload";
import { ACCORDS_MAX, BRAND_MAX, DESCRIPTION_MAX, NAME_MAX, NAME_MIN, PERFUMER_MAX } from "@/lib/private-perfumes/validation";

export type PrivatePerfumeFormInitial = {
  id: string;
  name: string;
  brand: string;
  perfumer: string | null;
  gender: string;
  description: string | null;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  longevity: number | null;
  sillage: number | null;
  accordIds: string[];
  entry: { status: string; rating: number | null; personalNotes: string | null };
  /** URL firmada de la foto actual (solo para la vista previa). */
  photoUrl: string | null;
};

const joinNotes = (notes: string[] | undefined) => (notes ?? []).join(", ");

// Alta y edición de un perfume propio. La foto se achica y se sube apenas se elige (el servidor solo recibe su ruta); el resto
// viaja al guardar. El envío se hace en `onSubmit` (no con `action={...}`) para que React no reinicie el formulario y lo escrito
// se conserve si el guardado falla, igual que en `CollectionForm`.
export function PrivatePerfumeForm({ accords, initial }: { accords: Array<{ id: string; name: string }>; initial?: PrivatePerfumeFormInitial }) {
  const editing = Boolean(initial);
  const [state, formAction, pending] = useActionState(editing ? updatePrivatePerfumeAction : createPrivatePerfumeAction, IDLE_STATE);

  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [perfumer, setPerfumer] = useState(initial?.perfumer ?? "");
  const [gender, setGender] = useState(initial?.gender ?? "unisex");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [topNotes, setTopNotes] = useState(joinNotes(initial?.topNotes));
  const [heartNotes, setHeartNotes] = useState(joinNotes(initial?.heartNotes));
  const [baseNotes, setBaseNotes] = useState(joinNotes(initial?.baseNotes));
  const [accordIds, setAccordIds] = useState<string[]>(initial?.accordIds ?? []);
  const [longevity, setLongevity] = useState(initial?.longevity ? String(initial.longevity) : "");
  const [sillage, setSillage] = useState(initial?.sillage ? String(initial.sillage) : "");
  const [status, setStatus] = useState(initial?.entry.status ?? "OWNED");
  const [rating, setRating] = useState(initial?.entry.rating ? String(initial.entry.rating) : "");
  const [personalNotes, setPersonalNotes] = useState(initial?.entry.personalNotes ?? "");

  const [photo, setPhoto] = useState<{ path: string; previewUrl: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrl = photo?.previewUrl ?? initial?.photoUrl ?? null;

  async function onPickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    setPhotoError("");
    setUploading(true);
    const result = await processAndUploadPhoto(file);
    setUploading(false);
    if (result.ok) setPhoto({ path: result.path, previewUrl: result.previewUrl });
    else setPhotoError(result.message);
  }

  function toggleAccord(id: string, checked: boolean) {
    setAccordIds((current) => (checked ? [...current, id] : current.filter((value) => value !== id)));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uploading) return;
    if (!previewUrl) {
      setPhotoError("Elegí una foto del perfume.");
      fileRef.current?.focus();
      return;
    }
    const data = new FormData(event.currentTarget);
    if (photo) data.set("photoPath", photo.path);
    if (initial) data.set("perfumeId", initial.id);
    startTransition(() => formAction(data));
  }

  const atLimit = accordIds.length >= ACCORDS_MAX;

  return (
    <form className="collection-form private-form" onSubmit={onSubmit} noValidate={false}>
      <fieldset className="private-form-section">
        <legend>Foto</legend>
        <div className="private-photo">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob) o URL firmada de Storage
            <img src={previewUrl} alt="Vista previa de la foto del perfume" width={240} height={300} className="private-photo-preview" />
          ) : (
            <div className="private-photo-empty" aria-hidden="true">
              Sin foto
            </div>
          )}
          <div className="private-photo-controls">
            <label className="button button-ghost private-photo-button">
              {previewUrl ? "Cambiar foto" : "Elegir foto (obligatoria)"}
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                accept={ACCEPT_ATTRIBUTE}
                onChange={onPickPhoto}
                aria-describedby="private-photo-help private-photo-status"
                aria-invalid={photoError ? true : undefined}
              />
            </label>
            <p id="private-photo-help" className="form-hint">
              JPG, PNG o WebP de hasta 10 MB. Se achica antes de subirla y solo la ves vos.
            </p>
            <p id="private-photo-status" className={photoError ? "form-message form-message-error" : "form-message"} role={photoError ? "alert" : "status"}>
              {uploading ? "Subiendo foto…" : photoError}
            </p>
          </div>
        </div>
      </fieldset>

      <label>
        <span className="collection-label">Nombre (obligatorio)</span>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={NAME_MIN} maxLength={NAME_MAX} autoComplete="off" />
      </label>

      <details className="private-form-section" open={editing}>
        <summary>Más datos (opcional)</summary>
        <div className="private-form-fields">
        <label>
          <span className="collection-label">Marca</span>
          <input name="brand" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={BRAND_MAX} autoComplete="off" />
        </label>
        <label>
          <span className="collection-label">Perfumista</span>
          <input name="perfumer" value={perfumer} onChange={(e) => setPerfumer(e.target.value)} maxLength={PERFUMER_MAX} autoComplete="off" />
        </label>
        <label>
          <span className="collection-label">Para</span>
          <select name="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="unisex">Unisex</option>
            <option value="femenino">Mujeres</option>
            <option value="masculino">Hombres</option>
          </select>
        </label>
        <label>
          <span className="collection-label">Descripción</span>
          <textarea name="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={DESCRIPTION_MAX} />
        </label>
        </div>
      </details>

      <details className="private-form-section" open={editing}>
        <summary>Notas (opcional)</summary>
        <div className="private-form-fields">
        <p className="form-hint">Escribilas separadas por coma, por ejemplo: bergamota, limón.</p>
        <label>
          <span className="collection-label">Notas de salida</span>
          <input name="topNotes" value={topNotes} onChange={(e) => setTopNotes(e.target.value)} autoComplete="off" />
        </label>
        <label>
          <span className="collection-label">Notas de corazón</span>
          <input name="heartNotes" value={heartNotes} onChange={(e) => setHeartNotes(e.target.value)} autoComplete="off" />
        </label>
        <label>
          <span className="collection-label">Notas de fondo</span>
          <input name="baseNotes" value={baseNotes} onChange={(e) => setBaseNotes(e.target.value)} autoComplete="off" />
        </label>
        </div>
      </details>

      <details className="private-form-section" open={editing}>
        <summary>Acordes, duración y estela (opcional)</summary>
        <div className="private-form-fields">
        <fieldset className="private-accords">
          <legend>Acordes</legend>
          <p id="private-accords-help" className="form-hint">
            Elegí hasta {ACCORDS_MAX}. Con al menos uno, este perfume entra en “¿Qué me pongo hoy?” y en tus huecos.
          </p>
          <p className="accord-count" aria-live="polite">
            {accordIds.length} de {ACCORDS_MAX} elegidos
          </p>
          <ul className="accord-picker" aria-describedby="private-accords-help">
            {accords.map((accord) => {
              const checked = accordIds.includes(accord.id);
              return (
                <li key={accord.id}>
                  <label className="accord-chip">
                    <input
                      className="sr-only"
                      type="checkbox"
                      name="accordIds"
                      value={accord.id}
                      checked={checked}
                      disabled={!checked && atLimit}
                      onChange={(e) => toggleAccord(accord.id, e.target.checked)}
                    />
                    <span>{accord.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
        <label>
          <span className="collection-label">Duración</span>
          <select name="longevity" value={longevity} onChange={(e) => setLongevity(e.target.value)}>
            <option value="">Sin dato</option>
            {LONGEVITY_LABELS.map((label, i) => (
              <option key={label} value={i + 1}>
                {i + 1} · {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="collection-label">Estela (qué tanto se nota a tu alrededor)</span>
          <select name="sillage" value={sillage} onChange={(e) => setSillage(e.target.value)}>
            <option value="">Sin dato</option>
            {SILLAGE_LABELS.map((label, i) => (
              <option key={label} value={i + 1}>
                {i + 1} · {label}
              </option>
            ))}
          </select>
        </label>
        </div>
      </details>

      <fieldset className="private-form-section">
        <legend>En tu colección</legend>
        <div className="private-form-fields">
        <label>
          <span className="collection-label">Estado</span>
          <select name="status" aria-label="Estado en tu colección" value={status} onChange={(e) => setStatus(e.target.value)} required>
            <option value="OWNED">Lo tengo</option>
            <option value="DECANT">Tengo un decant</option>
            <option value="SAMPLED">Probé una muestra</option>
            <option value="WISHLIST">Lo quiero</option>
            <option value="DISLIKED">No me gustó</option>
          </select>
        </label>
        <label>
          <span className="collection-label">Puntuación (opcional)</span>
          <select name="rating" aria-label="Puntuación de 1 a 5" value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="">Sin puntuar</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} de 5
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="collection-label">Notas personales (opcional)</span>
          <textarea name="personalNotes" maxLength={2000} value={personalNotes} onChange={(e) => setPersonalNotes(e.target.value)} placeholder="Cómo te queda, cuándo lo usás…" />
        </label>
        </div>
      </fieldset>

      <button type="submit" aria-disabled={pending || uploading}>
        {pending ? "Guardando…" : uploading ? "Subiendo foto…" : editing ? "Guardar cambios" : "Guardar perfume"}
      </button>
      <p className={state.status === "error" ? "form-message form-message-error" : "form-message"} role={state.status === "error" ? "alert" : "status"} aria-live="polite">
        {state.status === "idle" ? "" : state.message}
      </p>
    </form>
  );
}
