import React from "react";
import { PanelLeft } from "lucide-react";

const SidebarContext = React.createContext(null);

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function useSidebar() {
  const context = React.useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

function SidebarProvider({ children, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen);

  const toggleSidebar = () => {
    setOpen((prev) => !prev);
  };

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggleSidebar }}>
      <div className="flex h-full w-full">{children}</div>
    </SidebarContext.Provider>
  );
}

function Sidebar({ children, className = "", ...props }) {
  const { open } = useSidebar();

  return (
    <aside
      className={cn(
        "h-full shrink-0 border-r border-outline-variant/20 bg-surface-container-lowest text-on-surface transition-all duration-300 ease-in-out",
        open ? "w-56 md:w-64" : "w-[72px]",
        className,
      )}
      {...props}
    >
      <div className="flex h-full flex-col overflow-hidden">{children}</div>
    </aside>
  );
}

function SidebarTrigger({ className = "", ...props }) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container-low",
        className,
      )}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
}

function SidebarHeader({ children, className = "", ...props }) {
  return (
    <div
      className={cn("border-b border-outline-variant/20 p-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function SidebarContent({ children, className = "", ...props }) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto px-2 py-4 md:py-5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function SidebarFooter({ children, className = "", ...props }) {
  return (
    <div
      className={cn("border-t border-outline-variant/20 px-3 py-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function SidebarGroup({ children, className = "", ...props }) {
  return (
    <div className={cn("mb-5 md:mb-6", className)} {...props}>
      {children}
    </div>
  );
}

function SidebarGroupLabel({ children, className = "", ...props }) {
  const { open } = useSidebar();

  return (
    <div
      className={cn(
        "mb-2 px-2 text-xs font-medium uppercase tracking-wide text-on-surface-variant",
        !open && "hidden",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function SidebarGroupContent({ children, className = "", ...props }) {
  return (
    <div className={cn("space-y-1", className)} {...props}>
      {children}
    </div>
  );
}

function SidebarMenu({ children, className = "", ...props }) {
  return (
    <ul className={cn("space-y-1", className)} {...props}>
      {children}
    </ul>
  );
}

function SidebarMenuItem({ children, className = "", ...props }) {
  return (
    <li className={cn("list-none", className)} {...props}>
      {children}
    </li>
  );
}

function SidebarMenuButton({
  children,
  className = "",
  isActive = false,
  ...props
}) {
  const { open } = useSidebar();

  return (
    <button
      className={cn(
        "flex w-full items-center rounded-lg text-sm transition-colors",
        open ? "justify-start gap-4 px-3 py-2.5" : "justify-center p-2.5",
        isActive
          ? "bg-primary text-white"
          : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function SidebarSeparator({ className = "", ...props }) {
  return (
    <div
      className={cn("my-3 h-px bg-outline-variant/20", className)}
      {...props}
    />
  );
}

function SidebarInset({ children, className = "", ...props }) {
  return (
    <main className={cn("flex-1 bg-background", className)} {...props}>
      {children}
    </main>
  );
}

function SidebarRail({ className = "", ...props }) {
  return <div className={cn("hidden", className)} {...props} />;
}

function SidebarInput({ className = "", ...props }) {
  return (
    <input
      className={cn(
        "w-full rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/15",
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroupAction({ children, className = "", ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function SidebarMenuAction({ children, className = "", ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function SidebarMenuBadge({ children, className = "", ...props }) {
  return (
    <span
      className={cn(
        "ml-auto rounded-full bg-surface-container-low px-2 py-0.5 text-xs text-on-surface-variant",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

function SidebarMenuSub({ children, className = "", ...props }) {
  const { open } = useSidebar();

  if (!open) return null;

  return (
    <ul
      className={cn(
        "ml-4 mt-1 space-y-1 border-l border-outline-variant/20 pl-3",
        className,
      )}
      {...props}
    >
      {children}
    </ul>
  );
}

function SidebarMenuSubItem({ children, className = "", ...props }) {
  return (
    <li className={cn("list-none", className)} {...props}>
      {children}
    </li>
  );
}

function SidebarMenuSubButton({
  children,
  className = "",
  isActive = false,
  ...props
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        isActive
          ? "bg-surface-container text-on-surface"
          : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
