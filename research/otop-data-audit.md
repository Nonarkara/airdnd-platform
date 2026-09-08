# The Maintained Brochure

### A forensic audit of Thailand's OTOP "Big Data" platform, and what it implies for community-sourced intelligence

> Field report · 2026-09-08 · Sabai Sabai research series
> Observed from a single external vantage point. All findings are reproducible from public URLs.

---

## Why this document exists

This audit began as a procurement question — *can we ingest OTOP data into the platform?* — and returned a more interesting answer than the one it went looking for.

The One Tambon One Product programme is the most ambitious community-producer registry Thailand has built: roughly **87,468 registered producer groups and individuals**, against 7,255 tambon, sorted into five product categories, accumulated since 2001. It is exactly the kind of asset a community-intelligence platform should want to stand on. The Community Development Department (CDD) publishes it through a portal branded **OTOP BIG DATA**, and that portal advertises a documented API.

The API does not answer. The documentation for it was edited four months ago.

That gap — between a maintained description and an unreachable service — is the subject of this report.

---

## Summary of findings

1. **The advertised API host refuses connections.** `otopapi.cdd.go.th` (103.40.132.107) rejects TCP on both `:3000` and `:443`.
2. **Its documentation is current.** `/otopapi` carries a sitemap `lastmod` of **2026-05-12** — four months before this audit.
3. **A second service host is also down**, and visibly breaks a live page. `cddid.cdd.go.th/service` refuses connections; it is the iframe target of `otop.cdd.go.th/webservice`, which therefore renders as an empty grey frame in production.
4. **The API was never designed for bulk access.** Two of its four services are keyed on national ID number and return one record per call. There is no list operation, no pagination, no search, no date filter.
5. **The public portal holds no records.** `otop.cdd.go.th/products` — titled `products | OTOP BIG DATA` — is a prose page defining product categories. Zero tables, zero forms, zero select controls.
6. **The entire public surface is 18 pages**, per sitemap.
7. **The data exists, but scattered across at least eight non-interoperable systems.**

The programme does not have a data *collection* problem. It has a data *maintenance and interoperability* problem. These are not the same failure, and they do not have the same remedy.

---

## 1. Platform identification

`otop.cdd.go.th` runs **Odoo** with the website module. The signature is unambiguous:

| Marker | Value |
| --- | --- |
| Root attribute | `data-oe-company-name="สำนักส่งเสริมภูมิปัญญาท้องถิ่นและวิสาหกิจชุมชน"` |
| Page wrapper | `<div id="wrapwrap">` |
| Asset bundles | `web.assets_common.css`, `web.assets_frontend.css` |
| Multi-site marker | `data-website-id="1"` |

`oe` is OpenERP, Odoo's former name. The owning unit is CEP — the Bureau of Local Wisdom and Community Enterprise Promotion — which also operates `cep.cdd.go.th`.

This matters for one reason: an Odoo site is a **content management system**, and `/otopapi` is a page authored in its drag-and-drop editor. It describes an API; it is not one. That distinction turns out to be the whole story.

**Incidental staleness marker:** the site loads `www.google-analytics.com/analytics.js` — the Universal Analytics library Google shut off in July 2023 — alongside a live GA4 property (`G-WFSC69EG0P`). Three years of a dead script left in the page.

---

## 2. The documented API surface

One URL pattern governs all four services:

```
[URL]:3000/[Token]/[Service Name]/[ID]
```

No HTTP verb is stated. No headers, no request bodies, no response examples, no status codes. The documentation consists of path templates and response-field tables, and nothing else.

| # | Service | Lookup key | Returns |
| --- | --- | --- | --- |
| 1 | `otop_organizations` | national ID number | producer group, chair name, national ID, OTOP registration no., full address to village, phone, approval date |
| 2 | `otop_products` | national ID number | the above, plus product name, category, Quadrant |
| 3 | `otop_knowledge` | province **name** | local-wisdom item, type, owner, address, phone, description |
| 4 | `otop_nawatwithi` | Village ID | tourism-village flags by region/province/amphur/tambon |

