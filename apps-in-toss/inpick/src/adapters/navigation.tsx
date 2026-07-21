import {
  createElement,
  forwardRef,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
} from "react";

const NAVIGATION_EVENT = "inpick:toss:navigation";

export function getCurrentMiniAppPath(): string {
  if (typeof window === "undefined") return "/workflow";
  const path = window.location.pathname;
  return path === "/" || path.endsWith("/index.html") ? "/workflow" : path;
}

export function navigateMiniApp(href: string, replace = false) {
  if (typeof window === "undefined") return;
  const target = new URL(href, window.location.href);
  const next = `${target.pathname}${target.search}${target.hash}`;
  if (replace) window.history.replaceState({}, "", next);
  else window.history.pushState({}, "", next);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
  window.scrollTo({ top: 0 });
}

export function subscribeMiniAppNavigation(listener: (path: string) => void) {
  const update = () => listener(getCurrentMiniAppPath());
  window.addEventListener("popstate", update);
  window.addEventListener(NAVIGATION_EVENT, update);
  return () => {
    window.removeEventListener("popstate", update);
    window.removeEventListener(NAVIGATION_EVENT, update);
  };
}

/** Captures plain `<a href="/...">` links used by the shared Next UI. */
export function installMiniAppAnchorBridge() {
  const onClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor || anchor.target === "_blank") return;
    const href = anchor.getAttribute("href") || "";
    if (!href.startsWith("/")) return;
    event.preventDefault();
    navigateMiniApp(href);
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}

export function useRouter() {
  return {
    push: (href: string) => navigateMiniApp(href),
    replace: (href: string) => navigateMiniApp(href, true),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.dispatchEvent(new Event(NAVIGATION_EVENT)),
    prefetch: async () => undefined,
  };
}

export function usePathname() {
  const [path, setPath] = useState(getCurrentMiniAppPath);
  useEffect(() => subscribeMiniAppNavigation(setPath), []);
  return path;
}

export function useSearchParams() {
  const [search, setSearch] = useState(() => window.location.search);
  useEffect(
    () => subscribeMiniAppNavigation(() => setSearch(window.location.search)),
    [],
  );
  return new URLSearchParams(search);
}

export const Link = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>(function Link({ href, onClick, target, ...props }, ref) {
  return createElement("a", {
    ...props,
    ref,
    href,
    target,
    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (
        event.defaultPrevented ||
        target === "_blank" ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        !href.startsWith("/")
      ) {
        return;
      }
      event.preventDefault();
      navigateMiniApp(href);
    },
  });
});

export default Link;
