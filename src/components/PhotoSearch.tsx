import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImageIcon, LoaderCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { compressImage } from "./PhotoPicker";
import { identifyProductPhoto } from "@/lib/photo-search.functions";

export function PhotoSearch({ onSearch }: { onSearch: (query: string, label: string) => void }) {
  const [open, setOpen] = useState(false);
  const [camera, setCamera] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const nativeCamera = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const identify = useServerFn(identifyProductPhoto);

  const stopCamera = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  useEffect(() => {
    if (!open || !camera) return;
    let cancelled = false;
    setReady(false);
    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("unsupported");
        }
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
      } catch (e) {
        if (cancelled) return;
        stopCamera();
        setCamera(false);
        setError(e instanceof Error && e.name === "NotAllowedError"
          ? "Permissão da câmera negada. Libere a câmera no navegador ou escolha uma foto."
          : "Câmera indisponível. Use a câmera do celular abaixo ou escolha uma foto da galeria.");
      }
    })();
    return () => { cancelled = true; stopCamera(); };
  }, [open, camera]);

  useEffect(() => () => { generation.current += 1; stopCamera(); }, []);

  const prepare = async (file: File | Blob) => {
    const request = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const blob = await compressImage(file instanceof File ? file : new File([file], "produto.jpg", { type: "image/jpeg" }));
      if (blob.size > 550_000) throw new Error("large");
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("image"));
        reader.onerror = () => reject(new Error("image"));
        reader.readAsDataURL(blob);
      });
      if (request !== generation.current) return;
      stopCamera();
      setCamera(false);
      setPreview(image);
    } catch {
      if (request === generation.current) setError("Não foi possível ler esta foto. Escolha outra imagem menor.");
    } finally { if (request === generation.current) setBusy(false); }
  };

  const capture = () => {
    const element = video.current;
    if (!element || !element.videoWidth) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(element.videoWidth, element.videoHeight));
    canvas.width = Math.round(element.videoWidth * scale);
    canvas.height = Math.round(element.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return setError("Não foi possível tirar a foto. Tente a galeria.");
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { if (blob) void prepare(blob); }, "image/jpeg", 0.82);
  };

  const close = (value: boolean) => {
    generation.current += 1;
    stopCamera();
    setOpen(value);
    setCamera(value);
    setPreview(null);
    setError("");
    setBusy(false);
  };

  const search = async () => {
    if (!preview || busy) return;
    const request = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const response = await identify({ data: { image: preview } });
      if (request !== generation.current) return;
      if (response.error || !response.result?.query) {
        setError(response.error ?? "Produto não reconhecido. Tente outra foto com o rótulo visível ou pesquise pelo nome.");
        return;
      }
      close(false);
      onSearch(response.result.query, response.result.label);
    } catch {
      if (request === generation.current) setError("Não foi possível pesquisar agora. Verifique a conexão ou busque pelo nome.");
    } finally { if (request === generation.current) setBusy(false); }
  };

  return (
    <>
      <Button type="button" variant="secondary" className="mt-3" onClick={() => close(true)}>
        <Camera /> Buscar por foto
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg p-4">
          <DialogTitle>Buscar produto por foto</DialogTitle>
          <DialogDescription>A foto será enviada para reconhecimento por IA, sem ser salva no catálogo.</DialogDescription>
          {camera && <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} className="aspect-square w-full rounded-lg bg-foreground object-cover" />}
          {preview && <img src={preview} alt="Foto do produto para pesquisa" className="max-h-64 w-full rounded-lg object-contain" />}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {camera && <Button type="button" disabled={!ready || busy} onClick={capture}><Camera /> Tirar foto</Button>}
          {preview && <Button type="button" disabled={busy} onClick={() => void search()}>
            {busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Search />}
            {busy ? "Reconhecendo produto…" : "Pesquisar esta foto"}
          </Button>}
          <div className="flex flex-wrap gap-2">
            {!camera && <Button type="button" variant="outline" disabled={busy} onClick={() => { setPreview(null); setError(""); setCamera(true); }}><Camera /> {preview ? "Nova foto" : "Abrir câmera"}</Button>}
            {!camera && !preview && <Button type="button" variant="outline" disabled={busy} onClick={() => nativeCamera.current?.click()}><Camera /> Câmera do celular</Button>}
            <Button type="button" variant="outline" disabled={busy} onClick={() => gallery.current?.click()}><ImageIcon /> Galeria</Button>
          </div>
          <input ref={gallery} type="file" accept="image/*" aria-label="Escolher foto para pesquisar" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void prepare(file); e.target.value = ""; }} />
          <input ref={nativeCamera} type="file" accept="image/*" capture="environment" aria-label="Tirar foto para pesquisar" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void prepare(file); e.target.value = ""; }} />
        </DialogContent>
      </Dialog>
    </>
  );
}