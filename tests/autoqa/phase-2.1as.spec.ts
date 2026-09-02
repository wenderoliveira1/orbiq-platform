import { expect, test } from "@playwright/test";

async function installWaitingWorkerMock(page: Parameters<typeof test>[0]["page"]) {
  await page.addInitScript(() => {
    const messages: unknown[] = [];
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    const waitingWorker = {
      postMessage(message: unknown) {
        messages.push(message);
      },
    };
    const registration = {
      scope: `${location.origin}/`,
      updateViaCache: "none",
      waiting: waitingWorker,
      installing: null,
      update: async () => undefined,
      addEventListener(type: string, listener: (...args: unknown[]) => void) {
        const bucket = listeners.get(type) ?? new Set();
        bucket.add(listener);
        listeners.set(type, bucket);
      },
      removeEventListener(type: string, listener: (...args: unknown[]) => void) {
        listeners.get(type)?.delete(listener);
      },
    };
    const serviceWorker = {
      controller: {},
      ready: Promise.resolve(registration),
      register: async () => registration,
      getRegistration: async () => registration,
      addEventListener(type: string, listener: (...args: unknown[]) => void) {
        const bucket = listeners.get(`sw:${type}`) ?? new Set();
        bucket.add(listener);
        listeners.set(`sw:${type}`, bucket);
      },
      removeEventListener(type: string, listener: (...args: unknown[]) => void) {
        listeners.get(`sw:${type}`)?.delete(listener);
      },
    };

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorker,
    });

    Object.defineProperty(window, "__orbiqPwaTest", {
      configurable: true,
      value: { messages },
    });
  });
}

test.describe("Fase 2.1AS - UX de atualização do PWA em runtime", () => {
  test("oferece atualização disponível sem recarregar antes da confirmação", async ({
    page,
  }) => {
    await installWaitingWorkerMock(page);
    await page.goto("/instalar");

    await expect(page.locator("[data-orbiq-pwa-update]")).toBeVisible();
    await expect(page.getByText("Nova versão disponível")).toBeVisible();
    await expect(page.getByRole("button", { name: "Depois" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Atualizar agora" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Depois" }).click();
    await expect(page.locator("[data-orbiq-pwa-update]")).toHaveCount(0);

    const messages = await page.evaluate(
      () =>
        (
          window as unknown as {
            __orbiqPwaTest?: { messages: unknown[] };
          }
        ).__orbiqPwaTest?.messages ?? [],
    );
    expect(messages).toEqual([]);
  });

  test("envia somente o comando de ativação quando o usuário confirma", async ({
    page,
  }) => {
    await installWaitingWorkerMock(page);
    await page.goto("/instalar");

    await page.getByRole("button", { name: "Atualizar agora" }).click();

    await expect(page.getByText("Atualizando Orbiq")).toBeVisible();
    await expect(page.getByRole("button", { name: "Depois" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Atualizar agora" }),
    ).toHaveCount(0);

    const messages = await page.evaluate(
      () =>
        (
          window as unknown as {
            __orbiqPwaTest?: { messages: unknown[] };
          }
        ).__orbiqPwaTest?.messages ?? [],
    );
    expect(messages).toEqual([{ type: "ORBIQ_SKIP_WAITING" }]);
    expect(page.url()).toContain("/instalar");
  });
});
