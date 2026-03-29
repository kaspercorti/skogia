import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "sonner";
import AppSidebar from "@/components/AppSidebar";
import Index from "./pages/Index";
import Bokforing from "./pages/Bokforing";
import Fakturering from "./pages/Fakturering";
import Skogsbruksplan from "./pages/Skogsbruksplan";
import Prognoser from "./pages/Prognoser";
import Skatteplanering from "./pages/Skatteplanering";
import Rapporter from "./pages/Rapporter";
import Integrationer from "./pages/Integrationer";

const App = () => {
  return (
    <HashRouter>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background text-foreground">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-12 items-center border-b border-border md:hidden">
              <SidebarTrigger className="ml-2" />
              <span className="ml-2 font-display text-lg text-foreground">Skogskoll</span>
            </header>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/index" element={<Index />} />
              <Route path="/bokforing" element={<Bokforing />} />
              <Route path="/fakturering" element={<Fakturering />} />
              <Route path="/skogsbruksplan" element={<Skogsbruksplan />} />
              <Route path="/prognoser" element={<Prognoser />} />
              <Route path="/skatteplanering" element={<Skatteplanering />} />
              <Route path="/rapporter" element={<Rapporter />} />
              <Route path="/integrationer" element={<Integrationer />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </SidebarProvider>
    </HashRouter>
    <Toaster position="top-right" />
    </>
  );
};

export default App;
