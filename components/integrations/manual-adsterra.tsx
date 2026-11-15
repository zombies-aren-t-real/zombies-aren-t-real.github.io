"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { manualAdsterra } from "@/config/manual-adsterra";
import { legalPages } from "@/content/legal";

let socialLoaded = false;
const LEGAL_PATHS = new Set(legalPages.map((page) => trimSlashes(page.slug)));

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function isLegalPath(pathname: string | null) {
  const clean = trimSlashes(pathname || "");
  if (!clean) return false;
  const tail = clean.split("/").pop() || "";
  return LEGAL_PATHS.has(clean) || LEGAL_PATHS.has(tail);
}

function appendOfficialCode(target: HTMLElement, html: string) {
  const parsed = document.createElement("template");
  parsed.innerHTML = html;
  const scripts: HTMLScriptElement[] = [];

  // Native GET CODE can put its loader BEFORE its container element.
  // First create all markup; only then execute scripts in their original order.
  function mountMarkup(node: Node, parent: Node) {
    if (node instanceof HTMLScriptElement) {
      scripts.push(node);
      return;
    }
    const clone = node.cloneNode(false);
    parent.appendChild(clone);
    for (const child of Array.from(node.childNodes)) mountMarkup(child, clone);
  }
  for (const child of Array.from(parsed.content.childNodes)) mountMarkup(child, target);
  for (const original of scripts) {
    const script = document.createElement("script");
    for (const attr of Array.from(original.attributes)) {
      script.setAttribute(attr.name, attr.value);
    }
    // Preserve explicit async on Native loaders; keep inline Banner options first.
    if (original.hasAttribute("src") && !original.hasAttribute("async")) script.async = false;
    script.text = original.text;
    target.appendChild(script);
  }
}

function adSlot(type: "banner" | "native", height = 0) {
  const slot = document.createElement("div");
  slot.setAttribute("data-manual-adsterra", type);
  slot.setAttribute("aria-label", "Advertisement");
  slot.style.cssText = "width:100%;max-width:100%;margin:20px auto;text-align:center;overflow:hidden;box-sizing:border-box;";
  if (height) slot.style.minHeight = String(height + 24) + "px";
  const label = document.createElement("div");
  label.textContent = "Advertisement";
  label.style.cssText = "font-size:10px;letter-spacing:.06em;opacity:.55;margin-bottom:8px;";
  slot.appendChild(label);
  return slot;
}

function findHero(main: Element) {
  const heading = main.querySelector("h1");
  if (!heading) return null;
  // The top section containing H1 is the Hero; never split its title or CTA.
  const section = heading.closest("section, header");
  return section && main.contains(section) ? section : heading.parentElement;
}

function findFirstContent(main: Element, hero: Element) {
  const sections = Array.from(main.querySelectorAll("section, article"));
  const candidates = sections.filter((section) =>
    section !== hero && !hero.contains(section) &&
    Boolean(hero.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING) &&
    !section.closest("[data-manual-adsterra]") &&
    !section.matches("header, footer, nav")
  );
  // Short factual/meta section is preferred. Otherwise take the first real
  // complete content block, never an empty placeholder or an ad.
  const short = candidates.find((section) =>
    /facts|game.info|meta|summary|overview|stats|quick.info/i.test(String(section.className) + " " + (section.getAttribute("aria-label") || ""))
  );
  return short || candidates.find((section) =>
    ((section.textContent || "").trim().length > 25 || Boolean(section.querySelector("iframe, img, video, table, dl"))) &&
    !section.querySelector("h1")
  ) || null;
}

/** Only https links are ever rendered; anything else (javascript:, data:, http:) means no card. */
function safeSmartlink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname ? url.href : "";
  } catch {
    return "";
  }
}

// A complete guide section: exactly one H2 (not a wrapper of several), real prose, not a facts/sources box.
function isMainSection(section: Element) {
  const label = String(section.className) + " " + (section.getAttribute("aria-label") || "");
  return section.querySelectorAll("h2").length === 1 &&
    (section.textContent || "").trim().length >= 160 &&
    !/facts|game.info|meta|summary|stats|quick.info|source/i.test(label) &&
    !section.closest("nav, aside, footer");
}

/**
 * The section the Smartlink card goes after: the first main section that follows Native
 * (so a guide section separates the two ads), else an earlier one not directly before Native.
 * Null means no suitable place: the card is skipped rather than stacked next to another ad.
 */
function findSmartlinkAnchor(main: Element, hero: Element, native: Element | null) {
  const mains = Array.from(main.querySelectorAll("section, article")).filter((section) =>
    section !== hero && !hero.contains(section) &&
    Boolean(hero.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING) &&
    !section.closest("[data-manual-adsterra]") && !section.querySelector("h1") && isMainSection(section)
  ).filter((section, index, list) => !list.some((other, j) => j < index && other.contains(section)));
  if (!native) return mains[0] || null;
  const before = mains.filter((section) => Boolean(section.compareDocumentPosition(native) & Node.DOCUMENT_POSITION_FOLLOWING)).length;
  return mains[before] || (before >= 2 ? mains[0] : null);
}

