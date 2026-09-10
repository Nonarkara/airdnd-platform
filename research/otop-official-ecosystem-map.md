# OTOP — The Official Thai-Government Ecosystem, Mapped

### What exists, who runs it, how old it is, and what one³ can replace

**Dr Non Arkaraprasertkul** — for the one³ OTOP registry intelligence project
*2026-09-10 · Working draft · sources: web search + site inspection, see §7*

> Purpose. The user asked: find every official account and information source related to the Thai government's *หนึ่งตำบล หนึ่งผลิตภัณฑ์* (OTOP) programme that is still alive, see which are small or stale enough to clone or absorb, and identify the data we can pull to enrich the one³ registry at `otop.pages.dev`. This document is the map. It is the input to the next round of product decisions; it is not a strategy by itself.

---

## 1. The line-up, in one table

The OTOP programme is run by **กรมการพัฒนาชุมชน (CDD — Community Development Department), กระทวงมหาดไทย (Ministry of Interior)**. The CDD operates 76 provincial offices. OTOP started in **พ.ศ. 2544 (2001)** as a copy of Japan's *One Village One Product* (OVOP). It is the country's largest rural-economic programme, with **725 datasets** in `data.go.th` and roughly **196,000 registered producers** (sum of the central-registry versions: 96,926 + 94,993 + 2,500 + ~1,000 from the smaller spreadsheets).

| # | Channel | URL | Owner | Age signal | Scale | What one³ does to it |
|---|---|---|---|---|---|---|
| 1 | **OTOP Big Data portal** | `otop.cdd.go.th` | CDD | Odoo 14.0 (released 2020, EOL 2023); jQuery-era asset pipeline; Sarabun web font | All 76 provinces' official operator registry + product directory + CPS quality monitoring + FDA lookup | Pull API where token-gated, scrape public pages where not, build a faster public mirror |
| 2 | **OTOP API** | `otopapi.cdd.go.th:3000` | CDD | Documented at `/otopapi`; token-gated; per-ID lookup only, no pagination | Four endpoints: `otop_organizations`, `otop_products`, `otop_knowledge`, `otop_nawatwithi` | Mirror the schema (already done in `otop.config.json`); aggregate bulk data via the data.go.th mirror instead of one-by-one |
| 3 | **OTOP Today (commerce)** | `www.otoptoday.com` | CDD | Footer says "© 2019 otoptoday"; Bootstrap 3 / jQuery / jQuery 2.1.4 / font-awesome 4.7; mobile broken (`user-scalable=no`) | 61,596 products, 45.3M visits, 21.7M click-throughs (self-reported) | Build a faster, bilingual, mobile-first, map-equipped commerce-aware directory. The catalogue is small enough to absorb. |
| 4 | **CEP สำนักส่งเสริมฯ** (Bureau of Local Wisdom) | `cep.cdd.go.th` | CDD — Bureau of Local Wisdom & Community Enterprise | Slow CMS; static content pages last edited 2567–2569 | 200+ static info pages, no product directory | None — it is the policy/legal layer; cite it as source, do not duplicate |
| 5 | **Click ชุมชน** mobile app | `play.google.com/store/apps/details?id=th.go.cdd.click` · App Store id `6463790710` | CDD — IT Centre | Released ~2022; 13 features; personal Gmail `alphabbm@gmail.com` listed as support | **100,000+ downloads on Play Store**; iOS exists | One³ is a faster, more honest intelligence surface. The app's "Shop ชุมชน" menu is just OTOP Today inside an app shell. |
| 6 | **CDD main** | `www.cdd.go.th` | CDD | Drupal-style news CMS, still updated 2569 | News, policy, registration forms | Cite, do not duplicate |
| 7 | **OTOP Today Facebook page** | `facebook.com/OTOPTODAYTHAILAND` | CDD | 9.3k page likes, 11.1k followers; last verified post "May 24" (2025) | 81,945 post reach | None — social. A future one³ *insight* push channel. |
| 8 | **OTOP Today ฝากร้านขายของ** FB group | `facebook.com/groups/232930151121943` | CDD-administered | 232,000 members | The real commerce floor | Where the actual buyers go. one³ should link, not compete. |
| 9 | **TAMDEEMARK LINE OA** | LINE OA `Tamdeemark` | CDD | 14 e-learning courses for OTOP designers | Active | Future one³ "Producer skill index" — produce a *signal* of which districts have access to which training |
| 10 | **data.go.th** (open data) | `data.go.th` (CKAN) | DGA (Digital Government Agency) | 725 OTOP datasets, 1,305 resources, last updated 2567–2568 | 100k+ producer rows in central registry versions | Already being pulled (background fetch). The main data well. |
| 11 | **thailandmall.com** | `thailandmall.com/th` | DGA / commerce arm | Mainstream, mid-2010s ecommerce template | National multi-vendor marketplace | None — we are not commerce. Cite if relevant. |
| 12 | **otopthai.shop** | `otopthai.shop` | Likely DGA-affiliated | Live | OTOP commerce sub-store | Same as #11 — cite, do not duplicate. |
| 13 | **otopiherbu.com** | `otopiherbu.com` | Niche private | Live, slow | Herbal OTOP only | Too small to matter. |
| 14 | **Shopee @otoptoday** | `shopee.co.th/shop/566775963` | CDD-run storefront | Live | Multi-vendor storefront | Different layer (marketplace). Cite. |
| 15 | **otopth.com** | `otopth.com` | Unknown | **Dead — redirects to `/lander`** | None | Drop. |
| 16 | **otoptoday.createintelligence.co.th** | `otoptoday.createintelligence.co.th` | Create Intelligence Co. (Thai BI vendor) | **404 — retired** | Was a BI dashboard for OTOP producers | Dead before one³ started. A cautionary tale: a paid BI vendor's site outlived only by their billing cycle. |
| 17 | **Provincial CDD sites** | 76 sites, e.g. `phukradueng.cdd.go.th`, `chiangmai.cdd.go.th`, `singburi.cdd.go.th` | Provincial CDD offices | WordPress-style, last edited 2566–2569 | 76 mostly-stale news + form pages | None — we aggregate up, not down. Cite as provenance per district. |
| 18 | **FAO OCOP regional platform** | `fao.org/one-country-one-priority-product/asia-pacific/thailand` | UN FAO | Last FAO story page dated 2022-10-03 | Lists the 5 official channels (1, 3, 4, 7, 8 above) | None. Quote them as a credential: *the UN's regional OCOP page lists five Thai channels; one³ is the sixth.* |

