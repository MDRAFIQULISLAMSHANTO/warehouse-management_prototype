/**
 * Application shell: the Odoo navbar, app menus, notification stack, the
 * "illustrative demo data" indicator and Reset Demo.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { IconClose, IconRefresh, IconWarning } from "@/odoo/icons";
import { Dialog, Dropdown, MenuItem, MenuTitle } from "@/odoo/primitives";
import { useAppStore } from "@/store/appStore";
import { GuidedDemo } from "./GuidedDemo";
import { MENUS } from "./menu";

/** The four-square application mark of the current Odoo backend. */
function AppMark() {
  return (
    <span
      aria-hidden
      className="grid shrink-0"
      style={{ width: 20, height: 20, gap: 2, gridTemplateColumns: "1fr 1fr" }}
    >
      <i style={{ background: "var(--o-brand-primary)", borderRadius: 2 }} />
      <i style={{ background: "var(--o-action)", borderRadius: 2 }} />
      <i style={{ background: "var(--o-series-4)", borderRadius: 2 }} />
      <i style={{ background: "var(--o-series-3)", borderRadius: 2 }} />
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const notifications = useAppStore((s) => s.notifications);
  const dismissNotification = useAppStore((s) => s.dismissNotification);
  const bannerDismissed = useAppStore((s) => s.bannerDismissed);
  const dismissBanner = useAppStore((s) => s.dismissBanner);
  const resetDemo = useAppStore((s) => s.resetDemo);
  const [confirmReset, setConfirmReset] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Keep the page scrolled to the top when moving between screens, the way a
  // fresh Odoo action does.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--o-webclient-bg)]">
      <nav className="o-navbar flex items-center gap-1 px-3 o-no-print">
        <Link
          to="/"
          className="flex items-center gap-2 pr-3 no-underline shrink-0"
          style={{ color: "inherit" }}
          title="Ispahani Warehouse Management"
        >
          <AppMark />
          <span className="font-medium text-[var(--o-fs-base)] whitespace-nowrap">
            Ispahani Warehouse Management
          </span>
        </Link>

        {/* No scroll container here: an `overflow` ancestor would clip the
            portalled menu panels on some browsers' focus scrolling. The menus
            wrap out of view below `lg` instead, where the compact menu opens. */}
        <div className="hidden lg:flex items-center gap-0.5 min-w-0">
          {MENUS.map((menu) => (
            <Dropdown
              key={menu.id}
              label={<span>{menu.label}</span>}
              buttonClassName="o-navbar-item"
              active={menu.sections.some((section) =>
                section.entries.some(
                  (entry) => location.pathname === entry.to.split("?")[0],
                ),
              )}
              width={300}
            >
              {(close) => (
                <>
                  {menu.sections.map((section, i) => (
                    <div key={section.title ?? i}>
                      {section.title && <MenuTitle>{section.title}</MenuTitle>}
                      {section.entries.map((entry) => (
                        <MenuItem
                          key={entry.to}
                          title={entry.hint}
                          selected={location.pathname === entry.to.split("?")[0]}
                          onClick={() => {
                            navigate(entry.to);
                            close();
                          }}
                        >
                          {entry.label}
                        </MenuItem>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </Dropdown>
          ))}
        </div>

        {/* Below lg the whole application menu collapses into one panel so
            nothing is ever pushed off the bar. */}
        <div className="lg:hidden">
          <Dropdown
            label={<span>Menu</span>}
            buttonClassName="o-navbar-item"
            width={300}
          >
            {(close) => (
              <>
                {MENUS.map((menu) => (
                  <div key={menu.id}>
                    <MenuTitle>{menu.label}</MenuTitle>
                    {menu.sections.flatMap((section) =>
                      section.entries.map((entry) => (
                        <MenuItem
                          key={entry.to}
                          title={entry.hint}
                          selected={location.pathname === entry.to.split("?")[0]}
                          onClick={() => {
                            navigate(entry.to);
                            close();
                          }}
                        >
                          {entry.label}
                        </MenuItem>
                      )),
                    )}
                  </div>
                ))}
              </>
            )}
          </Dropdown>
        </div>

        <div className="ml-auto flex items-center gap-2 whitespace-nowrap">
          <span
            className="hidden xl:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--o-radius-pill)] text-[var(--o-fs-xxs)] text-[var(--o-warning-text)]"
            style={{ background: "var(--o-tile-amber)" }}
            title="Every figure in this prototype comes from a generated demonstration dataset. It is not Ispahani stock data."
          >
            <IconWarning size={10} />
            Illustrative demo data
          </span>
          <button
            type="button"
            className="o-navbar-item"
            onClick={() => setConfirmReset(true)}
            title="Restore the seeded demonstration data"
          >
            <IconRefresh size={12} />
            <span className="hidden lg:inline">Reset Demo</span>
          </button>
          <span className="hidden md:inline text-[var(--o-fs-sm)] text-[var(--o-navbar-fg)]">
            Ispahani Tea Limited
          </span>
          <span
            className="flex items-center justify-center rounded-full text-[var(--o-fs-xs)] font-medium text-white shrink-0"
            style={{ width: 28, height: 28, background: "var(--o-action)" }}
            title="Invento Software Limited - demonstration user"
          >
            IS
          </span>
        </div>
      </nav>

      {!bannerDismissed && (
        <div className="flex items-center gap-3 px-4 py-1.5 bg-[var(--o-warning-bg)] border-b border-[var(--o-border)] text-[var(--o-fs-xs)] o-no-print">
          <IconWarning size={12} className="text-[var(--o-warning-text)]" />
          <span>
            <strong>Presales prototype.</strong> Stock, lots, pallets, operators
            and partners are generated demonstration data, not Ispahani records.
            Warehouse capacities come from the supplied MinMax drawings; floor
            plans are schematic.
          </span>
          <Link to="/about/assumptions" className="whitespace-nowrap">
            What is assumed?
          </Link>
          <button
            type="button"
            className="o-btn o-btn-ghost o-btn-sm ml-auto"
            onClick={dismissBanner}
            aria-label="Dismiss notice"
          >
            <IconClose size={11} />
          </button>
        </div>
      )}

      {/* Bottom padding keeps the floating guided-demo trigger clear of page
          content, including in full-page screenshots. */}
      <main className="flex-1 min-w-0 flex flex-col pb-14">{children}</main>

      <GuidedDemo />

      <div
        className="fixed right-4 bottom-4 flex flex-col gap-2 o-no-print"
        style={{ zIndex: 1100, width: 340 }}
      >
        {notifications.map((notification) => (
          <div
            key={notification.id}
            role="status"
            className="o-popover px-3 py-2 flex items-start gap-2 text-[var(--o-fs-sm)]"
            style={{
              borderLeft: `3px solid ${toneColor(notification.tone)}`,
            }}
          >
            <span className="flex-1">{notification.message}</span>
            <button
              type="button"
              className="o-btn o-btn-ghost o-btn-sm"
              onClick={() => dismissNotification(notification.id)}
              aria-label="Dismiss"
            >
              <IconClose size={10} />
            </button>
          </div>
        ))}
      </div>

      {confirmReset && (
        <Dialog
          title="Reset demonstration data"
          width={460}
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button
                type="button"
                className="o-btn o-btn-secondary"
                onClick={() => setConfirmReset(false)}
              >
                Keep current state
              </button>
              <button
                type="button"
                className="o-btn o-btn-primary"
                onClick={() => {
                  resetDemo();
                  setConfirmReset(false);
                }}
              >
                Reset to seeded data
              </button>
            </>
          }
        >
          <p className="text-[var(--o-fs-sm)] m-0">
            This discards every operation validated, cancelled or created during
            this session and restores the seeded dataset. Saved favourites are
            kept.
          </p>
        </Dialog>
      )}
    </div>
  );
}

function toneColor(tone: string): string {
  switch (tone) {
    case "success":
      return "var(--o-success)";
    case "warning":
      return "var(--o-warning)";
    case "danger":
      return "var(--o-danger)";
    default:
      return "var(--o-action)";
  }
}
