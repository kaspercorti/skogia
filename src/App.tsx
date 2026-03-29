import AppSidebar from "@/components/AppSidebar";
import Index from "./pages/Index";

const App = () => {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar />
      <Index />
    </div>
  );
};

export default App;