### Internal evidence of an unfinished document

The field tables carry defects that survived publication:

- Service 2, field 6: `organizations_address` is glossed **ชื่อ นามสกุล** ("name surname") — an address field labelled as a person's name.
- Services 3 and 4 both carry the Service Name label `[ORG]`, copy-pasted from service 1.
- Service 4 types `province` and `amphur` as `int` while labelling them จังหวัด/อำเภอ, then repeats both as `village_8` and `village_10`.

A specification nobody implemented against is a specification nobody proofread.

### The linkage disclosure

The page states that data is served **ผ่าน Linkage Center**, linking to `linkagemgmt.bora.dopa.go.th` and naming สำนักทะเบียนกลาง — the Central Registration Office. BORA is the Bureau of Registration Administration at DOPA: Thailand's civil registry.

This is the interpretive key, and section 5 returns to it.

---

## 3. Reachability

| Host | IP | Result |
| --- | --- | --- |
| `otopapi.cdd.go.th` | 103.40.132.107 | connection **refused**, `:3000` and `:443` |
| `cddid.cdd.go.th` | 103.40.132.76 | connection **refused** |
| `otop.cdd.go.th` | — | all requests 200 |
| `cep.cdd.go.th` | 103.40.132.56 | live (shares IP with `www.cdd.go.th`) |

Across three full page loads of `otop.cdd.go.th` — `/otopapi`, `/otop-manage-api`, `/products` — **every request returned 200**. No 401, no 403, nothing blocked. The web tier is healthy. The service tier is not.

**On the ambiguity.** A refused connection cannot be conclusively distinguished from an IP allowlist by an outside observer. But the distinction leans: allowlists at the network edge typically DROP (producing a timeout) or return 403. A TCP reset on both the documented port and standard HTTPS is more consistent with nothing listening.

**On port 3000.** `:3000` is the Node/Express development default. A production government service, exposed over HTTPS, on the dev port, with credentials in the URL path, is a prototype that was never promoted to production hardening.

---

## 4. The maintenance timeline

Eighteen `<lastmod>` entries from `otop.cdd.go.th/sitemap.xml` — the complete public surface:

```
2021-05-07  /contactus
2021-05-10  /contactus
2021-05-10  /web/term-condition
2021-07-18  /otop
2021-07-26  /fda
2021-07-27  /qd
2021-08-09  /cps
2021-08-09  /halal
2021-08-10  /gmp
2021-08-10  /q
2021-10-06  /webservice
2023-07-20  /sdd
2024-03-18  /-1
2024-05-01  /otop-manage-api
2024-05-28  /reportanaly
2024-08-20  /report
2026-05-12  /otopapi
2026-07-01  /products
```

| Year | Pages touched |
| --- | --- |
| 2021 | 10 — the original build |
| 2023 | 1 |
| 2024 | 4 |
| 2026 | 2 |

A corroborating artefact: the API Management Center page embeds a screenshot filenamed `30-4-2567 14-39-36.png` — 30 April 2567 BE, i.e. **30 April 2024** — one day before that page's `lastmod`. The page was built around a screenshot taken the day before, and not touched since.

### Key issuance

`/otop-manage-api` is the only documented route to a token. Its entire operative content is one button, `เข้าสู่ระบบ` (log in), pointing at `https://cep.cdd.go.th/`.

It is a **login, not a signup**. There is no registration link, no application form, no eligibility criteria, no stated approval workflow, no example token, no token format, no expiry or scope model, no rate limit, and no API-specific technical contact — the only address published is `secr@cdd.mail.go.th`, the bureau secretariat.

To obtain a key you must already have a CDD account. Nothing published states how to get one.

---

## 5. Interpretation

### 5.1 This is not an open-data API. It is an identity-verification service.

