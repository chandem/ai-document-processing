import { useState } from "react";
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
  Toolbar,
  Typography,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import { uploadDocument } from "./services/api";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await uploadDocument(file);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f6f8fb" }}>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <AutoAwesomeOutlinedIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            AI Document Processing
          </Typography>
          <Chip
            label="MVP"
            variant="outlined"
            sx={{ color: "white", borderColor: "rgba(255,255,255,.45)" }}
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 7 }}>
        <Stack spacing={4}>
          <Box>
            <Typography variant="overline" color="primary">
              Document intelligence workspace
            </Typography>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800,
                fontSize: { xs: "2.3rem", md: "3.6rem" },
                mt: 1,
              }}
            >
              Turn documents into useful data.
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ mt: 2, maxWidth: 720, fontWeight: 400 }}
            >
              Upload a document and extract clean text now. Summaries, structured
              extraction, OCR and document Q&A will use this same processing pipeline.
            </Typography>
          </Box>

          <Card sx={{ borderRadius: 3, border: "1px solid #e3e8ef" }} elevation={0}>
            <CardContent sx={{ p: { xs: 3, md: 5 } }}>
              <Stack spacing={3}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <DescriptionOutlinedIcon color="primary" fontSize="large" />
                  <Box>
                    <Typography variant="h5" fontWeight={700}>
                      Process a document
                    </Typography>
                    <Typography color="text.secondary">
                      PDF, DOCX, TXT, Markdown, CSV or JSON
                    </Typography>
                  </Box>
                </Stack>

                <Divider />

                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<CloudUploadOutlinedIcon />}
                >
                  {file ? file.name : "Choose document"}
                  <input
                    hidden
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv,.json"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </Button>

                <Button
                  variant="contained"
                  size="large"
                  disabled={!file || loading}
                  onClick={handleUpload}
                >
                  {loading ? "Processing…" : "Extract text"}
                </Button>

                {error && <Alert severity="error">{error}</Alert>}

                {result && (
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography fontWeight={700}>{result.filename}</Typography>
                          <Chip label={result.status} size="small" color="success" />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {result.word_count} words · {result.character_count} characters
                        </Typography>
                        <Divider />
                        <Typography
                          sx={{
                            whiteSpace: "pre-wrap",
                            maxHeight: 360,
                            overflow: "auto",
                          }}
                        >
                          {result.text || "No text was extracted."}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
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