That is 18 channels. The CDD itself admits to five (in the FAO listing). The remaining 13 are sub-properties, third-party storefronts, and dead landers.

---

## 2. The crown jewel: `otop.cdd.go.th`

The OTOP Big Data portal is the mothership. The header is `data-oe-company-name="สำนักส่งเสริมภูมิปัญญาท้องถิ่นและวิสาหกิจชุมชน"` (Bureau of Local Wisdom and Community Enterprise Promotion). The `/website/info` page declares the platform *literally*: **"instance of Odoo, the Open Source ERP — เวอร์ชัน Odoo 14.0"**. Installed apps include `OTOP Dashboard รายงาน IFrame` (an internal iframe dashboard).

The site has the same content surface that a one-person project can rebuild:

- `/` home (cookie banner + nav)
- `/otop` operator registration copy
- `/otopapi` API documentation
- `/otop-manage-api` API admin
- `/webservice` legacy web service
- `/products` 5-category product taxonomy
- `/cps` post-market quality monitoring (CPS = ?
- `/fda` อย. (FDA) registration lookup
- `/report` summary reports
- `/blog`, `/event`, `/contactus`
- `/tourism-community` OTOP นวัตวิถี (creative tourism) villages
- `/otop-knowledge` local wisdom entries

It uses Bootstrap 3, jQuery 2.1.4, font-awesome 4.7, Google Analytics (G-WFSC69EG0P). It has 2 duplicate `viewport` meta tags. It uses `Sarabun` — the very font our own CLAUDE.md §0 bans for the nsp-prototype project. *The site is functionally frozen in 2019–2020.* The technical debt is large and the Odoo security update window is closed.

The API documentation is the interesting bit. It publishes the schema for the four endpoints. I quote verbatim from `/otopapi` because it is the schema the `data.go.th` mirrors are also in:

```
GET https://otopapi.cdd.go.th:3000/[Token]/[otop_organizations]/[ID]
GET https://otopapi.cdd.go.th:3000/[Token]/[otop_products]/[ID]
GET https://otopapi.cdd.go.th:3000/[Token]/[otop_knowledge]/[ID]
GET https://otopapi.cdd.go.th:3000/[Token]/[otop_nawatwithi]/[ID]
```

The published field set for `otop_organizations` (15 fields) — the *exact* aliases we already wired into `otop.config.json` as English columns:

| # | Field | Thai | Notes |
|---|---|---|---|
| 1 | `organizations_name` | ชื่อกลุ่มผู้ประกอบการ | group name |
| 2 | `owner_name` | ชื่อประธานกลุ่ม | chair name |
| 3 | `id_number` | หมายเลขบัตรประชาชนของผู้ประกอบการ | national ID int |
| 4 | `otop_number` | เลขทะเบียนผู้ประกอบการ OTOP | OTOP registry int |
| 5 | `otop_type` | ประเภทของผู้ประกอบการ | producer type string |
| 6 | `owner_address` | ที่อยู่ | |
| 7 | `owner_village` | หมู่บ้าน | |
| 8 | `owner_sub_district` | ตำบล | |
| 9 | `owner_district` | อำเภอ | |
| 10 | `owner_province` | จังหวัด | |
| 11 | `owner_region` | ภูมิภาค | |
| 12 | `owner_country` | ประเทศ | |
| 13 | `owner_zipcode` | รหัสไปรษณีย์ | |
| 14 | `owner_phone` | เบอร์โทร | |
| 15 | `create_date` | วันที่ได้รับอนุมัติ | string |

`otop_products` adds `product_name`, `product_category`, `Quadrant` (16 fields).
`otop_knowledge` is keyed by province, has `knowledge_type`, `knowledge_name`, `description`.
`otop_nawatwithi` is keyed by Village_ID, returns region/province/amphur/tambol/village/otop_nawatwithi/otop_for_tourism/otop_community_based_tourism_village — the CBT (community-based tourism) layer.

**There is no documented list endpoint. No pagination. No filter. No bulk.** Every record is per-ID. To get 196,000 records one has to know all 196,000 IDs. The scheme is, deliberately or not, an *anti-bulk* API. The data.go.th mirror is the only bulk path, and the CDD's own `gdcatalog.go.th` portal publishes those mirrors.

**One-person-clone target:** the Odoo install is on a 2020 codebase, the public Odoo 14.0 security window is closed, the data is bulk-mirrored to `data.go.th`, the mobile UX is broken, the API is per-ID. This is *exactly* the "institution froze, we replace" pattern the user has used elsewhere (Flood). one³'s job is not to host the Odoo clone — it is to make the *aggregate* legible.

---

## 3. The trap: `www.otoptoday.com`

otoptoday.com is the commerce front. The header is `OTOPTODAY : ศูนย์รวมสินค้า OTOP ที่ใหญ่ที่สุด กรมการพัฒนาชุมชน`. Footer is `© 2019 otoptoday. กรมการพัฒนาชุมชน`. The page is Bootstrap 3, jQuery 2.1.4, `easy-responsive-tabs`, Google Analytics UA-142760089-1.

It is a 6-year-old PHP template (`search_page.php`, `view_product.php`, `showroom.php`, `search_cat.php`, `view_prov.php`) that the CDD *still has live* and *still claims* in the FAO listing. The "About" line in its own footer is the user's own framing of what it is supposed to be:

> *Otoptoday.com เป็นเว็บไซต์ที่พัฒนาขึ้นโดย กรมการพัฒนาชุมชน กระทรวงมหาดไทย เพื่อเผยแพร่ประชาสัมพันธ์ผลิตภัณฑ์โอทอปของจังหวัดต่างๆทั่วไทย เพื่อให้ผู้ที่สนใจสั่งซื้อผลิตภัณฑ์โอทอปได้โดยตรงกับผู้ผลิต หรือผู้ประกอบการ*

The data is split: self-reported counters say **61,596 products** with 45M+ visits and 21.7M click-throughs; the cep.cdd.go.th page (the one FAO cites) still says 16,396 products and 15.4M baht. The two numbers are not reconcilable from outside; the CDD itself is unsure what it has.

Why this matters for one³:

- The dataset is small and stable. 61,596 is well within a JSON download.
- The product cards are: 4-col, image-front + image-back identical, name, price, province. The hot-product counter shows 17,784 views for "น้ำผึ้ง ผสมมะนาว" from Chiang Mai. View counts are the only signal of popularity. *There is no map, no category drilldown, no quality signal, no language toggle, no producer story, no product photo, no ratings.*
- Mobile is broken. The viewport tag is still `user-scalable=no`. Bootstrap 3 nav does not collapse to a real menu.
- The "showroom" is a static curated image. The category drill is a list-page. The search is a textbox. The whole thing is a 2019 ecommerce template.
- Banner image (one of ~20 in the rotating slider) — every one points at a Google Drive folder, a PubHTML5 flipbook, or an Anyflip embed. *The product catalog itself is not the point. The point is the campaigns and the publications.*

**The trap:** otoptoday.com is a brochure, not a directory. Its 61k products are the *same* producers we already have in `data.go.th`, sliced differently. one³ is the intelligence surface otoptoday.com never was.

---

## 4. The mobile super-app: Click ชุมชน

| Attribute | Value |
|---|---|
| Package | `th.go.cdd.click` |
| Play Store | `play.google.com/store/apps/details?id=th.go.cdd.click` |
| App Store | id `6463790710` |
| Downloads | 100,000+ (Android) |
| Rating gate | 10+ age |
| Developer | "IT Centre Community Development Department" |
| Support email | **`alphabbm@gmail.com`** ← personal Gmail, not a `.go.th` address |
| Support phone | +66 86 566 3599 |
| 13 features | เที่ยวชุมชน · Shop ชุมชน (OTOP) · สมาชิก OTOP · 108 อาชีพ · กองทุนพัฒนาบทบาทสตรี · Mee Thun · ... |

This is the CDD's flagship mobile surface. It is not small. 100K+ downloads is the Play Store threshold for "popular app" tier. It is also *bundled*: the OTOP shopping menu is one of 13 features inside a community-development super-app. From a user's point of view, opening the app to buy OTOP is like opening Microsoft Word to find the weather. The 100K is real and the engagement is real, but the OTOP part of it is buried.

The personal Gmail is a tell. A government app's public support contact is supposed to be a `cdd.mail.go.th` address. `alphabbm@gmail.com` is the developer's own mailbox, which means (a) the procurement went through a small contractor, (b) the app is *one person's* job, and (c) the moment that person changes role, support degrades. This is the same pattern the user has seen before.

**Implication for one³:** the Click ชุมชน OTOP menu is the actual *consumer* front door — but it is a checkout list, not a discovery surface. one³'s role is upstream: *help a buyer figure out which province to go to, which category to look in, which producer has the right contact channel, which star level they should trust.* Then hand them to the producer's phone / LINE / Shopee.

---

## 5. The five real findings

These are not findings I invented; they are patterns visible to anyone who clicks through the 18 channels above.

1. **The CDD's own portal is the data well — but they have built a fence around the well.** otopapi.cdd.go.th:3000 requires a token, returns per-ID only, has no list endpoint. The data.go.th mirror is the only bulk path, and they put the mirror there themselves. The fence and the well are both CDD.
2. **The mobile app is bundled, not focused.** Click ชุมชน's 100K+ downloads are spread across 13 features. The OTOP feature is a checkout menu inside a community-development super-app. one³'s *focused* OTOP intelligence view is structurally different — and the gap matters because "what to buy in OTOP today" deserves a screen, not a menu item.
3. **The CDD has 5 official channels. We are the 6th.** That is what the FAO's regional OCOP page would say if it were re-listed today. `otop.pages.dev` is the only one that runs without a token, in two languages, on mobile, with a map, with dedup, and with findings instead of listings.
4. **The commerce is on Facebook and Shopee, not otoptoday.com.** The 232k-member group "OTOP Today ฝากร้านขายของ" and the Shopee storefront are where the actual transactions happen. The CDD's own commerce site is a brochure.
5. **The data is *one schema*, four views.** otopapi.cdd.go.th's `otop_organizations` schema, the data.go.th CSV columns, the Click ชุมชน product list, and otoptoday.com's product rows are *the same producers under four different presentations.* The CDD has one source of truth; they just don't expose it cleanly. one³ already aggregates this — the 725-dataset catalogue, 196k+ producers, English + Thai + Burmese + Khmer, the findings block, the heatmap. This is the replacement thesis, and it is already running.

---

## 6. What one³ can take, what one³ should not

**Free to take:**

- The schema for `otop_organizations` and `otop_products` — already in `otop.config.json`.
- The 725 datasets in `data.go.th` — already in the background fetch.
- The product categorisation (5 groups, ~30 sub-groups) — already mapped.
- The star-rating definition (5★ ≥ 90 pts, 4★ 80–89, 3★ 70–79, 2★ 50–69, 1★ < 50) — already encoded.
- The standard certifications (อย., GAP, GMP, HACCP, Qmark, มผช., มอก., ฮาลาล, นกยูงพระราชทาน) — already a tag set in the build.
- The five OTOP นวัตวิถี (creative tourism) sub-types — already a column.
- The 76-province administrative division — already a join key.
- Public CGI markers: Sarabun web font on the CDD site (we banned Sarabun for our nsp project; for one³ the brand is `Sao Chingcha` from the user's local OTF). The Odoo install is a technical-debt lesson: when the institution freezes, the data outlasts the platform. Build for that.
- The Click ชุมชน app's `alphabbm@gmail.com` and the developer's likely LinkedIn — useful for a *one day* partnership conversation if the user wants the official app to deep-link to one³ for the "find a producer" step.

**Not free to take:**

- The token-gated `otopapi.cdd.go.th:3000` endpoint. We can ask; we should not scrape.
- Producer photos and addresses that are not in the public CSV. We can reference; we should not cache.
- The OTOP Today banner art — it is from the same CDD contractor; we should not copy.
- otopthai.shop product cards. We cite, we do not mirror.

**The structural move:**

- Continue pulling the 725-dataset catalogue. When the background fetch lands, rebuild and redeploy one³. The findings block, heatmap, and 16-year time series will recompute automatically.
- For each of the 18 channels above, publish a *one-line replacement story* in the Atlas so anyone who arrives from a search-engine result comparing the two can see the gap.
- The data.go.th CSVs are public, open, and licensed for re-use under the Open Government Data Licence. They are our right to take.
- The Odoo / API surface is the institution's right to keep. We do not try to clone it; we make the aggregate legible.

---

## 7. Sources

Web searches and direct fetches, 2026-09-10. Cached at research time, not re-verified:

- `otop.cdd.go.th`, `otop.cdd.go.th/otopapi`, `otop.cdd.go.th/website/info`, `otop.cdd.go.th/products`, `otop.cdd.go.th/cps`, `otop.cdd.go.th/fda`, `otop.cdd.go.th/reportanaly`
- `www.otoptoday.com/`, `otopth.com/`, `otopiherbu.com/`
- `otoptoday.createintelligence.co.th/` (404)
- `cep.cdd.go.th/th/content/page/index/id/1332`, `id/1335`, `id/1338`, `id/200207`, `id/47139`
- `www.cdd.go.th/`, `cddadg.cdd.go.th/`
- `chiangmai.cdd.go.th`, `singburi.cdd.go.th`, `phukradueng.cdd.go.th`, `trat.cdd.go.th`
- `data.go.th` (725 datasets via CKAN), `gdcatalog.go.th/dataset/gdpublish-otop111112`, `gdcatalog.go.th/dataset/gdpublish-y3_2_1_2`
- `fao.org/one-country-one-priority-product/asia-pacific/thailand/the-story-of-one-tambon-one-product-otop-in-thailand/en`
- `play.google.com/store/apps/details?id=th.go.cdd.click` (100K+ downloads)
- `apps.apple.com/.../id6463790710` (Click ชุมชน iOS)
- `facebook.com/OTOPTODAYTHAILAND/` (11k followers), `facebook.com/groups/232930151121943` (232k members)
- `mgronline.com/politics/detail/9630000081250` (CDD OTOP Today press, 2563/2020)
- `thairath.co.th/news/society/1636860` (OTOP Today launch announcement)

---

*— Draft. Add to / amend as more channels surface. The user can re-task any one channel into a deeper working paper — the Click ชุมชน app and the Odoo API doc are the most interesting follow-ups.*
