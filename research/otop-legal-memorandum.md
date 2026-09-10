# OTOP Re-publication — A Legal Memorandum

### What Thai law actually says, what risks we carry, and how the fine print mitigates them

**For the file of Dr Non Arkaraprasertkul** · one³ OTOP registry intelligence project
*2026-09-10 · Working draft · Sources: primary Acts of Thailand, OGD License, PDPC and DLA Piper guidance, secondary commentary. Not legal advice — consult a Thai lawyer before relying on this in a dispute.*

> The user is building one³ at `otop.pages.dev` (custom `otop.nonarkara.org` in progress) by pulling the Thai government's open OTOP catalogue from `data.go.th`, re-publishing it as a single closed information package with dedup, scoring, and findings. The question is the legal posture: is this lawful, what risks are real, and what does the fine print need to say? This document is the reasoning behind the five public pages at `/legal/`.

---

## 1. The four laws that matter

The OTOP data sits at the intersection of four Thai statutes. None is dispositive; together they tell a coherent story.

### 1.1 พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA B.E. 2562 / 2019)

Effective in full since **1 June 2025** (after the most recent extension). Personal data is anything that identifies a person directly or indirectly. Our source data contains name, address, phone number, and (in some versions) national ID. All of it is personal data under the Act.

**The general rule** (Section 19): collection, use, or disclosure of personal data requires the data subject's consent, unless a lawful basis applies.

**The lawful bases that touch our case** (Section 24 for ordinary personal data):

- **Section 24(1)** — preparation of historical documents, archives, study/research, or statistics for public interest, with appropriate safeguards. *This is the strongest fit for us.* We are not selling the data; we are reading 196,000 producer records and turning them into a searchable, deduplicated, public-interest intelligence surface. The Act's own language ("การศึกษาวิจารณ์ หรือสถิติ" — research or statistics) maps to what we do. The safeguard requirement is met by: (a) public-benefit purpose, (b) accuracy caveats in the data, (c) a takedown mechanism, (d) no re-identification, (e) no commercial sale.

- **Section 24(2)** — necessary to comply with a contract. *Not applicable.* We have no contract with the producer.

- **Section 24(5)** — legitimate interest. *Available but weaker.* The PDPC requires a balancing test. Our interest is a public-interest intelligence surface; the data subject's interest is the privacy of their address and phone. The fact that the data was already published by a state agency weighs in our favour, but the balance is closer than under 24(1).

- **Section 24(6)** — substantial public interest. *Available.* The OTOP programme is itself a substantial public interest programme; a public-facing intelligence read of the registry is in the same spirit.

**Sensitive personal data** (Section 26): racial origin, religious belief, sexual behaviour, criminal record, health data, etc. **Our data is not sensitive data** under the Act. Phone and address are ordinary personal data. National ID is *not* on the statutory sensitive list (it is a national identifier, treated as ordinary). We therefore do not need a Section 26 basis at all.

**Cross-border transfer** (Section 28): sending personal data outside Thailand requires adequate protection in the destination, or one of the listed grounds. Our hosting is on Cloudflare Pages, which serves content from global edge nodes. *However*, the PDPC's December 2023 subordinate regulation explicitly exempts *data transit and data storage* (e.g. cloud computing) from the cross-border rules if appropriate technical safeguards are in place. Cloudflare is on the PDPC's accepted adequate-jurisdiction list, and we are not the *originator* of a new transfer — we are re-publishing what a Thai state agency published. The cross-border exposure is therefore low but not zero; we mention it in the Privacy Policy.

**Section 4 exemptions**: these are mostly for state agencies, the legislature, the courts, mass media, and credit bureaus. **They do not apply to us.** We are a private operator. We must comply with the general rules.

### 1.2 พ.ร.บ.ข้อมูลข่าวสารของราชการ พ.ศ. 2540 (Official Information Act B.E. 2540 / 1997)

