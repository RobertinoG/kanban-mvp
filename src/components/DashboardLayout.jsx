import React from "react";
import { IconKanban, IconChart, IconHistory, IconDollar, IconLogout } from "./icons";

const NAV = [
  { key: "kanban", label: "Kanban", icon: IconKanban },
  { key: "costs", label: "Costos", icon: IconDollar },
  { key: "analysis", label: "Análisis", icon: IconChart },
  { key: "history", label: "Historial", icon: IconHistory },
];

export default function DashboardLayout({
  brand = "Kanban MVP",
  role,
  active,
  allowedTabs,
  onNavigate,
  onLogout,
  title,
  children,
  rightSlot,
}) {
  const navItems = Array.isArray(allowedTabs)
    ? NAV.filter((n) => allowedTabs.includes(n.key))
    : NAV;

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <div className="brandMark">K</div>
          <div className="brandText">
            <div className="brandName">{brand}</div>
            <div className="brandSub">Gestión operativa</div>
          </div>
        </div>

        <nav className="sidebarNav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                className={`navItem ${isActive ? "navItemActive" : ""}`}
                onClick={() => onNavigate?.(item.key)}
                type="button"
              >
                <span className="navIcon" aria-hidden>
                  <Icon size={18} />
                </span>
                <span className="navLabel">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebarFooter">
          <div className="rolePill" title="Rol activo">
            Rol: <b>{role || "—"}</b>
          </div>
          <button className="btn btnGhost btnFull" type="button" onClick={onLogout}>
            <span className="btnIcon" aria-hidden>
              <IconLogout size={18} />
            </span>
            Salir
          </button>
        </div>
      </aside>

      <main className="appContent">
        <header className="appTopbar">
          <div>
            <div className="pageTitle">{title}</div>
            <div className="pageSubtitle">Operación en tiempo real</div>
          </div>
          <div className="appTopbarRight">{rightSlot}</div>
        </header>
        <div className="contentInner">{children}</div>
      </main>
    </div>
  );
}
