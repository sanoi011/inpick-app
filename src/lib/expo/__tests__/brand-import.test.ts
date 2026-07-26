import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPO_BRAND_MAX_CANDIDATES,
  extractBrandCandidates,
  isExpoBrandKit,
} from "../brand-import";

const AT = "2026-07-26T00:00:00.000Z";
const BASE = "https://www.acme-booth.com/";

test("title, description and site name are extracted and decoded", () => {
  const html = `
    <html><head>
      <title>Acme &amp; Co — 전시 솔루션</title>
      <meta name="description" content="부스 &quot;전문&quot; 브랜드">
      <meta property="og:site_name" content="Acme">
    </head><body></body></html>`;
  const out = extractBrandCandidates(html, BASE, AT);
  assert.equal(out.title, "Acme & Co — 전시 솔루션");
  assert.equal(out.description, '부스 "전문" 브랜드');
  assert.equal(out.siteName, "Acme");
  assert.equal(out.sourceUrl, BASE);
  assert.equal(out.retrievedAt, AT);
});

test("logo candidates come from icons, og:image and logo imgs, resolved to https", () => {
  const html = `
    <head>
      <link rel="icon" href="/favicon.ico">
      <link rel="apple-touch-icon" href="/img/touch.png">
      <meta property="og:image" content="https://cdn.acme.com/og.png">
      <link rel="stylesheet" href="/app.css">
    </head>
    <body><img src="/assets/acme-logo.svg" alt=""><img src="/photo.jpg" alt="hero"></body>`;
  const out = extractBrandCandidates(html, BASE, AT);
  assert.deepEqual(out.logoCandidates, [
    "https://cdn.acme.com/og.png",
    "https://www.acme-booth.com/favicon.ico",
    "https://www.acme-booth.com/img/touch.png",
    "https://www.acme-booth.com/assets/acme-logo.svg",
  ]);
});

test("non-https and malformed urls are dropped", () => {
  const html = `
    <head>
      <link rel="icon" href="http://insecure.acme.com/fav.ico">
      <meta property="og:image" content="javascript:alert(1)">
    </head>`;
  const out = extractBrandCandidates(html, BASE, AT);
  assert.deepEqual(out.logoCandidates, []);
});

test("theme colors normalize to 6-digit lowercase hex and dedupe", () => {
  const html = `
    <head>
      <meta name="theme-color" content="#1A2B3C">
      <meta name="theme-color" content="#1a2b3c">
      <meta name="msapplication-TileColor" content="#f00">
      <meta name="theme-color" content="not-a-color">
    </head>`;
  const out = extractBrandCandidates(html, BASE, AT);
  assert.deepEqual(out.colorCandidates, ["#1a2b3c", "#ff0000"]);
});

test("candidate lists are capped", () => {
  const links = Array.from(
    { length: 20 },
    (_, i) => `<link rel="icon" href="/icon-${i}.png">`,
  ).join("");
  const out = extractBrandCandidates(`<head>${links}</head>`, BASE, AT);
  assert.equal(out.logoCandidates.length, EXPO_BRAND_MAX_CANDIDATES);
});

test("brand kit guard requires rightsConfirmed and valid color", () => {
  const base = {
    name: "Acme",
    logoUrl: "https://cdn.acme.com/logo.png",
    colorHex: "#1a2b3c",
    sourceUrl: BASE,
    retrievedAt: AT,
    rightsConfirmed: true as const,
  };
  assert.ok(isExpoBrandKit(base));
  assert.ok(!isExpoBrandKit({ ...base, rightsConfirmed: false }));
  assert.ok(!isExpoBrandKit({ ...base, colorHex: "red" }));
  assert.ok(isExpoBrandKit({ ...base, logoUrl: null, colorHex: null }));
});
