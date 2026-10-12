import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = { onDetected: (code: string) => void; onClose: () => void };

/** Camera barcode reader (EAN-13, EAN-8, UPC-A, UPC-E). Library is loaded only in the browser. */
export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    const timer = setTimeout(() => setSlow(true), 12_000);

    (async () => {
      if (!window.isSecureContext) {
        return setError("A câmera só funciona em conexão segura (https). Abra o app pelo endereço https ou digite o código.");
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        return setError("Este navegador não permite usar a câmera. Digite o código manualmente.");
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
        const reader = new BrowserMultiFormatReader(hints);
        if (cancelled || !videoRef.current) return;
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current,
          (result) => {
            if (result && !cancelled) {
              cancelled = true;
              controls.stop();
              navigator.vibrate?.(80);
              onDetected(result.getText());
            }
          },
        );
        stop = () => controls.stop();
        if (cancelled) stop();
      } catch (e) {
        const name = (e as { name?: string }).name;
        if (name === "NotAllowedError" || name === "SecurityError")
          setError("Permissão da câmera negada. Libere a câmera nas configurações do navegador ou digite o código.");
        else if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError")
          setError("Câmera indisponível neste aparelho (ou em uso por outro app). Digite o código manualmente.");
        else setError("Não foi possível abrir a câmera. Digite o código manualmente.");
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stop?.(); // releases the camera
    };
  }, [onDetected]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Leitor de código de barras" className="fixed inset-0 z-50 flex flex-col bg-foreground/90 p-4">
      <div className="mx-auto flex w-full max-w-md items-center justify-between text-background">
        <p className="font-bold">Escanear código de barras</p>
        <button type="button" onClick={onClose} aria-label="Fechar leitor" className="grid h-10 w-10 place-items-center rounded-full bg-background/20">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mx-auto mt-4 w-full max-w-md">
        {error ? (
          <p className="rounded-xl bg-card p-4 text-sm text-foreground">{error}</p>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-foreground">
            <video ref={videoRef} className="aspect-[3/4] w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-success" />
          </div>
        )}
        {!error && (
          <p className="mt-3 text-center text-sm text-background">
            {slow
              ? "Código não reconhecido ainda. Aproxime o produto, melhore a iluminação ou feche e digite o código."
              : "Aponte a câmera para o código de barras."}
          </p>
        )}
        <button type="button" onClick={onClose} className="mt-4 h-11 w-full rounded-xl bg-card font-semibold text-foreground">
          {error ? "Digitar o código" : "Encerrar leitor"}
        </button>
      </div>
    </div>
  );
}
