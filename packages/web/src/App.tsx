import { Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Browse from "./pages/Browse";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Tool from "./pages/Tool";
import ToolCode from "./pages/ToolCode";
import AuthCallback from "./pages/auth/AuthCallback";
import ChooseUsername from "./pages/auth/ChooseUsername";
import CliAuth from "./pages/auth/CliAuth";
import CliCallback from "./pages/auth/CliCallback";
import CliSuccess from "./pages/auth/CliSuccess";
import Login from "./pages/auth/Login";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="browse" element={<Browse />} />
        {/* Support tool names with 2 or 3 segments: owner/name or owner/category/name */}
        <Route path="tools/:owner/:name" element={<Tool />} />
        <Route path="tools/:owner/:category/:name" element={<Tool />} />
        <Route path="tools/:owner/:name/code/*" element={<ToolCode />} />
        <Route path="tools/:owner/:category/:name/code/*" element={<ToolCode />} />
        <Route path="login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      {/* Auth routes without layout */}
      <Route path="auth/callback" element={<AuthCallback />} />
      <Route path="auth/choose-username" element={<ChooseUsername />} />
      <Route path="auth/cli" element={<CliAuth />} />
      <Route path="auth/cli/callback" element={<CliCallback />} />
      <Route path="auth/cli/success" element={<CliSuccess />} />
    </Routes>
  );
}
