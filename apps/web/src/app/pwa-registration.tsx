"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistration("/")
        .then((registration) => {
          if (registration?.active?.scriptURL.endsWith("/sw.js")) {
            return registration.unregister();
          }
        })
        .catch(() => {
          // O ambiente de desenvolvimento continua sem depender do registro.
        });

      return;
    }

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .catch(() => {
          // Registro progressivo: a aplicação online continua funcional.
        });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
