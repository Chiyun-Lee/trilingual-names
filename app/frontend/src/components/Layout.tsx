import { AppBar, Box, Tab, Tabs, Toolbar, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const NAV = [
  { label: "Curate", path: "/" },
  { label: "Explore", path: "/explore" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const current = NAV.findIndex((n) => n.path === location.pathname);

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
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flex: 1, overflow: "hidden" }}>
        {children}
      </Box>
    </Box>
  );
}
