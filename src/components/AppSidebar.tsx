import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  TreePine,
  TrendingUp,
  Calculator,
  BarChart3,
  Link,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Översikt", path: "/" },
  { icon: BookOpen, label: "Bokföring", path: "/bokforing" },
  { icon: FileText, label: "Fakturering", path: "/fakturering" },
  { icon: TreePine, label: "Skogsbruksplan", path: "/skog" },
  { icon: TrendingUp, label: "Prognoser", path: "/prognoser" },
  { icon: Calculator, label: "Skatteplanering", path: "/skatt" },
  { icon: BarChart3, label: "Rapporter", path: "/rapporter" },
  { icon: Link, label: "Integrationer", path: "/integrationer" },
];

export default function AppSidebar() {
  const isMobile = window.innerWidth < 768;
  const [collapsed, setCollapsed] = useState(isMobile);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 h-screen sticky top-0",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-sidebar-border">
        <TreePine className="h-7 w-7 text-sidebar-primary shrink-0" />
        {!collapsed && (
          <span className="font-display text-xl text-sidebar-accent-foreground tracking-wide">
            Skogskoll
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
