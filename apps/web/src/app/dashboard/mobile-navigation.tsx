"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { signOutAction, switchOrganizationAction } from "./actions";
import {
  isNavigationItemActive,
  navigationItems,
  NAVIGATION_GROUPS,
} from "./navigation-items";
import { OrganizationSwitcher } from "./organization-switcher";

import styles from "./mobile-navigation.module.css";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "select:not([disabled])",
  "input:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type OrganizationOption = {
  id: string;
  name: string;
  role: string;
};

type MobileNavigationProps = {
  currentOrganizationId: string;
  currentOrganizationName: string;
  organizations: OrganizationOption[];
  permissions: string[];
  userEmail: string;
};

export function MobileNavigation({
  currentOrganizationId,
  currentOrganizationName,
  organizations,
  permissions,
  userEmail,
}: MobileNavigationProps) {
  const pathname = usePathname();
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const dialogTitleId = useId();
  const dialogId = useId();
  const open = openedAtPath === pathname;
  const allowedPermissions = new Set(permissions);
  const allowedItems = navigationItems.filter((item) =>
    allowedPermissions.has(item.permission),
  );
  const shortcutItems = allowedItems.filter((item) => item.shortcut);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setOpenedAtPath(null);
      window.requestAnimationFrame(() => openerRef.current?.focus());
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function closeAndRestoreFocus() {
    setOpenedAtPath(null);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }

  function openMenu(trigger: HTMLButtonElement) {
    openerRef.current = trigger;
    setOpenedAtPath(pathname);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") {
      return;
    }

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    );

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);

    if (!first || !last) {
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link
          href="/dashboard"
          className={styles.brandMark}
          aria-label="Orbiq — visão geral"
        >
          O
        </Link>

        <div className={styles.headerIdentity}>
          <strong>Orbiq</strong>
          <span>{currentOrganizationName}</span>
        </div>

        <button
          ref={triggerRef}
          type="button"
          className={styles.menuTrigger}
          aria-controls={dialogId}
          aria-expanded={open}
          aria-label="Abrir menu principal"
          onClick={(event) => openMenu(event.currentTarget)}
        >
          <span aria-hidden="true">☰</span>
        </button>
      </header>

      <nav className={styles.dock} aria-label="Atalhos móveis">
        {shortcutItems.map((item) => {
          const active = isNavigationItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.dockItem} ${active ? styles.active : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              <small>{item.label}</small>
            </Link>
          );
        })}

        <button
          type="button"
          className={`${styles.dockItem} ${open ? styles.active : ""}`}
          aria-label="Abrir menu completo"
          aria-expanded={open}
          aria-controls={dialogId}
          onClick={(event) => openMenu(event.currentTarget)}
        >
          <span aria-hidden="true">☰</span>
          <small>Menu</small>
        </button>
      </nav>

      {open ? (
        <div className={styles.overlay}>
          <button
            type="button"
            className={styles.backdrop}
            tabIndex={-1}
            aria-label="Fechar menu"
            onClick={closeAndRestoreFocus}
          />

          <section
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className={styles.drawer}
            onKeyDown={handleDialogKeyDown}
          >
            <div className={styles.drawerHeader}>
              <div>
                <span className={styles.eyebrow}>NAVEGAÇÃO</span>
                <h2 id={dialogTitleId}>Menu principal</h2>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeButton}
                aria-label="Fechar menu principal"
                onClick={closeAndRestoreFocus}
              >
                ×
              </button>
            </div>

            <div className={styles.organization}>
              <OrganizationSwitcher
                organizations={organizations}
                currentOrganizationId={currentOrganizationId}
                action={switchOrganizationAction}
              />
            </div>

            <nav className={styles.navigation} aria-label="Navegação principal">
              {NAVIGATION_GROUPS.map((group) => {
                const groupedItems = allowedItems.filter(
                  (item) => item.group === group,
                );

                if (groupedItems.length === 0) {
                  return null;
                }

                return (
                  <section key={group} className={styles.group}>
                    <h3>{group}</h3>

                    <div>
                      {groupedItems.map((item) => {
                        const active = isNavigationItemActive(
                          pathname,
                          item.href,
                        );

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={`${styles.navigationItem} ${
                              active ? styles.active : ""
                            }`}
                            onClick={() => setOpenedAtPath(null)}
                          >
                            <span aria-hidden="true">{item.icon}</span>
                            <strong>{item.label}</strong>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </nav>

            <footer className={styles.drawerFooter}>
              <Link href="/instalar" className={styles.install}>
                <span aria-hidden="true">⇩</span>
                <strong>Instalar aplicativo</strong>
              </Link>

              <div className={styles.user}>
                <span className={styles.avatar} aria-hidden="true">
                  {(userEmail[0] ?? "U").toUpperCase()}
                </span>
                <div>
                  <strong>{userEmail}</strong>
                  <small>Sessão protegida</small>
                </div>
              </div>

              <form action={signOutAction}>
                <button type="submit" className={styles.signOut}>
                  Sair do Orbiq
                </button>
              </form>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
