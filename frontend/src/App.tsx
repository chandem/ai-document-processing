import { useEffect, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import { supabase } from "./services/supabase";
import { listDocuments, uploadDocument } from "./services/api";
import type { Session } from "@supabase/supabase-js";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setDocuments([]);
      return;
    }

    listDocuments(session.access_token)
      .then((data) => setDocuments(data.documents ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load documents."));
  }, [session]);

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
          setMessage("Account created. Check your email to confirm your account, then sign in.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!file || !session) return;
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const data = await uploadDocument(file, session.access_token);
      setResult(data.document);
      const refreshed = await listDocuments(session.access_token);
      setDocuments(refreshed.documents ?? []);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setResult(null);
    setMessage("");
    setError("");
  }

  if (!session) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#f6f8fb", display: "grid", placeItems: "center", p: 2 }}>
        <Card sx={{ width: "100%", maxWidth: 460, borderRadius: 3 }} elevation={2}>
          <CardContent sx={{ p: 4 }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" fontWeight={800}>
                  AI Document Processing
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Sign in to securely process and store your documents.
                </Typography>
              </Box>

              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
              <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />

              {error && <Alert severity="error">{error}</Alert>}
              {message && <Alert severity="success">{message}</Alert>}

              <Button variant="contained" size="large" onClick={handleAuth} disabled={loading || !email || !password}>
                {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>

              <Button variant="text" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Create a new account" : "Already have an account? Sign in"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f6f8fb" }}>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <AutoAwesomeOutlinedIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            AI Document Processing
          </Typography>
          <Chip label={session.user.email ?? "User"} sx={{ mr: 1, color: "white" }} />
          <Button color="inherit" onClick={handleSignOut}>Sign out</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 6 }}>
        <Stack spacing={4}>
          <Box>
            <Typography variant="overline" color="primary">
              Document intelligence workspace
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 800, fontSize: { xs: "2.3rem", md: "3.6rem" }, mt: 1 }}>
              Turn documents into useful data.
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2, maxWidth: 720, fontWeight: 400 }}>
              Upload documents, extract text, classify them and keep the processed results in your private workspace.
            </Typography>
          </Box>

          <Card sx={{ borderRadius: 3, border: "1px solid #e3e8ef" }} elevation={0}>
            <CardContent sx={{ p: { xs: 3, md: 5 } }}>
              <Stack spacing={3}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <DescriptionOutlinedIcon color="primary" fontSize="large" />
                  <Box>
                    <Typography variant="h5" fontWeight={700}>Process a document</Typography>
                    <Typography color="text.secondary">PDF, DOCX, TXT, Markdown, CSV or JSON</Typography>
                  </Box>
                </Stack>

                <Divider />

                <Button component="label" variant="outlined" startIcon={<CloudUploadOutlinedIcon />}>
                  {file ? file.name : "Choose document"}
                  <input
                    hidden
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv,.json"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </Button>

                <Button variant="contained" size="large" disabled={!file || loading} onClick={handleUpload}>
                  {loading ? "Processing…" : "Process and save"}
                </Button>

                {error && <Alert severity="error">{error}</Alert>}
                {result && (
                  <Alert severity="success">
                    Processed <strong>{result.filename}</strong> successfully.
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 3 }} elevation={0}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5" fontWeight={700}>Your documents</Typography>
                {documents.length === 0 ? (
                  <Typography color="text.secondary">No documents yet. Upload your first document above.</Typography>
                ) : (
                  documents.map((document) => (
                    <Card key={document.id} variant="outlined">
                      <CardContent>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <DescriptionOutlinedIcon color="primary" />
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography fontWeight={700}>{document.filename}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {document.category || "other"} · {document.status}
                            </Typography>
                          </Box>
                          <Chip label={document.status} size="small" color={document.status === "completed" ? "success" : "default"} />
                        </Stack>
                        {document.summary && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {document.summary}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}

export default App;
