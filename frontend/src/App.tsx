import { useEffect, useState } from "react";
import {
  Alert, AppBar, Box, Button, Card, CardContent, Chip, Container, Divider,
  Stack, TextField, Toolbar, Typography,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import { supabase } from "./services/supabase";
import { listDocuments, uploadDocument } from "./services/api";

type DocumentRow = {
  id: string;
  filename: string;
  status: string;
  category?: string | null;
  summary?: string | null;
  created_at?: string;
};

function App() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.access_token) {
      setDocuments([]);
      return;
    }
    listDocuments(session.access_token)
      .then((data) => setDocuments(data.documents ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load documents."));
  }, [session]);

  async function handleAuth() {
    setError("");
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setError("Account created. Check your email to confirm the account, then sign in.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleUpload() {
    if (!file || !session?.access_token) return;
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
  }

  if (!session) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#f6f8fb", display: "grid", placeItems: "center", p: 2 }}>
        <Card sx={{ width: "100%", maxWidth: 460, borderRadius: 3 }} elevation={1}>
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="overline" color="primary">AI document processing</Typography>
                <Typography variant="h4" fontWeight={800}>Your document workspace</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Sign in to securely store and process your documents.
                </Typography>
              </Box>
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
              <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
              {error && <Alert severity="error">{error}</Alert>}
              <Button variant="contained" size="large" disabled={!email || password.length < 6 || authLoading} onClick={handleAuth}>
                {authLoading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
              </Button>
              <Button variant="text" onClick={() => { setIsSignUp((value) => !value); setError(""); }}>
                {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
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
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>AI Document Processing</Typography>
          <Chip label="MVP" variant="outlined" sx={{ color: "white", borderColor: "rgba(255,255,255,.45)", mr: 1 }} />
          <Button color="inherit" startIcon={<LogoutOutlinedIcon />} onClick={handleSignOut}>Sign out</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 6 }}>
        <Stack spacing={4}>
          <Box>
            <Typography variant="overline" color="primary">Document intelligence workspace</Typography>
            <Typography variant="h2" sx={{ fontWeight: 800, fontSize: { xs: "2.3rem", md: "3.6rem" }, mt: 1 }}>
              Turn documents into useful data.
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2, maxWidth: 720, fontWeight: 400 }}>
              Upload documents, extract text, classify them and keep the processed result securely in your workspace.
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
                  <input hidden type="file" accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </Button>
                <Button variant="contained" size="large" disabled={!file || loading} onClick={handleUpload}>
                  {loading ? "Processing…" : "Upload & process"}
                </Button>
                {error && <Alert severity="error">{error}</Alert>}
                {result && (
                  <Alert severity="success">
                    <strong>{result.filename}</strong> processed successfully.
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 3, border: "1px solid #e3e8ef" }} elevation={0}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5" fontWeight={700}>Your documents</Typography>
                {documents.length === 0 ? (
                  <Typography color="text.secondary">No documents yet. Upload your first document above.</Typography>
                ) : documents.map((doc) => (
                  <Card key={doc.id} variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography fontWeight={700} sx={{ flexGrow: 1 }}>{doc.filename}</Typography>
                          <Chip label={doc.status} size="small" color={doc.status === "completed" ? "success" : "default"} />
                        </Stack>
                        {doc.category && <Typography variant="body2">Category: {doc.category}</Typography>}
                        {doc.summary && <Typography variant="body2" color="text.secondary">{doc.summary}</Typography>}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}

export default App;