function smartlinkCard(href: string) {
  const card = document.createElement("aside");
  card.setAttribute("data-manual-adsterra", "smartlink");
  card.setAttribute("aria-label", "Advertisement");
  card.style.cssText = "width:100%;max-width:100%;margin:24px auto;padding:18px 20px;box-sizing:border-box;border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-left:4px solid var(--accent,hsl(var(--primary,220 70% 55%)));border-radius:12px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 20px;text-align:left;";
  const copy = document.createElement("div");
  copy.style.cssText = "flex:1 1 260px;min-width:0;";
  const label = document.createElement("div");
  label.textContent = "Sponsored · Advertisement";
  label.style.cssText = "font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.7;margin:0 0 6px;";
  const title = document.createElement("p");
  title.textContent = "Explore Sponsored Offers";
  title.style.cssText = "font-size:17px;font-weight:700;line-height:1.35;margin:0 0 4px;";
  const lead = document.createElement("p");
  lead.textContent = "Explore offers from our advertising partners. Opens an external website.";
  lead.style.cssText = "font-size:14px;line-height:1.5;opacity:.8;margin:0;";
  copy.append(label, title, lead);
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "sponsored nofollow noopener noreferrer";
  link.textContent = "View Sponsored Offers ↗";
  link.style.cssText = "flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 18px;border:2px solid currentColor;border-radius:10px;color:inherit;font-weight:700;font-size:15px;text-decoration:none;white-space:nowrap;max-width:100%;box-sizing:border-box;";
  link.addEventListener("click", () => {
    try {
      const tracker = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
      tracker?.("event", "smartlink_click", { placement: "after_first_content", page_path: window.location.pathname, transport_type: "beacon" });
    } catch {
      // Analytics must never block the link.
    }
  });
  card.appendChild(link);
  card.insertBefore(copy, link);
  return card;
}

export function ManualAdsterra() {
  const pathname = usePathname();
  useEffect(() => {
    const code = manualAdsterra;
    if (!code.enabled) return;
    let banner: HTMLElement | null = null;
    let native: HTMLElement | null = null;
    let smartlink: HTMLElement | null = null;
    let frame = 0;
    let media: MediaQueryList | null = null;
    let onMediaChange: (() => void) | null = null;
    const mountPageAds = () => {
      const main = document.querySelector("#main-content main") || document.querySelector("#main-content [data-arcade-surface]");
      if (!main) return;
      const hero = findHero(main);
      if (!hero) return;
      if (code.desktopBanner || code.mobileBanner) {
        const renderBanner = () => {
          banner?.remove();
          banner = null;
          const mobile = window.matchMedia("(max-width: 767px)").matches;
          const snippet = mobile ? code.mobileBanner : code.desktopBanner;
          if (!snippet) return;
          banner = adSlot("banner", mobile ? 50 : 90);
          hero.insertAdjacentElement("afterend", banner);
          appendOfficialCode(banner, snippet);
        };
        renderBanner();
        media = window.matchMedia("(max-width: 767px)");
        onMediaChange = renderBanner;
        media.addEventListener("change", onMediaChange);
      }
      if (code.nativeBanner) {
        const content = findFirstContent(main, hero);
        // Do not stack Native directly after Banner when no real content exists.
        if (content) {
          native = adSlot("native");
          content.insertAdjacentElement("afterend", native);
          appendOfficialCode(native, code.nativeBanner);
        }
      }
      const smartlinkHref = safeSmartlink(code.smartlink);
      // One card per guide page; never on legal pages or pages without a real guide section (404).
      if (smartlinkHref && !isLegalPath(pathname)) {
        const anchor = findSmartlinkAnchor(main, hero, native);
        if (anchor) {
          document.querySelectorAll('[data-manual-adsterra="smartlink"]').forEach((node) => node.remove());
          smartlink = smartlinkCard(smartlinkHref);
          anchor.insertAdjacentElement("afterend", smartlink);
        }
      }
    };
    frame = window.requestAnimationFrame(mountPageAds);
    if (code.socialBar && !socialLoaded) {
      socialLoaded = true;
      const global = document.createElement("div");
      global.setAttribute("data-manual-adsterra", "social");
      document.body.appendChild(global);
      appendOfficialCode(global, code.socialBar);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      if (media && onMediaChange) media.removeEventListener("change", onMediaChange);
      banner?.remove();
      native?.remove();
      smartlink?.remove();
    };
  }, [pathname]);
  return null;
}
