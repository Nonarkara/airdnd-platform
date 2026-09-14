# Data unlocks — what the OTOP corpus can still do

The registry is already ~154k merged records, ~135k tambon-placed, 77 province
shards. This note lists unlocks that are **grounded in fields already present**
(or already published as sidecars). It does not invent economic statistics.

Shipped in `otop/province-media-unlock`:

| Unlock | Artefact / UI | Honesty bound |
|---|---|---|
| **Province signature pack** | `otop_province_faces.json` → Province dossier “Known for” | Top categories + most-repeated product *names* + reachable champions. Counts are filings, not fame or sales. |
| **Category × geography explorer** | Atlas → Geography tab | Ranks all 77 provinces for a chosen category from `byProvince.categories`. Complements the densest-25 heatmap. |
| **Open-license photo face** | `media/provinces/<code>.json` + dossier / Champions | Wikimedia Commons CC BY / CC BY-SA / PD / CC0 only, with author + license URL. Illustrative — never claimed as a named producer’s product shot. Missing hit → placeholder. |

## Still available next (not invented)

1. **Revenue join (already partial)** — `otop_revenue.json` is provincial
   aggregates from CDD, not per-producer. The honest next step is richer
   dossier / basin views that keep the disclaimer: money moved in the province,
   not who earned it. Do **not** divide baht by registry row count.

2. **B2B sourcing basins** — Matchmaker already ranks reachable depth. Next:
   export a one-page “trip brief” per basin (champions + contacts + category
   mix + standards hits) as PDF/CSV without claiming capacity or MOQ.

3. **มผช. / standards depth** — `otop_standards.json` + cert standing on
   records. Next: per-product-name match rates by province, and an honest
   “ungraded but standard-eligible” list (name match ≠ certification).

4. **Tambon / map second layer** — ~135k rows carry `tambonCode`. Next: denser
   subdistrict basins inside a province dossier (still not producer pins —
   no coordinates on the registry).

5. **Ghost vs pulse** — compare registry contactability against live seller
   channels (LINE/FB intake). The interesting number is the *delta*, labelled
   as such — not a substitute national census.

6. **Category inference audit** — large `unclassified` and keyword-inferred
   shares. Next: publish confusion samples (name → inferred category) so
   readers can see classifier noise (e.g. bags tagged textile).

7. **Income field** — sparse `income` on some shards. Next: show only where
   present, with coverage %, never imputed.

8. **Cross-agency corroboration drill-down** — `sourceCount` / provenance
   arrays exist. Next: per-province “single-agency only” lists for CDD cleanup.

## Rules that stay

- Measure the **registry**, not the economy.
- Missing → `null` / placeholder / caveat — never a silent default.
- Photos: license + attribution visible; illustrative labelled; no stock-photo
  lie that a listing has been photographed.
- Rebuild path: `otop:faces` → `otop:media` (network) is separate from
  `otop:build` (pure), same split as fetch vs build.

