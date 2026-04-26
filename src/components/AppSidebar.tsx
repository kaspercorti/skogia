import {
  LayoutDashboard, BookOpen, FileText, TreePine, TrendingUp, Calculator, BarChart3, Link, LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { icon: LayoutDashboard, label: "Översikt", url: "/" },
  { icon: BookOpen, label: "Bokföring", url: "/bokforing" },
  { icon: FileText, label: "Fakturering", url: "/fakturering" },
  { icon: TreePine, label: "Skogsbruksplan", url: "/skogsbruksplan" },
  { icon: TrendingUp, label: "Prognoser", url: "/prognoser" },
  { icon: Calculator, label: "Skatteplanering", url: "/skatteplanering" },
  { icon: BarChart3, label: "Rapporter", url: "/rapporter" },
  { icon: Link, label: "Integrationer", url: "/integrationer" },
];

export default function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();
  const isMobile = useIsMobile();

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4 pt-[calc(var(--app-safe-top)+1rem)]">
        <div className="flex items-center gap-2">
          <TreePine className="h-7 w-7 shrink-0 text-sidebar-primary" />
          {!collapsed && <span className="font-display text-xl tracking-wide text-sidebar-accent-foreground">Skogia</span>}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} end>
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && user && (
          <p className="text-xs text-sidebar-foreground/60 truncate mb-2 px-1">{user.email}</p>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          {!collapsed && "Logga ut"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
