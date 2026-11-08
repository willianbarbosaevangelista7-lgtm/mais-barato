import { useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useImageUrl } from "@/lib/catalog-cloud";
import { compressProductImage, isSupportedProductImage } from "@/lib/image-optimization";

export type PhotoState = { path?: string | undefined; pending?: Blob | undefined; removed?: boolean | undefined };

export function PhotoPicker({ value, onChange, disabled }: { value: PhotoState; onChange: (v: PhotoState) => void; disabled?: boolean | undefined }) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Blob | null>(null);
  const savedUrl = useImageUrl(value.removed ? undefined : value.path);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const shown = draft ?? value.pending ?? null;

  useEffect(() => {
    if (!shown) return setBlobUrl(null);
    const u = URL.createObjectURL(shown);
    setBlobUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [shown]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!isSupportedProductImage(f)) return void toast.error("Use uma imagem JPG, PNG ou WebP.");
    try {
      setDraft(await compressProductImage(f));
    } catch {
      toast.error("Não foi possível ler esta imagem. Tente outra foto.");
    }
  };

  const url = blobUrl ?? (value.removed ? null : savedUrl);
  const has = !!(value.pending || (value.path && !value.removed));
  const btn = "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted";

  return (
    <div className="rounded-xl border border-dashed border-border p-3">
      <p className="text-xs font-semibold text-muted-foreground">Foto do produto (opcional)</p>
      {url && (
        <img src={url} alt="Prévia da foto do produto" className="mx-auto mt-2 max-h-48 w-auto rounded-lg object-contain" />
      )}
      {disabled ? null : draft ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" className={btn} onClick={() => setDraft(null)}>Cancelar</button>
          <button
            type="button"
            className="h-10 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
            onClick={() => { onChange({ ...value, pending: draft, removed: false }); setDraft(null); toast.success(`Foto pronta (${Math.round(draft.size / 1024)} KB). Salve o produto para enviar.`); }}
          >
            Confirmar foto
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => camRef.current?.click()}><Camera className="h-4 w-4" />{has ? "Nova foto" : "Tirar foto"}</button>
          <button type="button" className={btn} onClick={() => galRef.current?.click()}><ImageIcon className="h-4 w-4" />Escolher da galeria</button>
          {has && (
            <button type="button" aria-label="Remover foto" className="grid h-10 w-10 place-items-center rounded-xl border border-border text-destructive" onClick={() => onChange({ ...value, pending: undefined, removed: true })}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
