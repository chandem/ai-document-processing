import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import type { Citation, Message } from "../types";

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  document: any | null;
  question: string;
  answer: string;
  citations: Citation[];
  chatMessages: Message[];
  conversationId: string | null;
  asking: boolean;
  exporting: boolean;
  processingHistory: any[];
  loadingHistory: boolean;
  previewUrl?: string | null;
  openingOriginal?: boolean;
  correcting?: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onExportJson: (id: string, filename?: string) => void;
  onExportCsv: (id: string, filename?: string) => void;
  onExportXlsx?: (id: string, filename?: string) => void;
  onCopyAnswer: () => void;
  onRetry?: (id: string) => void;
  retrying?: boolean;
  onOpenOriginal?: (id: string) => void;
  onCorrect?: (
    id: string,
    payload: {
      category?: string;
      summary?: string;
      structured_data?: Record<string, unknown>;
    },
  ) => void | Promise<void>;
};

export default function DocumentDialog({
  document: selectedDocument,
  question,
  answer,
  citations,
  chatMessages,
  conversationId,
  asking,
  exporting,
  processingHistory,
  loadingHistory,
  previewUrl,
  openingOriginal,
  correcting,
  onQuestionChange,
  onAsk,
  onClose,
  onDelete,
  onExportJson,
  onExportCsv,
  onExportXlsx,
  onCopyAnswer,
  onRetry,
  retrying,
  onOpenOriginal,
  onCorrect,
}: Props) {
  const [editMode, setEditMode] = useState(false);
  const [editCategory, setEditCategory] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editStructured, setEditStructured] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDocument) return;
    setEditMode(false);
    setEditError(null);
    setEditCategory(selectedDocument.category || "");
    setEditSummary(selectedDocument.summary || "");
    setEditStructured(
      selectedDocument.structured_data
        ? JSON.stringify(selectedDocument.structured_data, null, 2)
        : "",
    );
  }, [selectedDocument?.id]);

  if (!selectedDocument) return null;

  const contentType = String(selectedDocument.content_type || "").toLowerCase();
  const filename = String(selectedDocument.filename || "").toLowerCase();
  const isImage =
    contentType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(filename);
  const isPdf = contentType.includes("pdf") || filename.endsWith(".pdf");
  const isText =
    contentType.startsWith("text/") ||
    /\.(txt|md|csv|json)$/i.test(filename);

  async function handleSaveCorrection() {
    if (!onCorrect) return;
    setEditError(null);
    let structured: Record<string, unknown> | undefined;
    if (editStructured.trim()) {
      try {
        structured = JSON.parse(editStructured);
        if (typeof structured !== "object" || structured === null || Array.isArray(structured)) {
          setEditError("Structured data must be a JSON object.");
          return;
        }
      } catch {
        setEditError("Structured data is not valid JSON.");
        return;
      }
    } else {
      structured = {};
    }
    await onCorrect(selectedDocument.id, {
      category: editCategory,
      summary: editSummary,
      structured_data: structured,
    });
    setEditMode(false);
  }

  return (
    <Dialog open={Boolean(selectedDocument)} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontWeight: 800 }}>{selectedDocument.filename}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={selectedDocument.category || "other"} />
            <Chip
              label={selectedDocument.status}
              color={
                selectedDocument.status === "completed"
                  ? "success"
                  : selectedDocument.status === "failed"
                    ? "error"
                    : "default"
              }
            />
            <Chip label={formatBytes(selectedDocument.file_size)} variant="outlined" />
            {selectedDocument.classification_confidence != null && (
              <Chip
                label={`Confidence ${(Number(selectedDocument.classification_confidence) * 100).toFixed(0)}%`}
                variant="outlined"
              />
            )}
            {onOpenOriginal && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNewOutlinedIcon />}
                disabled={openingOriginal}
                onClick={() => onOpenOriginal(selectedDocument.id)}
              >
                {openingOriginal ? "Opening…" : "Original"}
              </Button>
            )}
            {onCorrect && (
              <Button
                size="small"
                variant={editMode ? "contained" : "outlined"}
                startIcon={<EditOutlinedIcon />}
                onClick={() => {
                  setEditMode((v) => !v);
                  setEditError(null);
                }}
              >
                {editMode ? "Cancel edit" : "Correct"}
              </Button>
            )}
          </Stack>

          {selectedDocument.error_message && (
            <Typography color="error" variant="body2">
              {selectedDocument.error_message}
            </Typography>
          )}

          {previewUrl && (isImage || isPdf || isText) && (
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>
                Original preview
              </Typography>
              <Paper
                variant="outlined"
                sx={{ mt: 1, p: 1, maxHeight: 360, overflow: "auto", bgcolor: "#fafafa" }}
              >
                {isImage && (
                  <Box
                    component="img"
                    src={previewUrl}
                    alt={selectedDocument.filename}
                    sx={{ maxWidth: "100%", maxHeight: 320, display: "block", mx: "auto" }}
                  />
                )}
                {isPdf && (
                  <Box
                    component="iframe"
                    src={previewUrl}
                    title={selectedDocument.filename}
                    sx={{ width: "100%", height: 320, border: 0 }}
                  />
                )}
                {isText && !isImage && !isPdf && (
                  <Typography variant="body2" component="a" href={previewUrl} target="_blank" rel="noreferrer">
                    Open text file in new tab
                  </Typography>
                )}
              </Paper>
            </Box>
          )}

          {editMode ? (
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                Human correction
              </Typography>
              <Stack spacing={1.5}>
                <TextField
                  label="Category"
                  size="small"
                  fullWidth
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                />
                <TextField
                  label="Summary"
                  size="small"
                  fullWidth
                  multiline
                  minRows={3}
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                />
                <TextField
                  label="Structured data (JSON object)"
                  size="small"
                  fullWidth
                  multiline
                  minRows={4}
                  value={editStructured}
                  onChange={(e) => setEditStructured(e.target.value)}
                  sx={{ fontFamily: "monospace" }}
                />
                {editError && (
                  <Typography color="error" variant="body2">
                    {editError}
                  </Typography>
                )}
                <Button
                  variant="contained"
                  disabled={correcting}
                  onClick={() => void handleSaveCorrection()}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {correcting ? "Saving…" : "Save correction"}
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>
                Summary
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {selectedDocument.summary || "No summary available."}
              </Typography>
            </Box>
          )}

          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <QuestionAnswerOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={800}>
                Ask a question
              </Typography>
              {conversationId && (
                <Chip
                  size="small"
                  icon={<HistoryOutlinedIcon />}
                  label="History on"
                  variant="outlined"
                />
              )}
            </Stack>

            {chatMessages.length > 0 && (
              <Paper
                variant="outlined"
                sx={{ mb: 1.5, p: 1.5, maxHeight: 220, overflow: "auto", bgcolor: "#fafcff" }}
              >
                <Stack spacing={1.25}>
                  {chatMessages.map((msg) => (
                    <Box key={msg.id}>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        color={msg.role === "user" ? "primary.main" : "text.secondary"}
                      >
                        {msg.role === "user" ? "You" : "Assistant"}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {msg.content}
                      </Typography>
                      {msg.role === "assistant" &&
                        Array.isArray(msg.citations) &&
                        msg.citations.length > 0 && (
                          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                            {msg.citations.map((c, i) => (
                              <Typography
                                key={`${msg.id}-c-${i}`}
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", pl: 1, borderLeft: "2px solid #90caf9" }}
                              >
                                "{c.snippet}"
                              </Typography>
                            ))}
                          </Stack>
                        )}
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="e.g. What is the total amount due?"
                value={question}
                onChange={(e) => onQuestionChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onAsk();
                  }
                }}
                disabled={asking || selectedDocument.status === "processing"}
              />
              <Button
                variant="contained"
                onClick={onAsk}
                disabled={
                  asking || !question.trim() || selectedDocument.status === "processing"
                }
                sx={{ minWidth: 100 }}
              >
                {asking ? "Asking…" : "Ask"}
              </Button>
            </Stack>
            {asking && <LinearProgress sx={{ mt: 1 }} />}
            {answer && (
              <Paper variant="outlined" sx={{ mt: 1.5, p: 2, bgcolor: "#f0f7ff" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", flex: 1 }}>
                    {answer}
                  </Typography>
                  <Tooltip title="Copy answer">
                    <IconButton size="small" onClick={onCopyAnswer}>
                      <ContentCopyOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                {citations.length > 0 && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                      Sources
                    </Typography>
                    <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                      {citations.map((c, i) => (
                        <Paper key={`cite-${i}`} variant="outlined" sx={{ p: 1, bgcolor: "white" }}>
                          <Typography variant="caption" sx={{ whiteSpace: "pre-wrap" }}>
                            {c.snippet}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Paper>
            )}
          </Box>

          {!editMode &&
            selectedDocument.structured_data &&
            typeof selectedDocument.structured_data === "object" &&
            Object.keys(selectedDocument.structured_data).length > 0 && (
              <Box>
                <Typography variant="subtitle1" fontWeight={800}>
                  Extracted fields
                </Typography>
                <Paper variant="outlined" sx={{ mt: 1, p: 2 }}>
                  <Stack spacing={1}>
                    {Object.entries(selectedDocument.structured_data).map(([key, value]) => (
                      <Box
                        key={key}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "180px 1fr" },
                          gap: 1,
                          py: 0.75,
                          borderBottom: "1px solid #edf1f5",
                        }}
                      >
                        <Typography variant="body2" fontWeight={700}>
                          {key.replace(/_/g, " ")}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                        >
                          {typeof value === "object"
                            ? JSON.stringify(value, null, 2)
                            : String(value ?? "—")}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              </Box>
            )}

          <Box>
            <Typography variant="subtitle1" fontWeight={800}>
              Processing history
            </Typography>
            {loadingHistory && <LinearProgress sx={{ mt: 1 }} />}
            {!loadingHistory && processingHistory.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                No processing jobs recorded yet.
              </Typography>
            )}
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {processingHistory.map((job) => (
                <Paper key={job.id} variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="body2" fontWeight={700}>
                    {job.stage} · {job.status}
                    {job.attempt != null ? ` · attempt ${job.attempt}` : ""}
                  </Typography>
                  {job.error_message && (
                    <Typography variant="caption" color="error">
                      {job.error_message}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
            {selectedDocument.status === "failed" && onRetry && (
              <Button
                sx={{ mt: 1 }}
                variant="outlined"
                disabled={retrying}
                onClick={() => onRetry(selectedDocument.id)}
              >
                {retrying ? "Retrying…" : "Retry processing"}
              </Button>
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
                maxHeight: 280,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                bgcolor: "#fafafa",
              }}
            >
              <Typography variant="body2">
                {selectedDocument.extracted_text || "No extracted text available."}
              </Typography>
            </Paper>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onClose}>Close</Button>
        <Button
          startIcon={<DownloadOutlinedIcon />}
          onClick={() => onExportJson(selectedDocument.id, selectedDocument.filename)}
        >
          JSON
        </Button>
        <Button
          startIcon={<TableChartOutlinedIcon />}
          disabled={exporting}
          onClick={() => onExportCsv(selectedDocument.id, selectedDocument.filename)}
        >
          CSV
        </Button>
        {onExportXlsx && (
          <Button
            startIcon={<TableChartOutlinedIcon />}
            disabled={exporting}
            onClick={() => onExportXlsx(selectedDocument.id, selectedDocument.filename)}
          >
            Excel
          </Button>
        )}
        <Button color="error" onClick={() => onDelete(selectedDocument.id)}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
