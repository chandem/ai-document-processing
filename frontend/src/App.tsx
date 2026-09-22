import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import { supabase } from "./services/supabase";
import {
  askDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  uploadDocument,
} from "./services/api";
import type { Session } from "@supabase/supabase-js";

const MAX_FILE_SIZE_MB = 20;
const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".tiff",
  ".tif",
  ".webp",
  ".bmp",
];

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">("signin");
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setPassword("");
        setNewPassword("");
        setError("");
        setMessage("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function refreshDocuments() {
    if (!session) return;
    setLoadingDocuments(true);
    try {
      const data = await listDocuments(session.access_token);
      setDocuments(data.documents ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load documents.");
    } finally {
      setLoadingDocuments(false);
    }
  }

  useEffect(() => {
    if (session && mode !== "reset") refreshDocuments();
    if (!session) setDocuments([]);
  }, [session, mode]);

  async function handleAuth() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) throw authError;
        if (!data.session) {
          setMessage(
            "Account created. Check your email to confirm your account, then sign in.",
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: window.location.origin },
      );
      if (resetError) throw resetError;
      setMessage(
        "If an account exists for this email, a password reset link has been sent.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send the password reset email.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword() {
    setError("");
    setMessage("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      setMode("signin");
      setPassword("");
      setNewPassword("");
      setMessage("Password updated successfully. You can now sign in.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update the password.",
      );
    } finally {
      setLoading(false);
    }
  }

  function validateFile(candidate: File) {
    const lowerName = candidate.name.toLowerCase();
    const accepted = ACCEPTED_EXTENSIONS.some((extension) =>
      lowerName.endsWith(extension),
    );
    if (!accepted) {
      return "Unsupported file type. Use PDF, DOCX, images (PNG/JPG/TIFF), TXT, Markdown, CSV or JSON.";
    }
    if (candidate.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`;
    }
    return "";
  }

  function selectFile(candidate?: File) {
    if (!candidate) return;
    const validationError = validateFile(candidate);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setError("");
    setMessage("");
    setFile(candidate);
  }

  async function handleUpload() {
    if (!file || !session) return;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const data = await uploadDocument(file, session.access_token);
      setMessage(
        `Processed ${data.document?.filename ?? file.name} successfully.`,
      );
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleView(documentId: string) {
    if (!session) return;
    setError("");
    setQuestion("");
    setAnswer("");
    try {
      const data = await getDocument(documentId, session.access_token);
      setSelectedDocument(data.document);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load document.");
    }
  }

  async function handleAsk() {
    if (!session || !selectedDocument || !question.trim()) return;
    setAsking(true);
    setAnswer("");
    setError("");
    try {
      const data = await askDocument(
        selectedDocument.id,
        question.trim(),
        session.access_token,
      );
      setAnswer(data.answer || "No answer returned.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to answer the question.",
      );
    } finally {
      setAsking(false);
    }
  }

  async function handleDelete(documentId: string) {
    if (!session) return;
    if (
      !window.confirm(
        "Delete this document permanently? This removes its stored file too.",
      )
    )
      return;
    setLoading(true);
    setError("");
    try {
      await deleteDocument(documentId, session.access_token);
      if (selectedDocument?.id === documentId) setSelectedDocument(null);
      await refreshDocuments();
      setMessage("Document deleted.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete document.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSelectedDocument(null);
    setMessage("");
    setError("");
  }

  const stats = useMemo(
    () => ({
      total: documents.length,
      completed: documents.filter((doc) => doc.status === "completed").length,
      processing: documents.filter((doc) => doc.status === "processing").length,
      size: documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0),
    }),
    [documents],
  );

  if (!session) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "#f4f7fb",
          display: "grid",
          placeItems: "center",
          p: 2,
        }}
      >
        <Card sx={{ width: "100%", maxWidth: 460, borderRadius: 4 }} elevation={3}>
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Stack spacing={3}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AutoAwesomeOutlinedIcon color="primary" />
                  <Typography variant="h4" fontWeight={800}>
                    AI Document Processing
                  </Typography>
                </Stack>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {mode === "reset"
                    ? "Choose a new password for your account."
                    : mode === "forgot"
                      ? "Enter your email and we’ll send you a password reset link."
                      : "Securely process, classify and store your documents."}
                </Typography>
              </Box>

              {mode === "reset" ? (
                <>
                  <TextField
                    label="New password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    fullWidth
                  />
                  {error && <Alert severity="error">{error}</Alert>}
                  {message && <Alert severity="success">{message}</Alert>}
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleUpdatePassword}
                    disabled={loading || !newPassword}
                  >
                    {loading ? "Updating…" : "Update password"}
                  </Button>
                </>
              ) : mode === "forgot" ? (
                <>
                  <TextField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                  />
                  {error && <Alert severity="error">{error}</Alert>}
                  {message && <Alert severity="success">{message}</Alert>}
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleForgotPassword}
                    disabled={loading || !email}
                  >
                    {loading ? "Sending…" : "Send reset link"}
                  </Button>
                  <Button
                    variant="text"
                    onClick={() => {
                      setMode("signin");
                      setError("");
                      setMessage("");
                    }}
                  >
                    Back to sign in
                  </Button>
                </>
              ) : (
                <>
                  <TextField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                  />
                  {error && <Alert severity="error">{error}</Alert>}
                  {message && <Alert severity="success">{message}</Alert>}
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleAuth}
                    disabled={loading || !email || !password}
                  >
                    {loading
                      ? "Please wait…"
                      : mode === "signin"
                        ? "Sign in"
                        : "Create account"}
                  </Button>
                  {mode === "signin" && (
                    <Button
                      variant="text"
                      onClick={() => {
                        setMode("forgot");
                        setError("");
                        setMessage("");
                      }}
                    >
                      Forgot password?
                    </Button>
                  )}
                  <Button
                    variant="text"
                    onClick={() =>
                      setMode(mode === "signin" ? "signup" : "signin")
                    }
                  >
                    {mode === "signin"
                      ? "Create a new account"
                      : "Already have an account? Sign in"}
                  </Button>
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
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "white",
          color: "#182230",
          borderBottom: "1px solid #e5eaf0",
        }}
      >
        <Toolbar>
          <AutoAwesomeOutlinedIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800 }}>
            AI Document Processing
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: { xs: "none", sm: "block" }, mr: 2 }}
          >
            {session.user.email}
          </Typography>
          <Button onClick={handleSignOut}>Sign out</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={4}>
          <Box>
            <Typography variant="overline" color="primary" fontWeight={700}>
              Document intelligence workspace
            </Typography>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 850,
                fontSize: { xs: "2.2rem", md: "3.5rem" },
                mt: 0.5,
              }}
            >
              Turn documents into useful data.
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ mt: 1.5, maxWidth: 760, fontWeight: 400 }}
            >
              Upload a document or image, extract text (with OCR when needed),
              classify it, and ask questions — all in your private workspace.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          {message && (
            <Alert severity="success" onClose={() => setMessage("")}>
              {message}
            </Alert>
          )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
              gap: 2,
            }}
          >
            {(
              [
                ["Documents", stats.total, DescriptionOutlinedIcon],
                ["Completed", stats.completed, CheckCircleOutlineIcon],
                ["Processing", stats.processing, AutoAwesomeOutlinedIcon],
                ["Storage used", formatBytes(stats.size), ArticleOutlinedIcon],
              ] as const
            ).map(([label, value, Icon]) => (
              <Card
                key={String(label)}
                elevation={0}
                sx={{ border: "1px solid #e1e7ef", borderRadius: 3 }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
                        {value}
                      </Typography>
                    </Box>
                    <Icon color="primary" />
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Card
            elevation={0}
            sx={{ border: "1px solid #dce4ed", borderRadius: 4 }}
          >
            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <CloudUploadOutlinedIcon color="primary" fontSize="large" />
                  <Box>
                    <Typography variant="h5" fontWeight={800}>
                      Upload a document
                    </Typography>
                    <Typography color="text.secondary">
                      Maximum 20 MB · PDF, DOCX, images (PNG/JPG/TIFF), TXT,
                      Markdown, CSV or JSON
                    </Typography>
                  </Box>
                </Stack>

                <Paper
                  variant="outlined"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    selectFile(e.dataTransfer.files?.[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    p: { xs: 3, md: 5 },
                    textAlign: "center",
                    cursor: "pointer",
                    borderStyle: "dashed",
                    borderWidth: 2,
                    borderColor: dragging ? "primary.main" : "#cbd5e1",
                    bgcolor: dragging ? "rgba(25,118,210,0.04)" : "#fafcff",
                    borderRadius: 3,
                  }}
                >
                  <CloudUploadOutlinedIcon sx={{ fontSize: 46 }} color="primary" />
                  <Typography fontWeight={700} sx={{ mt: 1 }}>
                    Drop a file here or click to browse
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {file
                      ? `Selected: ${file.name} · ${formatBytes(file.size)}`
                      : "Your document will be processed and saved securely."}
                  </Typography>
                  <input
                    ref={fileInputRef}
                    hidden
                    type="file"
                    accept={ACCEPTED_EXTENSIONS.join(",")}
                    onChange={(e) => selectFile(e.target.files?.[0])}
                  />
                </Paper>

                {loading && <LinearProgress />}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button
                    variant="contained"
                    size="large"
                    disabled={!file || loading}
                    onClick={handleUpload}
                    startIcon={<AutoAwesomeOutlinedIcon />}
                  >
                    {loading ? "Processing…" : "Process and save"}
                  </Button>
                  {file && (
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      Clear selection
                    </Button>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card
            elevation={0}
            sx={{ border: "1px solid #e1e7ef", borderRadius: 4 }}
          >
            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center">
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h5" fontWeight={800}>
                      Your documents
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {documents.length} document
                      {documents.length === 1 ? "" : "s"} in your workspace
                    </Typography>
                  </Box>
                  <Tooltip title="Refresh">
                    <span>
                      <IconButton
                        onClick={refreshDocuments}
                        disabled={loadingDocuments}
                      >
                        <RefreshOutlinedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                <Divider />

                {loadingDocuments && <LinearProgress />}
                {documents.length === 0 && !loadingDocuments ? (
                  <Box sx={{ py: 6, textAlign: "center" }}>
                    <DescriptionOutlinedIcon
                      sx={{ fontSize: 54 }}
                      color="disabled"
                    />
                    <Typography fontWeight={700} sx={{ mt: 1 }}>
                      No documents yet
                    </Typography>
                    <Typography color="text.secondary">
                      Upload your first document above.
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={1.5}>
                    {documents.map((document) => (
                      <Paper
                        key={document.id}
                        variant="outlined"
                        sx={{ p: 2, borderRadius: 3 }}
                      >
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1.5}
                          alignItems={{ sm: "center" }}
                        >
                          <DescriptionOutlinedIcon color="primary" />
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography fontWeight={750} noWrap>
                              {document.filename}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {document.category || "other"} ·{" "}
                              {formatBytes(document.file_size)} ·{" "}
                              {formatDate(document.created_at)}
                            </Typography>
                          </Box>
                          <Chip
                            label={document.status}
                            size="small"
                            color={
                              document.status === "completed"
                                ? "success"
                                : "default"
                            }
                          />
                          <Stack direction="row">
                            <Tooltip title="View document">
                              <IconButton onClick={() => handleView(document.id)}>
                                <VisibilityOutlinedIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete document">
                              <IconButton
                                color="error"
                                onClick={() => handleDelete(document.id)}
                              >
                                <DeleteOutlineIcon />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                        {document.summary && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1, ml: { sm: 5 } }}
                          >
                            {document.summary}
                          </Typography>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>

      <Dialog
        open={Boolean(selectedDocument)}
        onClose={() => {
          setSelectedDocument(null);
          setQuestion("");
          setAnswer("");
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {selectedDocument?.filename}
        </DialogTitle>
        <DialogContent dividers>
          {selectedDocument && (
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={selectedDocument.category || "other"} />
                <Chip label={selectedDocument.status} color="success" />
                <Chip
                  label={formatBytes(selectedDocument.file_size)}
                  variant="outlined"
                />
                {selectedDocument.classification_confidence != null && (
                  <Chip
                    label={`Confidence ${(Number(selectedDocument.classification_confidence) * 100).toFixed(0)}%`}
                    variant="outlined"
                  />
                )}
              </Stack>

              <Box>
                <Typography variant="subtitle1" fontWeight={800}>
                  Summary
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  {selectedDocument.summary || "No summary available."}
                </Typography>
              </Box>

              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <QuestionAnswerOutlinedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={800}>
                    Ask a question
                  </Typography>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="e.g. What is the total amount due?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAsk();
                      }
                    }}
                    disabled={asking}
                  />
                  <Button
                    variant="contained"
                    onClick={handleAsk}
                    disabled={asking || !question.trim()}
                    sx={{ minWidth: 100 }}
                  >
                    {asking ? "Asking…" : "Ask"}
                  </Button>
                </Stack>
                {asking && <LinearProgress sx={{ mt: 1 }} />}
                {answer && (
                  <Paper
                    variant="outlined"
                    sx={{ mt: 1.5, p: 2, bgcolor: "#f0f7ff" }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {answer}
                    </Typography>
                  </Paper>
                )}
              </Box>

              <Box>
                <Typography variant="subtitle1" fontWeight={800}>
                  Extracted text
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    mt: 1,
                    p: 2,
                    maxHeight: 360,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    bgcolor: "#fafafa",
                  }}
                >
                  <Typography variant="body2">
                    {selectedDocument.extracted_text ||
                      "No extracted text available."}
                  </Typography>
                </Paper>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setSelectedDocument(null);
              setQuestion("");
              setAnswer("");
            }}
          >
            Close
          </Button>
          {selectedDocument && (
            <Button
              color="error"
              onClick={() => handleDelete(selectedDocument.id)}
            >
              Delete
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default App;
