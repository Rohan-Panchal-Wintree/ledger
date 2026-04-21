import {
  LayoutDashboard,
  Upload,
  Users,
  LogOut,
  FileBarChart,
  User,
  Shield,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "./UI/Sidebar";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser, selectCurrentUser } from "../store/slices/Auth.slice";

export function AppSidebar() {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectCurrentUser);

  const { open } = useSidebar();

  const sidebarItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      show: true,
    },
    {
      name: "Reports",
      icon: FileBarChart,
      path: "/reports",
      show: true,
    },
    {
      name: "Upload",
      icon: Upload,
      path: "/upload",
      show: currentUser?.role === "admin",
    },
    {
      name: "Manage Emails",
      icon: Users,
      path: "/manage-emails",
      show: currentUser?.role === "admin",
    },
    {
      name: "Profile",
      icon: User,
      path: "/profile",
      show: true,
    },
  ];

  const visibleItems = sidebarItems.filter((item) => item.show);

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
            <Shield className="h-4 w-4" />
          </div>

          {open && (
            <div className="min-w-0">
              <p className="text-md font-semibold tracking-tight text-on-surface">
                PayGate
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-5">
        <SidebarGroup>
          {/* <SidebarGroupLabel>Navigation</SidebarGroupLabel> */}

          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.path}>
                    <NavLink to={item.path}>
                      {({ isActive }) => (
                        <SidebarMenuButton isActive={isActive}>
                          <Icon className="h-4 w-4 shrink-0" />
                          {open && (
                            <span className="truncate">{item.name}</span>
                          )}
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-outline-variant/20 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-surface-container-low p-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
            {currentUser?.email?.[0]?.toUpperCase() || "U"}
          </div>

          {open && (
            <>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-xs font-medium text-on-surface"
                  title={currentUser?.email}
                >
                  {currentUser?.email}
                </p>
                <p className="text-xs capitalize text-on-surface-variant">
                  {currentUser?.role}
                </p>
              </div>

              <button
                onClick={() => dispatch(logoutUser())}
                className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