Services 1 and 2 take **เลขประจำตัวประชาชน** — a citizen's national ID number — and return one record. There is no way to ask *who are all the producers in Chiang Mai*. There is only *is this specific person a registered OTOP producer, and what do they make*.

Read that against the Linkage Center disclosure — a documented bridge to the national civil registry at BORA/DOPA — and the design intent resolves cleanly:

> This API exists so that one government agency can verify a claimant's OTOP status against the civil registry. It is an eligibility check for a subsidy, a loan, or a programme benefit. It was never a data product.

The consequence is decisive and independent of whether the host ever comes back: **you cannot construct a directory from it.** Bulk use would require possessing the 87,468 national ID numbers in advance — which is precisely the dataset one should neither have nor want.

Note which two services *are* bulk-capable: `otop_knowledge` (by province) and `otop_nawatwithi` (by village). Both are tourism and cultural-heritage data. Neither touches the producer registry. The architecture draws the line exactly where a privacy review would have drawn it — which suggests one happened, and then the whole thing stopped.

### 5.2 The maintained brochure

The single most informative fact in this audit is a juxtaposition:

- `/otopapi` — **edited 2026-05-12**
- `otopapi.cdd.go.th` — **refuses connections**

Neglect would look different. Neglect is a page rotting untouched since 2021, which is exactly what ten other pages on this site are doing. This is something else: continued, recent, deliberate maintenance of the *description* of a service that does not answer.

Three readings, in descending order of charity:

1. The service is internal-only by design, reachable from within the government network, and the documentation is maintained for that internal audience. *(Plausible — but then the public page, the public "API Management Center," and the public login button are all addressed to nobody.)*
2. The documentation was refreshed in anticipation of a relaunch that has not yet happened.
3. The page is maintained because a maintained page satisfies a reporting requirement, and nobody checks whether the host behind it responds.

This report does not adjudicate between them. It observes that all three describe the same institutional condition: **the representation of a capability has become decoupled from the capability.**

### 5.3 Fragmentation is the actual failure

The data is not missing. It is distributed across at least eight systems that do not speak to each other:

`otop.cdd.go.th` · `cep.cdd.go.th` · `nexus.cdd.go.th` · `report2.cdd.go.th` · `logi.cdd.go.th` · `click.cdd.go.th` · `otoptoday.com` · `otoptravel.net`

— plus `sustainablefashion.cdd.go.th`, and a set of public Power BI embeds linked from `/report` carrying tabs `otop_brandname`, `otop_premuim` *(sic)*, `otop_quadrant`, `otop_star`, `otop_wood`. None of the Power BI surfaces expose a last-refresh timestamp.

Eight systems for one programme is precisely the condition an "API Management Center" is proposed to solve. It is also precisely the condition that makes such a centre impossible to deliver, because interoperability is not a technology purchase — it is an ongoing organisational commitment, and the timeline in section 4 shows what happened to that commitment after May 2024.

---

## 6. Consequences for this platform

**Do not attempt an OTOP API ingest.** It is unreachable, undocumented as to verbs and auth issuance, gated behind an account with no published path to obtain it, and — decisively — structurally incapable of bulk retrieval even in the best case.

**Use the published open-data snapshots instead.** GD Catalog (`gdcatalog.go.th`) and `data.go.th` are CKAN instances exposing a uniform, documented REST API:

```
/api/3/action/package_search?q=OTOP&rows=100
/api/3/action/datastore_search?resource_id=<uuid>&limit=10000&offset=0
```

Identified datasets:

