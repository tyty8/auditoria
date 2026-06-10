"use client";
import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Icon, Modal } from "@/components/ui";

type ToastFn = (msg: string, icon?: string) => void;

// Share kit for a published questionnaire: copy link, QR code (preview +
// PNG download), and prefilled WhatsApp / email share actions.
export function ShareModal({ open, onClose, url, testName, accent, toast }: {
  open: boolean;
  onClose: () => void;
  url: string;
  testName: string;
  accent?: string;
  toast: ToastFn;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const dark = accent || "#1f8a5b";

  useEffect(() => {
    if (!open || !url) return;
    QRCode.toDataURL(url, {
      width: 480,
      margin: 2,
      color: { dark, light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [open, url, dark]);

  function copyLink() {
    navigator.clipboard?.writeText(url).then(
      () => toast("Enlace copiado", "copy"),
      () => toast("No se pudo copiar", "alert"),
    );
  }

  function downloadQR() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr_${testName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}.png`;
    a.click();
    toast("Código QR descargado", "download");
  }

  const shareText = `Te invito a completar la evaluación «${testName}»: ${url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(`Evaluación: ${testName}`)}&body=${encodeURIComponent(shareText)}`;

  return (
    <Modal open={open} onClose={onClose} title="Compartir cuestionario" sub={testName} width={460}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Link */}
        <div>
          <label className="field-label">Enlace público</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input input-mono"
              value={url}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              style={{ flex: 1, fontSize: 12.5, background: "var(--surface-sunken)" }}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={copyLink}>
              <Icon name="copy" size={14} /> Copiar
            </button>
          </div>
        </div>

        {/* QR */}
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <div style={{ width: 140, height: 140, flex: "none", borderRadius: "var(--r-md)", border: "1px solid var(--line-2)", overflow: "hidden", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`Código QR de ${testName}`} style={{ width: "100%", height: "100%" }} />
            ) : (
              <span style={{ fontSize: 12, color: "var(--ink-4)" }}>Generando…</span>
            )}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0, lineHeight: 1.5 }}>
              Imprime el QR en afiches o mesas para que respondan escaneando con el celular.
            </p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={downloadQR} disabled={!qrDataUrl} style={{ alignSelf: "flex-start" }}>
              <Icon name="download" size={14} /> Descargar PNG
            </button>
          </div>
        </div>

        {/* Quick share */}
        <div>
          <label className="field-label">Compartir directo</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>
              <Icon name="send" size={14} /> WhatsApp
            </a>
            <a href={mailtoUrl} className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>
              <Icon name="send" size={14} /> Email
            </a>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                navigator.clipboard?.writeText(shareText).then(() => toast("Mensaje copiado", "copy"));
              }}
            >
              <Icon name="copy" size={14} /> Copiar mensaje
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