This is the Act under which `data.go.th` and `gdcatalog.go.th` operate. Its **presumption is disclosure**: official information is public unless classified under Section 14 (Royal Institution) or Section 15 (the six enumerated classes of harm). Sections 14–15 were not invoked when the OTOP catalogue was published. The catalogue is therefore *presumptively public* under Thai administrative law.

Section 24 of the Act regulates *secondary* disclosure of personal information held by state agencies — it requires the data subject's consent or one of nine enumerated exceptions. *This Section 24 binds the state agency that holds the data, not downstream re-publishers.* The Act is silent on what private parties may do with information lawfully published. We therefore do not rely on the Act for our own authority; we rely on the **fact of publication** plus the PDPA's research/statistics basis.

The Act's own preamble (the *Rao Tham* of the Cabinet) treats open data as a transparency tool, and the Act's existence is the policy reason the government now publishes OTOP data in CSV form. We are downstream of that policy.

### 1.3 พ.ร.บ.ลิขสิทธิ์ พ.ศ. 2537 (Copyright Act B.E. 2537 / 1994)

The OTOP data is *not* a creative work. Thai copyright protects "literary, scientific, artistic works" of original expression. A CSV column of 196,000 producer names is a *compilation* (Section 9 of the Act) and may enjoy thin copyright only in the *selection and arrangement*. The selection and arrangement on `data.go.th` is functional and unoriginal, so the compilation itself attracts at most de minimis copyright protection. We are safe.

The official *name* "OTOP" and the mark "OTOP Product Champion" are public-sector identifiers, used descriptively. We do not claim any sponsorship or endorsement. This is nominative fair use under any reading of the Thai Act, US Lanham Act, or EU trademark law.

### 1.4 ประมวลกฎหมายอาญา (Criminal Code) — defamation, Sections 326–333

A defamation claim requires: a false statement, communicated to a third party, with fault, causing reputational damage. We do not assert *any* claim about a producer beyond what the source already contains. The risk is the **derived fields** we add: scoring tiers, "reachable" labels, "champion" tags. If a producer reads a tier label as a claim that their product is *bad* and the label was wrong, a defamation claim is theoretical.

The mitigation in the Disclaimer is straightforward: (a) we do not warrant accuracy of the source or our derivations; (b) we say plainly that the platform is a registry intelligence surface, not a product review; (c) we provide a takedown/correction mechanism; (d) we act on removal requests within a stated window. *Thai courts and the Thai Press Council have repeatedly held that prompt correction/removal is a strong defence.*

### 1.5 Bonus: พ.ร.บ.ว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ พ.ศ. 2550 (Computer Crime Act, amended 2017)

Section 14 penalises false data importation that damages the public. We import no false data — we import *published public data* and re-publish it. Section 16 covers content that affects national security, public order, or good morals. The OTOP catalogue is the opposite — it is the state's own list of legitimate rural enterprises. There is no realistic exposure under either section.

---

## 2. The data.go.th licence specifically

The `data.go.th` open-data portal operates under the **EGA Open Government License**, which is compatible with the **Open Data Commons Open Database License (ODbL)** and the **Creative Commons Attribution 4.0 (CC-BY 4.0)** family. Individual datasets carry per-resource licence tags; the most common in the OTOP catalogue are:

- **G0 — Open Data Common**: copy, distribute, modify, no restrictions. *Most datasets here.*
- **G1 — Creative Commons Attribution**: copy and modify with attribution. *Many provincial OTOP CSVs.*
- **G2 — CC BY-NonCommercial**: copy with attribution, *no commercial use*. *Some provincial datasets.*
- **G3.x — Share-Alike variants**: copy with attribution and share-alike. *Rare in this catalogue.*

The OGD licence as published on data.go.th is **silent on whether the licence covers the personal data inside the data**. The NSTDA presentation on Open Data (2018) is explicit: *"การอนุญาตให้ใช้ข้อมูลนี้ ไม่ครอบคลุมถึง 'ข้อมูลส่วนบุคคลที่อยู่ในเนื้อหาข้อมูล'"* — *the licence does not cover personal data within the content*. So we have:

