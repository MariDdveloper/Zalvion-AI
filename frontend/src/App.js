import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import GetStarted from "@/pages/GetStarted";
import ChatApp from "@/pages/ChatApp";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#FDFDF9]">
        <div className="claus-orb animate-pulse" />
      </div>
    );
  }
  if (!user) return <Navigate to="/welcome" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/welcome" element={<PublicOnly><GetStarted /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/" element={<Protected><ChatApp /></Protected>} />
      <Route path="/c/:chatId" element={<Protected><ChatApp /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" richColors />
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
