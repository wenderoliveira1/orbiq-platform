import { expect, test, type Page } from "@playwright/test";

async function installWaitingWorkerMock(page: Page) {
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

    ServiceWorkerContainer.prototype.register = async () => registration as unknown as ServiceWorkerRegistration;

    Object.defineProperty(window, "__orbiqPwaTest", {
      configurable: true,
      value: {
        messages,
        dispatch(type: string) {
          for (const listener of listeners.get(type) ?? []) listener();
        },
      },
    });
  });
}

test.describe("Fase 2.1AT - resiliência da atualização do PWA", () => {
  test("não recarrega antes do controllerchange e envia um único comando", async ({
    page,
  }) => {
    await installWaitingWorkerMock(page);
    await page.goto("/instalar");

    await page.getByRole("button", { name: "Atualizar agora" }).click();
    await expect(page.getByText("Atualizando Orbiq")).toBeVisible();

    const messagesBeforeControllerChange = await page.evaluate(
      () =>
        (
          window as unknown as {
            __orbiqPwaTest?: { messages: unknown[] };
          }
        ).__orbiqPwaTest?.messages ?? [],
    );
    expect(messagesBeforeControllerChange).toEqual([
      { type: "ORBIQ_SKIP_WAITING" },
    ]);
    expect(page.url()).toContain("/instalar");

    await page.evaluate(() => {
      (
        window as unknown as {
          __orbiqPwaTest?: { dispatch: (type: string) => void };
        }
      ).__orbiqPwaTest?.dispatch("controllerchange");
    });
  });

  test("libera a interface após timeout e oferece nova tentativa", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await installWaitingWorkerMock(page);
    await page.goto("/instalar");

    await page.getByRole("button", { name: "Atualizar agora" }).click();
    await expect(page.getByText("Atualizando Orbiq")).toBeVisible();
    await expect(
      page.getByText("Não foi possível atualizar agora"),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: "Tentar novamente" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByText("Nova versão disponível")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Atualizar agora" }),
    ).toBeVisible();
  });

  test("mantém a proteção de não cachear APIs no service worker", async ({
    page,
  }) => {
    await page.goto("/instalar");
    const source = await page.evaluate(async () =>
      fetch("/sw.js", { cache: "no-store" }).then((response) => response.text()),
    );

    expect(source).toContain('if (request.method !== "GET")');
    expect(source).not.toContain('caches.match(request.url)');
    expect(source).toContain('const SKIP_WAITING_MESSAGE = "ORBIQ_SKIP_WAITING"');
  });
});