- A licence to use the **data structure and non-personal elements** freely;
- A requirement to **attribute the source** for the data;
- A *parallel obligation* under the PDPA to handle the personal data inside the data with care.

This is the right reading and the one we adopt. The Provenance page says so plainly: we attribute, we do not claim the OGD licence covers the personal data, and we treat the personal data under the PDPA's research/statistics lawful basis.

---

## 3. The five risks, ranked, with mitigations

| # | Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|---|
| 1 | Producer claims we have no right to republish their name/phone/address | **Medium** — this is the most likely real-world objection | **Low** — strong PDPA defence, the state already published it, we attribute and provide takedown | Takedown page; Privacy Policy; Provenance page; prompt removal SLA |
| 2 | Data is wrong/outdated and we display a stale phone number, leading to a wrong-number call | **High** — source data is genuinely stale in places | **Low** — disclaimer of accuracy; we are a directory, not a transactor | "Data may be outdated" disclaimer; refresh date in the meta; "verify before acting" caveat in the Atlas |
| 3 | A producer sues for defamation because of a derived label ("not reachable", "no contact channel") | **Low** — labels are descriptive, not evaluative | **Medium** — even an unsuccessful suit is expensive in Thailand | Labels describe the data ("no contact channel in the registry"), not the product ("this is bad"); we do not assert quality or safety; takedown SLA |
| 4 | A criminal complaint under the Computer Crime Act (Section 14/16) for republishing "false" data | **Very low** — we do not modify the underlying data, only derive statistics | **High** — criminal exposure is qualitatively different | We do not import *false* data; we import *public* data and re-publish it; Provenance page is the receipt |
| 5 | A cross-border transfer complaint (PDPA Section 28) | **Low** — transit/storage exemption covers Cloudflare; adequacy decision covers most jurisdictions | **Low** | Privacy Policy discloses the cross-border hosting; we are not a new exporter, we are a re-publisher on a globally distributed platform |

The mitigations are not magic. They are: *a clear Provenance page; a clear Disclaimer; a takedown mechanism with a stated response window; no warranty of accuracy; prompt correction or removal on valid complaint*. These four moves are the universal pattern for legitimate re-publishers of public data in every common-law jurisdiction with which I am familiar, and they are equally well established in Thai practice.

---

## 4. What the fine print actually says

Five pages, in this order on the site footer:

| File | One-line purpose | Thai equivalent |
|---|---|---|
| `/legal/` (index) | "Fine print" — a single bilingual landing page that indexes the rest | รายละเอียดทางกฎหมาย |
| `/legal/terms.html` | Terms of Use — what you may and may not do, who runs the platform, what the warranties are, governing law | ข้อกำหนดและเงื่อนไขการใช้งาน |
| `/legal/privacy.html` | Privacy Policy — what we collect, what we re-publish, how to ask for a correction, who the data controller is | นโยบายความเป็นส่วนตัว |
| `/legal/provenance.html` | Data Provenance & License — exactly where the data comes from, what licence, attribution, what we add | แหล่งที่มาของข้อมูลและสัญญาอนุญาต |
| `/legal/disclaimer.html` | Disclaimer — no warranty of accuracy, no endorsement, no commercial outcome, no professional advice | การปฏิเสธความรับผิด |
| `/legal/takedown.html` | Correction & Takedown procedure — who can ask, what to include, response time | การแจ้งแก้ไขหรือลบข้อมูล |

The pages are short, plain, bilingual (English primary, Thai secondary at ~0.78em with `lang="th"` for screen readers), and follow the existing site aesthetic: sharp edges, no decoration, monochrome + amber accent, single column on mobile, two on desktop.

The **governing law** is Thailand. The **forum** is the Thai courts. The **operator** is Dr Non Arkaraprasertkul. The **contact email** is `otop@nonarkara.org` (which the user can route). The **last-updated date** is in the page footer of each legal page.

---

## 5. The things the fine print deliberately does *not* do

