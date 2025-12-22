import { Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";
import { usePageTracking } from "./hooks/usePageTracking";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Browse from "./pages/Browse";
import Docs from "./pages/Docs";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Tool from "./pages/Tool";
import AuthCallback from "./pages/auth/AuthCallback";
import ChooseUsername from "./pages/auth/ChooseUsername";
import CliAuth from "./pages/auth/CliAuth";
import CliCallback from "./pages/auth/CliCallback";
import CliSuccess from "./pages/auth/CliSuccess";
import Login from "./pages/auth/Login";

export default function App() {
  usePageTracking();

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="browse" element={<Browse />} />
        <Route path="blog" element={<Blog />} />
        <Route path="blog/:slug" element={<BlogPost />} />
        <Route path="docs" element={<Docs />} />
        {/* Tool names can have any number of segments: owner/name, owner/cat/name, etc. */}
        <Route path="tools/*" element={<Tool />} />
        {/* User profile page */}
        <Route path="u/:username" element={<Profile />} />
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
