import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

/**
 * MSW's minimal runnable surface. Typed structurally rather than imported so the
 * fallback below does not depend on internals that may move between versions.
 */
interface RunnableHandler {
  run(args: { request: Request; requestId: string }): Promise<{ response?: Response } | null>;
}

/**
 * The patched fetch has to survive module reloads. A hot update re-evaluates
 * this file with a fresh set of handlers, and without somewhere outside the
 * module to keep the original fetch, each reload would wrap the previous
 * wrapper until the stack ran out.
 */
interface MockGlobals {
  __prayogOriginalFetch?: typeof window.fetch;
  __prayogHandlers?: RunnableHandler[];
  __prayogFallbackInstalled?: boolean;
}

const globals = window as unknown as Window & MockGlobals;

function requestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/**
 * Some embedded and sandboxed browsers refuse to register a service worker.
 * Rather than showing a blank page, the same handlers are run against a patched
 * fetch. The API behaves identically; only the interception point moves.
 */
function startFetchFallback(): void {
  globals.__prayogHandlers = handlers as unknown as RunnableHandler[];
  if (globals.__prayogFallbackInstalled) return;

  globals.__prayogFallbackInstalled = true;
  const original = globals.__prayogOriginalFetch ?? window.fetch.bind(window);
  globals.__prayogOriginalFetch = original;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input as RequestInfo, init);
    const url = new URL(request.url, window.location.origin);

    if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
      for (const handler of globals.__prayogHandlers ?? []) {
        const result = await handler.run({ request: request.clone(), requestId: requestId() });
        if (result?.response) return result.response;
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: `No mock handler matches ${url.pathname}.` },
          servedAt: new Date().toISOString(),
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return original(input as RequestInfo, init);
  };
}

/**
 * Start the mock API.
 *
 * The patched fetch goes in FIRST, unconditionally, and that ordering is the
 * whole point.
 *
 * This used to start the service worker, probe `/api/health` to see whether it
 * was really intercepting, and only fall back to fetch if the probe failed.
 * The probe is not a reliable answer. A worker can pass it and still drop the
 * next request a few milliseconds later, while it is finishing activation —
 * so the first screen of the session got `index.html` back, `JSON.parse` threw,
 * and the sign-in page reported "The mock API has not started yet" over an
 * empty account list. A reload fixed it, which is not something a demonstration
 * should ever ask of anyone.
 *
 * Installing the patch first removes the race instead of timing it. Every
 * `/api/*` call is answered in the page, by the same handlers, before it can
 * reach the network at all. There is no window in which the app is running and
 * the mock API is not.
 *
 * The worker still starts, and is still worth starting: it is what a request
 * made outside this app's fetch wrapper would meet, and it keeps the network
 * panel honest. It is simply no longer load-bearing.
 */
export async function startMockApi(): Promise<void> {
  startFetchFallback();

  try {
    await worker.start({
      onUnhandledRequest: 'bypass',
      quiet: true,
      serviceWorker: { url: '/mockServiceWorker.js' },
    });
  } catch (error) {
    // Some embedded and sandboxed browsers refuse to register one at all. The
    // patch above already has the app covered, so this is a note, not a fault.
    console.warn('[prayog] Service worker unavailable; the mock API is running through fetch.', error);
  }
}

// Editing a handler replaces this module but not the running interceptor, which
// would leave the app talking to a server that no longer exists. Re-arm both
// paths with the new handlers instead of making the developer reload.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    globals.__prayogHandlers = handlers as unknown as RunnableHandler[];
    worker.resetHandlers(...handlers);
    void startMockApi();
  });
}
