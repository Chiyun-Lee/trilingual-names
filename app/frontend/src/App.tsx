import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Curate from "./pages/Curate";
import Explore from "./pages/Explore";

const theme = createTheme({
  palette: { mode: "light" },
  typography: { fontFamily: "Inter, system-ui, sans-serif" },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout>
        <Routes>
          <Route path="/" element={<Curate />} />
          <Route path="/explore" element={<Explore />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  );
}
