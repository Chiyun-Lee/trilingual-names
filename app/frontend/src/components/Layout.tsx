import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import { AppBar, Box, IconButton, Tab, Tabs, Toolbar, Tooltip, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";

const NAV = [
  { label: "Curate", path: "/" },
  { label: "Explore", path: "/explore" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const current = NAV.findIndex((n) => n.path === location.pathname);
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleExport = () => api.exportVotes();

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const { imported } = await api.importVotes(file);
      await qc.invalidateQueries({ queryKey: ["votes"] });
      alert(`Imported ${imported} votes.`);
    } catch (err) {
      alert(`Import failed: ${err}`);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppBar position="static" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mr: 2 }}>
            三語
          </Typography>
          <Tabs
            value={current === -1 ? 0 : current}
            onChange={(_, i) => navigate(NAV[i].path)}
            textColor="inherit"
            indicatorColor="secondary"
          >
            {NAV.map((n) => (
              <Tab key={n.path} label={n.label} />
            ))}
          </Tabs>

          <Box sx={{ flex: 1 }} />

          <Tooltip title="Export votes">
            <IconButton color="inherit" onClick={handleExport}>
              <FileDownloadIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Import votes">
            <IconButton
              color="inherit"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <FileUploadIcon />
            </IconButton>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleImport}
          />
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flex: 1, overflow: "hidden" }}>
        {children}
      </Box>
    </Box>
  );
}
