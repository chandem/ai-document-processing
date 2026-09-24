import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import CameraswitchOutlinedIcon from "@mui/icons-material/CameraswitchOutlined";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
};

type Page = {
  blob: Blob;
  url: string;
  width: number;
  height: number;
};

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Builds a small standards-compliant PDF directly in the browser.
 * This avoids adding a heavy PDF dependency just for multi-page camera scans.
 */
async function pagesToPdf(pages: Page[]): Promise<Blob> {
  const encoder = new TextEncoder();
  const finalObjects: Uint8Array[] = [
    encoder.encode("<< /Type /Catalog /Pages 2 0 R >>"),
  ];

  const pageObjectNums: number[] = [];
  const contentObjectNums: number[] = [];
  const imageObjectNums: number[] = [];

  let next = 3;
  for (let i = 0; i < pages.length; i++) {
    pageObjectNums.push(next++);
    contentObjectNums.push(next++);
    imageObjectNums.push(next++);
  }

  finalObjects.push(
    encoder.encode(
      `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNums.map((n) => `${n} 0 R`).join(" ")}] >>`,
    ),
  );

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const content = `q ${page.width} 0 0 ${page.height} 0 0 cm /Im0 Do Q`;

    finalObjects.push(
      encoder.encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /Im0 ${imageObjectNums[i]} 0 R >> >> /Contents ${contentObjectNums[i]} 0 R >>`,
      ),
    );
    finalObjects.push(
      encoder.encode(
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      ),
    );

    const bytes = await blobToBytes(page.blob);
    finalObjects.push(
      concatBytes([
        encoder.encode(
          `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`,
        ),
        bytes,
        encoder.encode("\nendstream"),
      ]),
    );
  }

  const header = encoder.encode("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
  const chunks: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let offset = header.length;

  for (let i = 0; i < finalObjects.length; i++) {
    const objectNumber = i + 1;
    const prefix = encoder.encode(`${objectNumber} 0 obj\n`);
    const suffix = encoder.encode("\nendobj\n");
    offsets.push(offset);
    chunks.push(prefix, finalObjects[i], suffix);
    offset += prefix.length + finalObjects[i].length + suffix.length;
  }

  const xrefOffset = offset;
  const xref = [`xref\n0 ${finalObjects.length + 1}\n0000000000 65535 f \n`];
  for (let i = 1; i <= finalObjects.length; i++) {
    xref.push(`${String(offsets[i]).padStart(10, "0")} 00000 n ` + "\n");
  }

  const trailer = `trailer\n<< /Size ${finalObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(encoder.encode(xref.join("") + trailer));

  return new Blob(chunks, { type: "application/pdf" });
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function enhanceCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const contrast = (gray - 128) * 1.18 + 128;
    const value = Math.max(0, Math.min(255, contrast));
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  ctx.putImageData(image, 0, 0);
}

export default function CameraScanDialog({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [enhance, setEnhance] = useState(true);
  const [buildingPdf, setBuildingPdf] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    setReady(false);
    stopStream();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not supported in this browser. Use file upload instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      }
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Camera permission denied. Allow camera access and try again.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to open the camera.");
      }
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (!open) {
      stopStream();
      pages.forEach((page) => URL.revokeObjectURL(page.url));
      setPages([]);
      setPreviewUrl(null);
      setError("");
      return;
    }
    if (!previewUrl) void startCamera();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facingMode]);

  useEffect(() => {
    return () => {
      stopStream();
      setPages((current) => {
        current.forEach((page) => URL.revokeObjectURL(page.url));
        return [];
      });
    };
  }, [stopStream]);

  function captureFrame() {
    const video = videoRef.current;
    if (!video || !ready) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      setError("Unable to capture frame.");
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);
    if (enhance) enhanceCanvas(ctx, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Failed to create image from camera.");
          return;
        }
        const url = URL.createObjectURL(blob);
        setPages((previous) => [...previous, { blob, url, width, height }]);
        setPreviewUrl(url);
        stopStream();
        setError("");
      },
      "image/jpeg",
      0.92,
    );
  }

  function retakeCurrent() {
    const current = pages[pages.length - 1];
    if (current) URL.revokeObjectURL(current.url);
    setPages((previous) => previous.slice(0, -1));
    setPreviewUrl(pages.length > 1 ? pages[pages.length - 2].url : null);
    void startCamera();
  }

  function addPage() {
    setPreviewUrl(null);
    void startCamera();
  }

  async function useScan() {
    if (pages.length === 0 || buildingPdf) return;
    setBuildingPdf(true);
    setError("");
    try {
      if (pages.length === 1) {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        onCapture(new File([pages[0].blob], `scan-${stamp}.jpg`, { type: "image/jpeg" }));
      } else {
        const pdf = await pagesToPdf(pages);
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        onCapture(new File([pdf], `scan-${stamp}.pdf`, { type: "application/pdf" }));
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the scanned document.");
    } finally {
      setBuildingPdf(false);
    }
  }

  function flipCamera() {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }

  const currentPreview = previewUrl || (pages.length ? pages[pages.length - 1].url : null);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PhotoCameraOutlinedIcon color="primary" />
          <span>Camera scan</span>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Scan one or more pages. Images can be enhanced for OCR, and multiple pages are combined
            into one PDF automatically.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <Box
            sx={{
              position: "relative",
              width: "100%",
              aspectRatio: "4 / 3",
              bgcolor: "#0b1220",
              borderRadius: 2,
              overflow: "hidden",
              display: "grid",
              placeItems: "center",
            }}
          >
            {currentPreview ? (
              <Box component="img" src={currentPreview} alt="Scanned document" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <Box
                component="video"
                ref={videoRef}
                playsInline
                muted
                autoPlay
                sx={{ width: "100%", height: "100%", objectFit: "cover", transform: facingMode === "user" ? "scaleX(-1)" : undefined }}
              />
            )}
            {!currentPreview && ready && (
              <Box sx={{ pointerEvents: "none", position: "absolute", inset: "8%", border: "2px dashed rgba(255,255,255,0.55)", borderRadius: 1 }} />
            )}
          </Box>

          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <FormControlLabel
              control={<Switch checked={enhance} onChange={(event) => setEnhance(event.target.checked)} />}
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <AutoFixHighOutlinedIcon fontSize="small" />
                  <span>Enhance for OCR</span>
                </Stack>
              }
            />
            {pages.length > 0 && (
              <ChipLike text={`${pages.length} page${pages.length === 1 ? "" : "s"} captured`} />
            )}
          </Stack>

          {!currentPreview && !error && (
            <Typography variant="caption" color="text.secondary" textAlign="center">
              {ready ? "Align the document inside the frame, then capture." : "Starting camera…"}
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onClose}>Cancel</Button>
        {!currentPreview ? (
          <>
            <Button startIcon={<CameraswitchOutlinedIcon />} onClick={flipCamera} disabled={Boolean(error)}>
              Flip
            </Button>
            <Button variant="contained" startIcon={<CameraAltOutlinedIcon />} onClick={captureFrame} disabled={!ready}>
              Capture page
            </Button>
          </>
        ) : (
          <>
            <Button onClick={retakeCurrent}>Retake</Button>
            <Button startIcon={<LayersOutlinedIcon />} onClick={addPage}>Add page</Button>
            <Button variant="contained" onClick={useScan} disabled={buildingPdf}>
              {buildingPdf ? "Preparing…" : pages.length > 1 ? "Use PDF" : "Use photo"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

function ChipLike({ text }: { text: string }) {
  return (
    <Box sx={{ px: 1.2, py: 0.5, borderRadius: 10, bgcolor: "action.hover", fontSize: 13, fontWeight: 700 }}>
      {text}
    </Box>
  );
}
