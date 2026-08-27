"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  isNavigationItemActive,
  navigationItems,
} from "./navigation-items";

export function DashboardNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLElement>(null);
  const allowedPermissions = new Set(permissions);

  useEffect(() => {
    const activeItem =
      navigationRef.current?.querySelector<HTMLElement>(
        '[aria-current="page"]',
      );

    activeItem?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [pathname]);

  return (
    <nav
      ref={navigationRef}
      className="orbiq-nav"
      aria-label="Navegação principal"
      tabIndex={0}
    >
      {navigationItems
        .filter((item) => allowedPermissions.has(item.permission))
        .map((item) => {
          const active = isNavigationItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`orbiq-nav-item${active ? " is-active" : ""}`}
            >
              <span className="orbiq-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
    </nav>
  );
}
