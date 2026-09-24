import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import CameraswitchOutlinedIcon from "@mui/icons-material/CameraswitchOutlined";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
};

export default function CameraScanDialog({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);

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
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setCapturedFile(null);
      setError("");
      return;
    }
    if (!previewUrl) {
      void startCamera();
    }
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facingMode]);

  useEffect(() => {
    return () => {
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl, stopStream]);

  function captureFrame() {
    const video = videoRef.current;
    if (!video || !ready) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Unable to capture frame.");
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Failed to create image from camera.");
          return;
        }
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const file = new File([blob], `scan-${stamp}.jpg`, { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url);
        setCapturedFile(file);
        stopStream();
      },
      "image/jpeg",
      0.92,
    );
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCapturedFile(null);
    void startCamera();
  }

  function usePhoto() {
    if (!capturedFile) return;
    onCapture(capturedFile);
    onClose();
  }

  function flipCamera() {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }

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
            Point the camera at a document, receipt, or page. Capture a clear photo — it will be
            sent through OCR and AI analysis like any other image upload.
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
            {previewUrl ? (
              <Box
                component="img"
                src={previewUrl}
                alt="Captured document"
                sx={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <Box
                component="video"
                ref={videoRef}
                playsInline
                muted
                autoPlay
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: facingMode === "user" ? "scaleX(-1)" : undefined,
                }}
              />
            )}

            {/* Document frame guide */}
            {!previewUrl && ready && (
              <Box
                sx={{
                  pointerEvents: "none",
                  position: "absolute",
                  inset: "8%",
                  border: "2px dashed rgba(255,255,255,0.55)",
                  borderRadius: 1,
                }}
              />
            )}
          </Box>

          {!previewUrl && !error && (
            <Typography variant="caption" color="text.secondary" textAlign="center">
              {ready ? "Align the document inside the frame, then capture." : "Starting camera…"}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onClose}>Cancel</Button>
        {!previewUrl ? (
          <>
            <Button
              startIcon={<CameraswitchOutlinedIcon />}
              onClick={flipCamera}
              disabled={Boolean(error)}
            >
              Flip
            </Button>
            <Button
              variant="contained"
              startIcon={<CameraAltOutlinedIcon />}
              onClick={captureFrame}
              disabled={!ready}
            >
              Capture
            </Button>
          </>
        ) : (
          <>
            <Button onClick={retake}>Retake</Button>
            <Button variant="contained" onClick={usePhoto}>
              Use photo
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