| Dataset | ID |
| --- | --- |
| รายชื่อผู้ประกอบการผลิตภัณฑ์ OTOP (2563–2566, CSV + XLS) | `gdpublish-cdd12-35` |
| ผู้ผลิต ผู้ประกอบการ ที่ลงทะเบียน OTOP | `gdpublish-otop111113` |
| ผู้ผลิต/ผู้ประกอบการ OTOP | `gdpublish-y3_2_1_2` |
| ผลิตภัณฑ์สินค้า OTOP ที่ผ่านการคัดสรร (star-graded) | `gdpublish-10-20` |
| รายชื่อผู้ประกอบการที่ขึ้นทะเบียน OTOP | `gdpublish-dataset-51-026` |
| ข้อมูลโครงการ OTOP พ.ศ. 2563 | `data.go.th/dataset/otop2563` |
| สินค้า OTOP ประเภทอาหาร (DLA/INFO) | `data.go.th/dataset/otop-dla` |

GD Catalog is federated across roughly 70 provincial nodes on the identical API — write the loader once, run it per province.

These snapshots are dated, published under an open licence, and **not keyed on a citizen identifier**. Their staleness is not a defect for our purposes; it is the measurement.

**The research use is stronger than the directory use.** Ingesting 87,468 rows of registry into `companions` produces a bigger directory and no new intelligence. The registry's staleness is the interesting variable. Taking the CDD registry as a denominator and testing it against live community signal — marketplace presence, phone reachability, map presence — yields a number nobody currently holds: *the registry says 87,468; how many are still transacting?*

That is the platform's own thesis, tested against the strongest available counter-example.

---

## 7. Data protection

Services 1 and 2 accept a national ID number as a path parameter and return `id_number`, `owner_name`, `owner_address` resolved to village level, and `owner_phone`.

The authentication scheme places the bearer token **in the URL path** — `:3000/[Token]/[service]/[ID]`. Credentials so placed are recorded in server access logs, intermediate proxy logs, browser history, and outbound `Referer` headers. The port is the Node development default.

Any party ingesting this data becomes a controller of a national-ID-keyed personal dataset under PDPA (พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562), with the corresponding lawful-basis and consent obligations.

**The open-data snapshots in section 6 carry none of this exposure.** They are the correct source, on privacy grounds alone, before any question of availability.

This observation is recorded from published documentation. No endpoint was exercised, no token was sought, and no record was retrieved.

---

## 8. Limits of this audit

- Observed from a single external network vantage point. Refused connections are consistent with an internal-only deployment; the two cannot be distinguished from outside.
- `sitemap.xml` `lastmod` values are self-reported by the CMS and can be regenerated without substantive edit. They are evidence of write activity, not of content change.
- Power BI embeds were opened and confirmed to render, but expose no refresh timestamp; the freshness of the underlying warehouse is unmeasured and remains the open question.
- The response body of `POST /otopProducts/get_otop_product_category` — the only live Odoo data controller observed, returning 200 on every page load including pages with no product UI — was not captured.
- No authenticated surface was examined. `otop2.cdd.go.th`, the registration back office, is out of scope by design.

---

## Appendix: the eighteen-page portal

| Path | lastmod | What it is |
| --- | --- | --- |
| `/otop` | 2021-07-18 | entrepreneur landing |
| `/fda` `/qd` `/cps` `/halal` `/gmp` `/q` | 2021-07/08 | certification info pages |
| `/webservice` | 2021-10-06 | **broken** — iframes a refused host |
| `/contactus` ×2, `/web/term-condition` | 2021-05 | boilerplate |
| `/sdd` | 2023-07-20 | — |
| `/-1` | 2024-03-18 | FDA registration lookup |
| `/otop-manage-api` | 2024-05-01 | API Management Center — one login button |
| `/reportanaly` | 2024-05-28 | — |
| `/report` | 2024-08-20 | Power BI embeds |
| `/otopapi` | **2026-05-12** | API documentation — host refuses connections |
| `/products` | 2026-07-01 | category definitions; **no products** |

Other observed routes, from sitemap and passive capture: `/search/{sub_district,district,province,village}/suggestion`, `/website/info`, `/web/otop-login`, `/web/login`, `/otopProducts/get_otop_product_category`.

---

*Primary observation gathered 2026-09-08 via authenticated browser session and passive network capture. Every URL cited is public.*
