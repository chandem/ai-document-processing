import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import { supabase, isSupabaseConfigured } from "./services/supabase";
import {
  askDocument,
  correctDocument,
  deleteDocument,
  exportDocument,
  exportDocumentCsv,
  exportDocumentXlsx,
  exportDocumentsCsv,
  getApiBaseUrl,
  getDocument,
  getDocumentFileUrl,
  getProcessingHistory,
  getUsage,
  listConversations,
  listDocuments,
  listMessages,
  retryDocument,
  uploadDocument,
} from "./services/api";
import type { Session } from "@supabase/supabase-js";
import type { Citation, Message, UsageSnapshot } from "./types";
import DocumentDialog from "./components/DocumentDialog";
import CameraScanDialog from "./components/CameraScanDialog";

const MAX_FILE_SIZE_MB = 20;
const ACCEPTED = [".pdf",".docx",".txt",".md",".csv",".json",".png",".jpg",".jpeg",".tiff",".tif",".webp",".bmp"];

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(v?: string) {
  return v ? new Date(v).toLocaleString() : "—";
}
function isNetworkError(message: string) {
  const m = message.toLowerCase();
  return m.includes("failed to fetch") || m.includes("cannot reach the api") || m.includes("networkerror") || m.includes("load failed");
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">("signin");
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [asking, setAsking] = useState(false);
  const [processingHistory, setProcessingHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [openingOriginal, setOpeningOriginal] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    }).catch(() => { if (mounted) setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setAuthReady(true);
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset"); setPassword(""); setNewPassword(""); setError(""); setMessage("");
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const refreshDocuments = useCallback(async (accessToken?: string) => {
    const token = accessToken || sessionRef.current?.access_token;
    if (!token) return;
    setLoadingDocuments(true);
    try {
      const data = await listDocuments(token);
      setDocuments(data?.documents ?? []);
      setError(""); setWarning("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load documents.";
      if (isNetworkError(msg)) { setWarning(msg); setError(""); } else { setError(msg); setWarning(""); }
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  const refreshUsage = useCallback(async (accessToken?: string) => {
    const token = accessToken || sessionRef.current?.access_token;
    if (!token) return;
    try { setUsage((await getUsage(token)) as UsageSnapshot); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (session && mode !== "reset") {
      refreshDocuments(session.access_token);
      refreshUsage(session.access_token);
    }
    if (!session) { setDocuments([]); setUsage(null); }
  }, [session, mode, refreshDocuments, refreshUsage]);

  useEffect(() => {
    if (!session || mode === "reset") return;
    if (!documents.some((d) => d.status === "processing")) return;
    const timer = window.setInterval(async () => {
      await refreshDocuments(session.access_token);
      if (selectedDocument?.status === "processing") {
        try {
          const refreshed = await getDocument(selectedDocument.id, session.access_token);
          setSelectedDocument(refreshed.document);
          const history = await getProcessingHistory(selectedDocument.id, session.access_token);
          setProcessingHistory(history.history ?? []);
        } catch { /* next poll */ }
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [session, mode, documents, selectedDocument, refreshDocuments]);

  async function handleAuth() {
    setError(""); setMessage(""); setLoading(true);
    try {
      if (mode === "signin") {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase.auth.signUp({ email, password });
        if (e) throw e;
        if (!data.session) setMessage("Account created. Check your email to confirm, then sign in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally { setLoading(false); }
  }

  async function handleForgotPassword() {
    setError(""); setMessage(""); setLoading(true);
    try {
      const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (e) throw e;
      setMessage("If an account exists for this email, a password reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset email.");
    } finally { setLoading(false); }
  }

  async function handleUpdatePassword() {
    setError(""); setMessage("");
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const { error: e } = await supabase.auth.updateUser({ password: newPassword });
      if (e) throw e;
      await supabase.auth.signOut();
      setMode("signin"); setPassword(""); setNewPassword("");
      setMessage("Password updated. You can now sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.");
    } finally { setLoading(false); }
  }

  function selectFile(candidate?: File) {
    if (!candidate) return;
    const name = candidate.name.toLowerCase();
    if (!ACCEPTED.some((ext) => name.endsWith(ext))) {
      setError("Unsupported file type."); setFile(null); return;
    }
    if (candidate.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Max size is ${MAX_FILE_SIZE_MB} MB.`); setFile(null); return;
    }
    setError(""); setMessage(""); setFile(candidate);
  }

  async function handleUpload() {
    if (!file || !session) return;
    setError(""); setWarning(""); setMessage(""); setLoading(true);
    try {
      const data = await uploadDocument(file, session.access_token);
      setMessage(
        data.document?.status === "processing"
          ? `Queued ${data.document?.filename ?? file.name} for processing.`
          : `Processed ${data.document?.filename ?? file.name} successfully.`,
      );
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshDocuments(session.access_token);
      refreshUsage(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally { setLoading(false); }
  }

  async function handleView(documentId: string) {
    if (!session) return;
    setError(""); setQuestion(""); setAnswer(""); setCitations([]);
    setConversationId(null); setChatMessages([]); setProcessingHistory([]);
    try {
      const data = await getDocument(documentId, session.access_token);
      setSelectedDocument(data.document);
      setPreviewUrl(null);
      try {
        const fileMeta = await getDocumentFileUrl(documentId, session.access_token);
        if (fileMeta?.url) setPreviewUrl(fileMeta.url as string);
      } catch {
        // preview is optional
      }
      setLoadingHistory(true);
      try {
        const history = await getProcessingHistory(documentId, session.access_token);
        setProcessingHistory(history.history ?? []);
        const convs = await listConversations(documentId, session.access_token);
        const list = convs.conversations ?? [];
        if (list.length > 0) {
          setConversationId(list[0].id);
          const msgs = await listMessages(documentId, list[0].id, session.access_token);
          setChatMessages(msgs.messages ?? []);
        }
      } finally { setLoadingHistory(false); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load document.");
    }
  }

  async function handleAsk() {
    if (!session || !selectedDocument || !question.trim()) return;
    setAsking(true); setAnswer(""); setCitations([]); setError("");
    const q = question.trim();
    try {
      const data = await askDocument(selectedDocument.id, q, session.access_token, {
        conversationId: conversationId || undefined,
        saveHistory: true,
      });
      setAnswer(data.answer || "No answer returned.");
      setCitations(data.citations ?? []);
      if (data.conversation_id) setConversationId(data.conversation_id);
      setChatMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: q },
        { id: `a-${Date.now()}`, role: "assistant", content: data.answer || "", citations: data.citations ?? [] },
      ]);
      setQuestion("");
      refreshUsage(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to answer.");
    } finally { setAsking(false); }
  }

  async function handleExport(documentId: string, filename?: string) {
    if (!session) return;
    try {
      const base = (filename || "document").replace(/\.[^/.]+$/, "");
      await exportDocument(documentId, session.access_token, `${base}-export.json`);
      setMessage("Exported as JSON.");
      refreshUsage(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    }
  }

  async function handleExportCsvAll() {
    if (!session) return;
    setExporting(true);
    try {
      await exportDocumentsCsv(session.access_token);
      setMessage("Exported all documents as CSV.");
      refreshUsage(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV export failed.");
    } finally { setExporting(false); }
  }

  async function handleExportCsvOne(documentId: string, filename?: string) {
    if (!session) return;
    setExporting(true);
    try {
      const base = (filename || "document").replace(/\.[^/.]+$/, "");
      await exportDocumentCsv(documentId, session.access_token, `${base}-export.csv`);
      setMessage("Exported as CSV.");
      refreshUsage(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV export failed.");
    } finally { setExporting(false); }
  }

  async function handleCopyAnswer() {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(answer);
      setMessage("Answer copied.");
    } catch {
      setError("Unable to copy.");
    }
  }

  async function handleDelete(documentId: string) {
    if (!session) return;
    if (!window.confirm("Delete this document permanently?")) return;
    setLoading(true);
    try {
      await deleteDocument(documentId, session.access_token);
      if (selectedDocument?.id === documentId) setSelectedDocument(null);
      await refreshDocuments(session.access_token);
      setMessage("Document deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally { setLoading(false); }
  }

  async function handleExportXlsxOne(documentId: string, filename?: string) {
    if (!session) return;
    setExporting(true);
    setError("");
    try {
      const base = (filename || "document").replace(/\.[^.]+$/, "");
      await exportDocumentXlsx(documentId, session.access_token, `${base}-export.xlsx`);
      setMessage("Excel export downloaded.");
      refreshUsage(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Excel export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function handleOpenOriginal(documentId: string) {
    if (!session) return;
    setOpeningOriginal(true);
    setError("");
    try {
      const data = await getDocumentFileUrl(documentId, session.access_token);
      const url = data?.url as string | undefined;
      if (!url) throw new Error("No signed URL returned.");
      setPreviewUrl(url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open original file.");
    } finally {
      setOpeningOriginal(false);
    }
  }

  async function handleCorrect(
    documentId: string,
    payload: {
      category?: string;
      summary?: string;
      structured_data?: Record<string, unknown>;
    },
  ) {
    if (!session) return;
    setCorrecting(true);
    setError("");
    try {
      const updated = await correctDocument(documentId, session.access_token, payload);
      setSelectedDocument((prev: any) =>
        prev && prev.id === documentId ? { ...prev, ...updated } : prev,
      );
      setMessage("Correction saved.");
      await refreshDocuments(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Correction failed.");
    } finally {
      setCorrecting(false);
    }
  }

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      const mq = !q || [doc.filename, doc.category, doc.summary].some((x) => String(x || "").toLowerCase().includes(q));
      const mc = categoryFilter === "all" || String(doc.category || "other") === categoryFilter;
      const ms = statusFilter === "all" || String(doc.status || "") === statusFilter;
      return mq && mc && ms;
    });
  }, [documents, searchQuery, categoryFilter, statusFilter]);

  const categories = useMemo(() => {
    const values = documents.map((d) => String(d.category || "other"));
    return ["all", ...Array.from(new Set(values)).sort()];
  }, [documents]);

  const stats = useMemo(() => ({
    total: documents.length,
    completed: documents.filter((d) => d.status === "completed").length,
    processing: documents.filter((d) => d.status === "processing").length,
    failed: documents.filter((d) => d.status === "failed").length,
    size: documents.reduce((s, d) => s + (d.file_size || 0), 0),
  }), [documents]);

  if (!authReady) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#f4f7fb" }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography color="text.secondary">Loading workspace…</Typography>
        </Stack>
      </Box>
    );
  }

  if (!session) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#f4f7fb", display: "grid", placeItems: "center", p: 2 }}>
        <Card sx={{ width: "100%", maxWidth: 460, borderRadius: 4 }} elevation={3}>
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Stack spacing={3}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AutoAwesomeOutlinedIcon color="primary" />
                  <Typography variant="h4" fontWeight={800}>AI Document Processing</Typography>
                </Stack>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {mode === "reset" ? "Choose a new password." : mode === "forgot" ? "Enter email for a reset link." : "Process, classify and store documents."}
                </Typography>
              </Box>
              {!isSupabaseConfigured && <Alert severity="warning">Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.</Alert>}
              {mode === "reset" ? (
                <>
                  <TextField label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} fullWidth />
                  {error && <Alert severity="error">{error}</Alert>}
                  {message && <Alert severity="success">{message}</Alert>}
                  <Button variant="contained" size="large" onClick={handleUpdatePassword} disabled={loading || !newPassword}>{loading ? "Updating…" : "Update password"}</Button>
                </>
              ) : mode === "forgot" ? (
                <>
                  <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
                  {error && <Alert severity="error">{error}</Alert>}
                  {message && <Alert severity="success">{message}</Alert>}
                  <Button variant="contained" size="large" onClick={handleForgotPassword} disabled={loading || !email}>{loading ? "Sending…" : "Send reset link"}</Button>
                  <Button variant="text" onClick={() => { setMode("signin"); setError(""); setMessage(""); }}>Back to sign in</Button>
                </>
              ) : (
                <>
                  <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
                  <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
                  {error && <Alert severity="error">{error}</Alert>}
                  {message && <Alert severity="success">{message}</Alert>}
                  <Button variant="contained" size="large" onClick={handleAuth} disabled={loading || !email || !password}>{loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
                  {mode === "signin" && <Button variant="text" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Forgot password?</Button>}
                  <Button variant="text" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Create a new account" : "Already have an account? Sign in"}</Button>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f4f7fb" }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: "white", color: "#182230", borderBottom: "1px solid #e5eaf0" }}>
        <Toolbar>
          <AutoAwesomeOutlinedIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800 }}>AI Document Processing</Typography>
          {usage && (
            <Tooltip title={`Today: ${usage.uploads}/${usage.limits.uploads_per_day} uploads · ${usage.asks}/${usage.limits.asks_per_day} questions · ${usage.exports}/${usage.limits.exports_per_day} exports`}>
              <Chip size="small" label={`Quota ${usage.uploads + usage.asks + usage.exports}`} sx={{ mr: 1, display: { xs: "none", md: "flex" } }} variant="outlined" />
            </Tooltip>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" }, mr: 2 }}>{session.user.email}</Typography>
          <Button onClick={async () => { await supabase.auth.signOut(); setSelectedDocument(null); setMessage(""); setError(""); setWarning(""); }}>Sign out</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={4}>
          <Box>
            <Typography variant="overline" color="primary" fontWeight={700}>Document intelligence workspace</Typography>
            <Typography variant="h2" sx={{ fontWeight: 850, fontSize: { xs: "2.2rem", md: "3.2rem" }, mt: 0.5 }}>Turn documents into useful data.</Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mt: 1.5, maxWidth: 760, fontWeight: 400 }}>
              Upload, camera-scan, OCR, classify, ask with citations, export CSV/JSON.
            </Typography>
          </Box>

          {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
          {warning && (
            <Alert severity="warning" onClose={() => setWarning("")} action={<Button color="inherit" size="small" onClick={() => refreshDocuments()} disabled={loadingDocuments}>Retry</Button>}>
              {warning}<Typography variant="caption" display="block" sx={{ mt: 0.5 }}>API: {getApiBaseUrl()}</Typography>
            </Alert>
          )}
          {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, gap: 2 }}>
            {(
              [
                { label: "Documents", value: stats.total, icon: <DescriptionOutlinedIcon color="primary" /> },
                { label: "Completed", value: stats.completed, icon: <CheckCircleOutlineIcon color="primary" /> },
                { label: "Processing", value: stats.processing, icon: <AutoAwesomeOutlinedIcon color="primary" /> },
                { label: "Failed", value: stats.failed, icon: <ErrorOutlineIcon color="primary" /> },
                { label: "Storage", value: formatBytes(stats.size), icon: <ArticleOutlinedIcon color="primary" /> },
              ]
            ).map(({ label, value, icon }) => (
              <Card key={label} elevation={0} sx={{ border: "1px solid #e1e7ef", borderRadius: 3 }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary">{label}</Typography>
                      <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>{value}</Typography>
                    </Box>
                    {icon}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Card elevation={0} sx={{ border: "1px solid #dce4ed", borderRadius: 4 }}>
            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <CloudUploadOutlinedIcon color="primary" fontSize="large" />
                  <Box>
                    <Typography variant="h5" fontWeight={800}>Upload a document</Typography>
                    <Typography color="text.secondary">Max 20 MB · PDF, DOCX, images, text formats — or scan with your camera</Typography>
                  </Box>
                </Stack>
                <Paper
                  variant="outlined"
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files?.[0]); }}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ p: { xs: 3, md: 5 }, textAlign: "center", cursor: "pointer", borderStyle: "dashed", borderWidth: 2, borderColor: dragging ? "primary.main" : "#cbd5e1", bgcolor: dragging ? "rgba(25,118,210,0.04)" : "#fafcff", borderRadius: 3 }}
                >
                  <CloudUploadOutlinedIcon sx={{ fontSize: 46 }} color="primary" />
                  <Typography fontWeight={700} sx={{ mt: 1 }}>Drop a file here or click to browse</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {file ? `Selected: ${file.name} · ${formatBytes(file.size)}` : "Processed and saved securely."}
                  </Typography>
                  <input ref={fileInputRef} hidden type="file" accept={ACCEPTED.join(",")} onChange={(e) => selectFile(e.target.files?.[0])} />
                </Paper>
                {loading && <LinearProgress />}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button variant="contained" size="large" disabled={!file || loading} onClick={handleUpload} startIcon={<AutoAwesomeOutlinedIcon />}>
                    {loading ? "Processing…" : "Process and save"}
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<PhotoCameraOutlinedIcon />}
                    onClick={() => setCameraOpen(true)}
                    disabled={loading}
                  >
                    Camera scan
                  </Button>
                  {file && <Button variant="outlined" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>Clear</Button>}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: "1px solid #e1e7ef", borderRadius: 4 }}>
            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center">
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h5" fontWeight={800}>Your documents</Typography>
                    <Typography variant="body2" color="text.secondary">{filteredDocuments.length} shown · {documents.length} total</Typography>
                  </Box>
                  <Tooltip title="Export all as CSV"><span><IconButton onClick={handleExportCsvAll} disabled={exporting || !documents.length}><TableChartOutlinedIcon /></IconButton></span></Tooltip>
                  <Tooltip title="Refresh"><span><IconButton onClick={() => refreshDocuments()} disabled={loadingDocuments}><RefreshOutlinedIcon /></IconButton></span></Tooltip>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField fullWidth size="small" placeholder="Search…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{ startAdornment: <SearchOutlinedIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }} />
                  <TextField select size="small" label="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} sx={{ minWidth: 160 }} SelectProps={{ native: true }}>
                    {categories.map((c) => <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>)}
                  </TextField>
                  <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 140 }} SelectProps={{ native: true }}>
                    <option value="all">All statuses</option>
                    <option value="completed">Completed</option>
                    <option value="processing">Processing</option>
                    <option value="failed">Failed</option>
                  </TextField>
                </Stack>
                <Divider />
                {loadingDocuments && <LinearProgress />}
                {filteredDocuments.length === 0 && !loadingDocuments ? (
                  <Box sx={{ py: 6, textAlign: "center" }}>
                    <DescriptionOutlinedIcon sx={{ fontSize: 54 }} color="disabled" />
                    <Typography fontWeight={700} sx={{ mt: 1 }}>No documents match</Typography>
                    <Typography color="text.secondary">Upload a document or adjust filters.</Typography>
                  </Box>
                ) : (
                  <Stack spacing={1.5}>
                    {filteredDocuments.map((doc) => (
                      <Paper key={doc.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
                          <DescriptionOutlinedIcon color="primary" />
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography fontWeight={750} noWrap>{doc.filename}</Typography>
                            <Typography variant="body2" color="text.secondary">{doc.category || "other"} · {formatBytes(doc.file_size)} · {formatDate(doc.created_at)}</Typography>
                          </Box>
                          <Chip label={doc.status} size="small" color={doc.status === "completed" ? "success" : doc.status === "failed" ? "error" : "default"} />
                          <Stack direction="row">
                            <Tooltip title="View"><IconButton onClick={() => handleView(doc.id)}><VisibilityOutlinedIcon /></IconButton></Tooltip>
                            <Tooltip title="JSON"><IconButton onClick={() => handleExport(doc.id, doc.filename)}><DownloadOutlinedIcon /></IconButton></Tooltip>
                            <Tooltip title="Delete"><IconButton color="error" onClick={() => handleDelete(doc.id)}><DeleteOutlineIcon /></IconButton></Tooltip>
                          </Stack>
                        </Stack>
                        {doc.summary && <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: { sm: 5 } }}>{doc.summary}</Typography>}
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>

      <CameraScanDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(captured) => {
          selectFile(captured);
          setMessage(`Scanned photo ready: ${captured.name}. Click Process and save.`);
        }}
      />

      <DocumentDialog
        document={selectedDocument}
        question={question}
        answer={answer}
        citations={citations}
        chatMessages={chatMessages}
        conversationId={conversationId}
        asking={asking}
        exporting={exporting}
        processingHistory={processingHistory}
        loadingHistory={loadingHistory}
        previewUrl={previewUrl}
        openingOriginal={openingOriginal}
        correcting={correcting}
        onQuestionChange={setQuestion}
        onAsk={handleAsk}
        onClose={() => {
          setSelectedDocument(null); setQuestion(""); setAnswer("");
          setCitations([]); setConversationId(null); setChatMessages([]);
          setPreviewUrl(null);
        }}
        onDelete={handleDelete}
        onExportJson={handleExport}
        onExportCsv={handleExportCsvOne}
        onExportXlsx={handleExportXlsxOne}
        onCopyAnswer={handleCopyAnswer}
        onOpenOriginal={handleOpenOriginal}
        onCorrect={handleCorrect}
        onRetry={async (id) => {
          if (!session) return;
          setRetrying(true);
          try {
            await retryDocument(id, session.access_token);
            setMessage("Retry started.");
            await refreshDocuments(session.access_token);
            await handleView(id);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Retry failed.");
          } finally { setRetrying(false); }
        }}
        retrying={retrying}
      />
    </Box>
  );
}
