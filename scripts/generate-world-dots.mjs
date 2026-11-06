#!/usr/bin/env node
/**
 * Generator for app/data/worldDots.json — run ONCE by hand, output
 * committed (no runtime map dependency):
 *
 *   node scripts/generate-world-dots.mjs
 *
 * Sources (open Natural Earth data, fetched at generation time):
 *   world-atlas@2 countries-110m.json (TopoJSON of Natural Earth
 *   110m countries) via jsDelivr; world-countries@4 for the
 *   numeric -> ISO alpha-2 code mapping.
 *
 * Method: hand-rolled TopoJSON decode (delta arcs), equirectangular
 * projection (width 1000, lat 84..-58), point-in-polygon sampling
 * on a ~1.42-degree grid. Each dot is assigned to the first country
 * polygon containing it. countryDots[alpha2] = the country's own
 * grid dot nearest its dot-mean (a representative interior point
 * for presence markers). Antarctica is excluded (no fans, and it
 * would stretch the projection).
 */
import { writeFileSync } from 'node:fs';

const wc = await (await fetch('https://cdn.jsdelivr.net/npm/world-countries@4/dist/countries.json')).json();
const NUM2ALPHA = {};
for (const c of wc) {
  if (c.ccn3 && c.cca2) NUM2ALPHA[c.ccn3] = c.cca2;
  if (c.name && c.name.common === 'Antarctica') NUM2ALPHA['010'] = 'AQ';
}

const topo = await (await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')).json();
const { transform } = topo;
const [sx, sy] = transform.scale, [tx, ty] = transform.translate;
const decodeArc = (arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * sx + tx, y * sy + ty];
  });
};
const arcs = topo.arcs.map(decodeArc);
const geomPolys = (geom) => {
  const polyFromRings = (rings) => rings.map((ring) => {
    const pts = [];
    for (const ai of ring) {
      const arc = ai >= 0 ? arcs[ai] : [...arcs[~ai]].reverse();
      for (let i = pts.length ? 1 : 0; i < arc.length; i++) pts.push(arc[i]);
    }
    return pts;
  });
  if (geom.type === 'Polygon') return [polyFromRings(geom.arcs)];
  if (geom.type === 'MultiPolygon') return geom.arcs.map(polyFromRings);
  return [];
};

const W = 1000, LAT_TOP = 84, LAT_BOT = -58;
const H = Math.round(W * (LAT_TOP - LAT_BOT) / 360);
const STEP = 1.42; // degrees between dot centers
const cols = Math.floor(360 / STEP), rows = Math.floor((LAT_TOP - LAT_BOT) / STEP);
const inRing = (lon, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inCountry = (lon, lat, polys) => polys.some((poly) => {
  if (!inRing(lon, lat, poly[0])) return false;
  for (let h = 1; h < poly.length; h++) if (inRing(lon, lat, poly[h])) return false;
  return true;
});

const countries = topo.objects.countries.geometries.map((g) => ({
  alpha2: NUM2ALPHA[g.id] || null,
  polys: geomPolys(g),
})).filter((c) => c.alpha2 && c.alpha2 !== 'XX' && c.alpha2 !== 'AQ');

const dots = [];
const perCountry = new Map();
for (let r = 0; r <= rows; r++) {
  const lat = LAT_TOP - r * STEP;
  for (let c = 0; c <= cols; c++) {
    const lon = -180 + c * STEP;
    for (const country of countries) {
      if (inCountry(lon, lat, country.polys)) {
        const x = Math.round(((lon + 180) / 360) * W * 10) / 10;
        const y = Math.round(((LAT_TOP - lat) / (LAT_TOP - LAT_BOT)) * H * 10) / 10;
        dots.push(x, y);
        if (!perCountry.has(country.alpha2)) perCountry.set(country.alpha2, []);
        perCountry.get(country.alpha2).push([x, y]);
        break;
      }
    }
  }
}
const countryDots = {};
for (const [a2, pts] of perCountry) {
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  let best = pts[0], bd = Infinity;
  for (const p of pts) { const d = (p[0]-mx)**2 + (p[1]-my)**2; if (d < bd) { bd = d; best = p; } }
  countryDots[a2] = best;
}
const out = { width: W, height: H, dots, countryDots };
const json = JSON.stringify(out);
writeFileSync(new URL('../app/data/worldDots.json', import.meta.url), json);
console.log('dots:', dots.length / 2, 'countries:', Object.keys(countryDots).length, 'bytes:', json.length, 'gzip-ish:', Math.round(json.length * 0.32));
console.log('samples:', JSON.stringify({ US: countryDots.US, DE: countryDots.DE, GB: countryDots.GB, AU: countryDots.AU, JP: countryDots.JP, BR: countryDots.BR, CA: countryDots.CA }));
