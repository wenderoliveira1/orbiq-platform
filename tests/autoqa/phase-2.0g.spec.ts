import { expect, test } from "@playwright/test";

test.describe("Fase 2.0G - atualizações seguras do PWA", () => {
  test("mantém a nova versão aguardando confirmação explícita do usuário", async ({
    request,
  }) => {
    const response = await request.get("/sw.js");
    const source = await response.text();

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("javascript");
    expect(source).toContain('const CACHE_NAME = `${CACHE_PREFIX}public-shell-v3`;');
    expect(source).toContain('const SKIP_WAITING_MESSAGE = "ORBIQ_SKIP_WAITING";');
    expect(source).toContain("event.waitUntil(globalThis.skipWaiting());");

    const installStart = source.indexOf('globalThis.addEventListener("install"');
    const activateStart = source.indexOf('globalThis.addEventListener("activate"');
    const installBlock = source.slice(installStart, activateStart);

    expect(installStart).toBeGreaterThanOrEqual(0);
    expect(activateStart).toBeGreaterThan(installStart);
    expect(installBlock).not.toContain("skipWaiting");
  });

  test("avisa sobre atualização e só promove o worker após ação do usuário", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });

    await page.addInitScript(() => {
      const listeners = new Map<string, Set<EventListener>>();
      const registrationListeners = new Map<string, Set<EventListener>>();

      const dispatch = (type: string) => {
        for (const listener of listeners.get(type) ?? []) {
          listener(new Event(type));
        }
      };

      const waitingWorker = {
        postMessage(message: unknown) {
          (
            window as typeof window & {
              __orbiqUpdateMessage?: unknown;
            }
          ).__orbiqUpdateMessage = message;
        },
        state: "installed",
      } as unknown as ServiceWorker;

      const registration = {
        active: {
          scriptURL: `${window.location.origin}/sw.js`,
        },
        addEventListener(type: string, listener: EventListener) {
          const group = registrationListeners.get(type) ?? new Set<EventListener>();
          group.add(listener);
          registrationListeners.set(type, group);
        },
        installing: null,
        update: async () => undefined,
        waiting: waitingWorker,
      } as unknown as ServiceWorkerRegistration;

      const serviceWorkerContainer = {
        addEventListener(type: string, listener: EventListener) {
          const group = listeners.get(type) ?? new Set<EventListener>();
          group.add(listener);
          listeners.set(type, group);
        },
        controller: {} as ServiceWorker,
        getRegistration: async () => registration,
        register: async () => registration,
        removeEventListener(type: string, listener: EventListener) {
          listeners.get(type)?.delete(listener);
        },
      } as unknown as ServiceWorkerContainer;

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: serviceWorkerContainer,
      });

      (
        window as typeof window & {
          __orbiqDispatchControllerChange?: () => void;
        }
      ).__orbiqDispatchControllerChange = () => dispatch("controllerchange");
    });

    await page.goto("/instalar");

    const notice = page.locator("[data-orbiq-pwa-update]");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Nova versão disponível");
    await expect(notice).toContainText(
      "Salve qualquer edição em andamento antes de atualizar.",
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "Atualizar agora" }).click();

    const message = await page.evaluate(
      () =>
        (
          window as typeof window & {
            __orbiqUpdateMessage?: unknown;
          }
        ).__orbiqUpdateMessage,
    );

    expect(message).toEqual({ type: "ORBIQ_SKIP_WAITING" });
    await expect(notice).toContainText("Atualizando Orbiq");
  });
});