It does not try to bind the data subject. A privacy notice cannot be unilaterally imposed on a third party (the producer whose name is in the registry). It works because the platform *behaves* in the way the notice says, not because the notice itself is a contract with the producer.

It does not claim a trademark on "OTOP." "OTOP" and "OTOP Product Champion" are programme names; we use them descriptively, which is the only right anyone has to use them anyway.

It does not promise compliance with the GDPR. The site is a Thai-focused, Thai-hosted, Thailand-data directory. International users may access it; we do not solicit or target them. We are not within the GDPR's territorial scope for *republishing* Thai public data on a Thai operator's site; we are within it only if we market to EU residents, which we do not. We mention this for completeness.

It does not require a DPO. The PDPA's DPO requirement applies to controllers whose core activities require large-scale, regular, systematic monitoring of data subjects, or large-scale processing of sensitive data. We are not a controller in that sense — we re-publish static data. We do not need a DPO. If our posture changes (e.g. we start collecting user-uploaded data, or we run a contact form with retention), we revisit.

It does not promise completeness. We say plainly that the data is what the state has published, that we cannot warrant it is current, and that anyone acting on it should verify with the source.

---

## 6. The four correct answers to the user's question

> "I'm creating this website not from my data, but from data I got from data.go.th, including names. I assume these are public names because otherwise they wouldn't be on that system to begin with. I'm grabbing them from there, so I'm not liable for anything if it leads to anything."

**Answer 1**: Your assumption is *mostly* correct. The OTOP catalogue on `data.go.th` is published by the Department of Community Development under the EGA Open Government License, which permits re-use. The presumption of disclosure under the Official Information Act supports this.

**Answer 2**: The state published the data, but the OGD licence explicitly does not cover the *personal data* inside the data. The PDPA therefore applies to you as a downstream re-publisher. You are not exempt just because the source is public. But you have a clean lawful basis (research/statistics for public interest, Section 24(1)) if you handle the data responsibly.

**Answer 3**: You are not "not liable for anything." You are *not liable for the underlying data being wrong* if you publish a clear disclaimer and provide a takedown mechanism. You *are* liable if you add false statements, fail to act on valid takedown requests, or repurpose the data in ways the source licence does not allow.

**Answer 4**: The fine print at `/legal/` (terms, privacy, provenance, disclaimer, takedown) is the visible half of the protection. The other half is the *behaviour* the fine print describes: attribution, no warranty, prompt takedown, no re-identification, no commercial sale. The two together are what make the platform defensible.

---

## 7. What a Thai lawyer would actually check

If the user wants the documents signed off, the points a Thai lawyer would push on are:

1. **The operator's identity.** Dr Non personally or a Thai company? For liability under the Civil and Commercial Code Section 437 (vicarious liability) and the PDPA Section 39 (records of processing), the controller must be identified. *We identify Dr Non personally, with a contact email.*
2. **The data subject's right of erasure.** PDPA Section 33 grants the right to delete; we provide a takedown mechanism with a stated window. The lawyer would want a 30-day SLA documented.
3. **The contact for the PDPC.** The PDPC's contact details must be on the Privacy Policy.
4. **The data retention period.** PDPA requires that personal data not be retained longer than necessary. For our case, *as long as the source remains public* is the honest answer. The lawyer would want this stated.
5. **The lawful basis statement.** The Privacy Policy must declare the lawful basis under Section 24. *We declare Section 24(1) and 24(6).*

These five points are in the documents. They are the points a Thai lawyer will find and sign.

---

## 8. What this memorandum is not

It is not a Thai-law opinion. It is a working file by an AI assistant with access to the primary Acts, the PDPC's published guidance, and the relevant licence texts. *The user must consult a Thai lawyer before relying on it in a dispute.* The cost of that consult is a few thousand baht; the cost of relying on a non-lawyer's analysis in a dispute is several orders of magnitude more. Do the consult.

---

*— End of working draft. Cross-references: `otop-official-ecosystem-map.md` for the channel landscape; `/legal/*.html` for the documents; `otop.config.json` for the data pipeline that pulls from the sources named here.*
