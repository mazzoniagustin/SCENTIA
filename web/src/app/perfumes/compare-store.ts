"use client";

import { useSyncExternalStore } from "react";

import { parseSelection, removeItem, serializeSelection, toggleItem, type CompareItem } from "@/lib/compare/selection";

// Store de la selección para comparar. Se guarda en localStorage (persiste entre búsquedas, páginas, recargas y pestañas del
// navegador); si el almacenamiento no está disponible (modo privado, bloqueado) sigue funcionando en memoria durante la sesión.

const STORAGE_KEY = "scentia.compare.v1";
const EMPTY: CompareItem[] = [];

let storageWorks = true;
let memory: CompareItem[] = EMPTY;
let lastRaw: string | null | undefined;
let lastItems: CompareItem[] = EMPTY;
const listeners = new Set<() => void>();

function readItems(): CompareItem[] {
  if (!storageWorks) return memory;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    storageWorks = false;
    return memory;
  }
  // Misma referencia mientras el texto no cambie: useSyncExternalStore compara por identidad.
  if (raw === lastRaw) return lastItems;
  lastRaw = raw;
  lastItems = raw ? parseSelection(raw) : EMPTY;
  return lastItems;
}

function writeItems(items: CompareItem[]) {
  memory = items;
  if (storageWorks) {
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeSelection(items));
    } catch {
      storageWorks = false;
    }
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Cambios hechos desde otra pestaña del navegador.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCompareSelection(): CompareItem[] {
  return useSyncExternalStore(subscribe, readItems, () => EMPTY);
}

export const toggleCompare = (item: CompareItem) => writeItems(toggleItem(readItems(), item));
export const removeCompare = (id: string) => writeItems(removeItem(readItems(), id));
export const clearCompare = () => writeItems(EMPTY);
