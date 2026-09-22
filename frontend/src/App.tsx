import { useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  CssBaseline,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import { uploadDocument } from "./services/api";

export default function App() {
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setFileName(file.name);
    setMessage("");
    setError("");

    try {
      const result = await uploadDocument(file);
      setMessage(result.message || "Document uploaded successfully.");
    } catch {
      setError("Upload is not connected to a running backend yet.");
    }
  }

  return (
    <>
      <CssBaseline />
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            AI Document Processing
          </Typography>
          <Button color="inherit">Sign in</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg">
        <Box sx={{ py: 7 }}>
          <Typography variant="h3" fontWeight={700} gutterBottom>
            Turn documents into useful data.
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 720, mb: 4 }}>
            Upload PDFs and images, extract information with AI, summarize content,
            and ask questions about your documents.
          </Typography>

          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
          {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 5 }}>
              <Stack spacing={3} alignItems="center">
                <CloudUploadOutlinedIcon sx={{ fontSize: 56 }} />
                <Typography variant="h5" fontWeight={600}>
                  Upload your first document
                </Typography>
                <Typography color="text.secondary" textAlign="center">
                  PDF, PNG, JPG and DOCX are planned for the processing pipeline.
                </Typography>

                <Button component="label" variant="contained" size="large">
                  Choose document
                  <input
                    hidden
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.docx"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleFile(file);
                    }}
                  />
                </Button>

                {fileName && (
                  <Typography color="primary">
                    Selected: {fileName}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </>
  );
}
