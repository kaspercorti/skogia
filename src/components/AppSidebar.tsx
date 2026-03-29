import { useState } from "react";
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
  { icon: LayoutDashboard, label: "Översikt", active: true },
  { icon: BookOpen, label: "Bokföring" },
  { icon: FileText, label: "Fakturering" },
  { icon: TreePine, label: "Skogsbruksplan" },
  { icon: TrendingUp, label: "Prognoser" },
  { icon: Calculator, label: "Skatteplanering" },
  { icon: BarChart3, label: "Rapporter" },
  { icon: Link, label: "Integrationer" },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : true
  );

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
        <TreePine className="h-7 w-7 shrink-0 text-sidebar-primary" />
        {!collapsed && (
          <span className="font-display text-xl tracking-wide text-sidebar-accent-foreground">
            Skogskoll
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              item.active
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex h-12 items-center justify-center border-t border-sidebar-border text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}

