import { useState } from "react";
import {
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

export default function App() {
  const [fileName, setFileName] = useState("");

  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
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

          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 5 }}>
              <Stack spacing={3} alignItems="center">
                <CloudUploadOutlinedIcon sx={{ fontSize: 56 }} />
                <Typography variant="h5" fontWeight={600}>
                  Upload your first document
                </Typography>
                <Typography color="text.secondary" textAlign="center">
                  PDF, PNG, JPG and other supported formats will be processed here.
                </Typography>

                <Button component="label" variant="contained" size="large">
                  Choose document
                  <input
                    hidden
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.docx"
                    onChange={(event) =>
                      setFileName(event.target.files?.[0]?.name ?? "")
                    }
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
