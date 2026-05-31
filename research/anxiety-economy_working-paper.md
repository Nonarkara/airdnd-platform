# The Anxiety Economy

### Coded Intimacy, Displaced Labour, and the Repressive Hypothesis in Bangkok's Massage-Channel Market

**Peter Carl Riesck**

*Independent researcher; in informal association with Axiom (Thailand) and several small think tanks that have chosen, deliberately, not to incorporate.*

> Working Paper — Draft 0.2 · 2026 · Scaffold for circulation among colleagues, not for citation
> Built on an archive of 85,632 messages, read entirely by machine.

---

*A note on the name.* The author publishes under a name that is not, in the registrar's sense, his. He shares this practice with almost every subject in the corpus that follows — the women who post under *ฝน* (rain), *ดาว* (star), *Bella*, *Paula*; the operators who run a dozen channels under a dozen aliases. A name, in this economy, is not an identity. It is a firewall — against family, against the permanence of the record, against people who might find you outside of work, and, in the author's case, against the small and predictable set of people who, learning that a study like this exists, would prefer to pay for it to say something flattering rather than something true. The reader is asked to extend to the author the same courtesy the author extends to his subjects: to take the analysis on its evidence, and to leave the name alone.

---

## Abstract

This paper reports an unsupervised reading of 85,632 public Telegram messages, posted across nine channels over six years (2020–2026), that constitute the live nervous system of Bangkok's "massage" market — an industry that wears the uniform of therapeutic bodywork and sells, with near-total consistency in its own coded vocabulary, something else. Using text-fingerprinting, temporal analysis, and intent classification rather than interview or ethnographic immersion, I find a market organised not as a catalogue but as a real-time labour-dispatch system: 77.2% of all listing posts are exact repeats; demand resolves overwhelmingly to a single question — *availability* — with customers asking to book roughly twelve times more often than they ask the price; the price that *is* named clusters at a median of ฿450, which I argue is an *alibi* price (the cost of the legitimate-massage cover story, not of the transaction it conceals); and supply broadcasts in a compulsive daily rhythm that peaks at the opening hour of 9am. I read these patterns against four literatures the data unexpectedly joins: the Foucauldian account of sexual discourse under power; the economic sociology of intimacy (Zelizer, Bernstein, Hochschild); the long Thai and Mekong scholarship on rural-to-urban and now cross-border female labour migration (Phongpaichit, Agustín, Ong); and the emerging study of platform self-commodification (the OnlyFans literature). The central argument is uncomfortable and is offered as such: the prohibition does not suppress this economy. It *produces* it — produces its coded language, its precarity, its disposable and unnamed migrant labour, and the very stigma that makes the work dangerous. The "collapse" that a moral reading would locate in the women is more honestly located in the contradiction the rest of us maintain: an economy that requires the commodification of intimacy at scale, and a public morality that forbids us to say so.

**Keywords:** informal labour; sex work; commodification of intimacy; labour migration; Foucault; repressive hypothesis; Thailand; Mekong; platform economy; computational ethnography.

---

## 1. Introduction: A Doorway in the Feed

At 9:14 in the morning, in a Telegram channel with a few thousand members, a message arrives. It says the shop is open, lists the hours, drops a pin on a map, and announces that the girls have come in for the day. Four minutes later, an almost identical message arrives in a second channel. By the afternoon, the same message — the same words, the same emoji, fingerprint-identical — will have been posted again, and again, and again. Over the life of the archive, one such message was posted **711 times.**

This is not, on its face, a remarkable scene. It is a shopkeeper standing in a doorway, doing the oldest thing a shopkeeper does: making herself visible to the traffic. What is remarkable is only the scale at which the gesture has been industrialised, and what the machine-reading of 85,632 such gestures turns out to reveal — not about sex, which is the least interesting thing here, but about labour, migration, language, and the peculiar arrangement by which a society organises a market it has agreed not to admit exists.

I did not set out to study sex. I set out to study **visibility under precarity** — the behaviour of economic actors who have no reputation system, no reviews, no verified history, and for whom, therefore, the only signal available is recency. The massage-channel market is an almost laboratory-pure instance of this condition, and it happens, for reasons that are themselves the subject of §4 and §5, to be a sexual market dressed as a therapeutic one. The dressing is not incidental. It is the whole point.

A word on what this paper is and is not. It is not an exposé; the trade is neither hidden nor surprising, and a great deal of brave, careful ethnography already documents the lives I only read in aggregate (I lean on it throughout). It is not advocacy, in either direction — neither for the rescue of these women nor for the deregulation of their work, both of which positions I will argue are too clean for the evidence. And it is not, despite its method, a celebration of computation. The machine reads everything and understands nothing; what it offers is a census of a discourse, and a census is only the beginning of a reading. This is a scaffold. It is meant to be added to.

---

## 2. Method, and Why It Is Also an Argument

The corpus is the complete public message history of nine Telegram channels — aggregator channels that re-broadcast many shops, and shop-specific channels that broadcast one — totalling 85,632 messages from January 2020 to May 2026. Of these, an AI extraction pipeline classified 5,867 as **listing** broadcasts (the supply side: a shop announcing itself), 6,316 as **discussion** and **feedback** (the demand side: customers and operators in conversation), and the remainder as unclassified chatter. No human read the corpus. The findings in §4 are produced by three procedures: hour-of-day and day-of-week binning in Bangkok time; text-fingerprinting (normalising each post to its Thai/Latin/numeric skeleton and collapsing identical skeletons) to detect repeats and cross-posts; and keyword-intent classification of the conversational messages.

This method is a limitation and it is also a position. I cannot tell you, from this data, what any individual woman feels, intends, or chooses — the great strength of ethnography, which I forfeit. What I can tell you is what the market *says,* in aggregate, when it thinks only its intended readers are listening — and, more revealingly, what it consistently *declines* to say. A discourse analysis at this scale is blind to the interior and merciless about the exterior. It is, in that sense, the methodological complement to Foucault's (1978) insistence that we attend not to the hidden truth of sex but to the proliferating, regulated *talk* about it. The corpus is that talk, frozen and counted.

One further reflexive point, already raised in the note on names and worth stating as method: pseudonymity is not a flaw in this study but a shared condition of researcher and researched, and it is itself data. When the worker hides her name and the analyst hides his, both are responding to the same structural fact — that to be *named* in relation to this economy is to be exposed to its costs. Hold that symmetry. It returns in §5.

> **[Probe — to add]** Validation against ground truth: a small ethnographic sub-study (10–15 semi-structured interviews) to test whether the machine's reading of "availability as the operative variable" matches operators' own accounts. The computational census proposes; only fieldwork can confirm.

---

## 3. Four Conversations the Data Joins

The patterns in §4 are mute until placed in conversation. The data speaks to four literatures at once, and the argument of the paper is, in part, that these four have always been one conversation that disciplinary borders kept apart.

### 3.1 The repressive hypothesis, and its discontents

The folk theory of sex and society — the one most of us carry, the one implicit in Dr Non's framing that prompted this study — is that society *represses* sex: that there is a natural, primal drive, and a civilisation that sits on it, and that the pressure escapes at the margins, in places like this. Foucault (1978) spent a volume arguing that this "repressive hypothesis" is precisely backwards. Modernity did not silence sex; it incited an endless, proliferating discourse about it — confessional, medical, juridical, statistical — while subjecting that discourse to ever-finer techniques of regulation. Power does not say *no* to sex. It organises, classifies, and multiplies the talk.

The corpus is a near-perfect illustration. Here is a sexual market that produces 85,632 messages — a torrent of discourse — *precisely by never naming what it sells.* The prohibition has not produced silence; it has produced **code** (§4.4). Gayle Rubin's (1984) "charmed circle" — the moral line that sorts good sex from bad and licenses the state to police the boundary — is visible in the data as the exact seam the language is built to straddle: legitimate enough to avoid the police, ambiguous enough to attract the customer. And Bataille (1986 [1957]) supplies the final turn: taboo and transgression are not opposites but mutual constituents; the prohibition does not merely fail to suppress the erotic, it *manufactures* it, charges it, gives it its value. The shower is erotic *because* it cannot be named.

### 3.2 Intimacy as commerce

A second literature dissolves the moral panic from the other side. Zelizer (2005) demolished the "hostile worlds" assumption — the belief that intimacy and economic transaction occupy separate spheres whose mixing degrades both. Intimacy, she showed, is *always* economically organised; the question is never whether money and intimacy mix but which matches of relation and transaction a society treats as proper. Bernstein (2007), studying post-industrial sexual commerce, named the product precisely: **"bounded authenticity,"** the sale not of a body but of a credible performance of genuine connection, time-limited and skilfully managed. Hochschild's (1983) *emotional labour* is the technique; Illouz (2007) the macro-frame, in which late capitalism increasingly commodifies feeling itself. The masseuse who manages her affect for a stranger is doing, with higher stakes and lower pay, the same labour as the flight attendant and the therapist. The data's relentless **น้อง** ("younger sibling," 6,716 occurrences) is bounded authenticity's grammatical instrument: a single diminutive that manufactures softness, deference, and safety on demand.

### 3.3 From peasant girls to Bangkok masseuses — and now across the Mekong

The third conversation is the oldest and the most local. Pasuk Phongpaichit's foundational ILO study *From Peasant Girls to Bangkok Masseuses* (1982) traced, four decades ago, the exact circuit this corpus digitises: girls from the poorer north and north-east drawn to Bangkok's massage trade, their urban earnings and remittances sustaining whole rural households. The masseuse was, and is, an *infrastructure of rural welfare* — a fact that the moral framing of her work systematically erases. What the present data adds is the next chapter of that circuit, and it adds it by a silence (§4.4, §5.1). The contemporary Mekong labour pool is no longer only Thai-rural. As of mid-2024, more than five million non-Thai nationals were living and working in Thailand (IOM 2024), over three million of them from Myanmar — a flow intensified by the 2021 coup and the February 2024 conscription law — alongside several hundred thousand Cambodians, until the 2025 border crisis sent some 900,000 of them fleeing home in a fortnight (RFA 2025; HRW 2025). Migrants to Thailand earn 2.2 to 2.6 times their pre-migration income (World Bank 2025); the premium is real, and so is the precarity, with at least 1.8 million in irregular status. Agustín (2007) and Ong (1987) supply the necessary correction to a naïve trafficking frame: much of what a rescue politics reads as victimhood is, from the inside, a rational labour migration by women exercising what agency a brutal opportunity structure allows. The truth, as §5.2 argues, is neither the victim nor the entrepreneur but both at once, and the refusal to collapse the two is the analytic discipline this subject demands.

### 3.4 The platform turn: the masseuse as analog ancestor

The fourth literature is the newest and, to the contemporary reader, the most familiar. The recent scholarship on OnlyFans and platform sex work (Schuchmann 2025; Di Cicco and Beraldo 2025; and a fast-growing corpus on emotional labour, self-branding, and precarity in digital intimacy) describes a world that the massage channel anticipates with eerie precision. The OnlyFans creator manages bounded authenticity (Bernstein again, now the field's load-bearing concept), self-brands across platforms, and survives in a precarious ecosystem governed by recency and algorithmic visibility. So does the Telegram operator. The "rise of the self-proclaimed pornographer" that so unsettles the present moment is not a rupture; it is the **generalisation** of a logic the Bangkok massage channel has run for years. The platform did not invent the commodification of intimate self-presentation. It scaled it, individualised it, and — crucially — let the worker keep the channel. The massage channel is OnlyFans with a shopfront and a landlord. Reading them together (a probe I return to in §5.3) suggests that what looks like a contemporary moral collapse is the surfacing, into the global and the visible, of an arrangement the margins have long maintained.

---

## 4. Findings

All figures below are produced by the procedures in §2 and are reproducible from the public artifact `research.json`.

### 4.1 The anxiety clock

Posting is a daily rite with the shape of a working day and the affect of a fear. The hour-of-day distribution of 5,867 listing broadcasts is dead between 1 and 5am, climbs steeply from 8am, and **peaks in the 9am–noon window** (1,480 posts), before settling into a long, sustained plateau through the afternoon and evening and tapering after 9pm. The peak is not the busiest hour for customers; it is the *opening* hour — the moment when a shop, having just unlocked, does not yet know whether it will earn today. I read the morning surge as the opening anxiety of informal labour made periodic: the doorway gesture, performed at the hour of maximum uncertainty.

The rhythm has two tempos. **57%** of operator-days consist of a single solo post — a quiet flag raised once. But **19.5%** are flooding days of five posts or more, and one channel posted **110 times in a single day.** The same doorway, opened and re-opened, because the feed forgets you the moment you stop standing in it.

### 4.2 The repeat compulsion

Fingerprinting every post against every other reveals the engine. Of 5,563 fingerprinted broadcasts, only **1,271 are unique.** **77.2%** of everything posted is a *repeat* — the same listing, sent again. **77.6%** of a channel's consecutive posts arrive less than an hour apart. And the content does not stay in one room: **45.5%** of unique posts appear on more than one channel, the same broadcast sprayed across up to three groups at once.

The honest interpretation requires a caveat I will not bury, and the data now lets me quantify it. The market is two-tier: **two aggregator channels carry 4,597 of the broadcasts** (firing every few minutes), and **seven shop-specific channels carry 1,270** (surfacing roughly once a day). The sub-hour cadence is overwhelmingly an *aggregator* behaviour — a clearing-house throughput — not the minute-by-minute desperation of a single woman. The desperation belongs to the infrastructure; the individual shop, more often, just opens the door once and waits. But the repeat rate is robust to this distinction, and it points to a structural truth about reputation-free markets. Where there are no reviews and no verified history, **recency is the only signal.** The operator who posted three minutes ago outranks the one who posted yesterday; visibility decays the instant broadcasting stops; and so the rational act is to never stop. This is not marketing. It is the behaviour of an actor who believes, correctly, that to become invisible is to cease to exist.

### 4.3 What the buyers actually ask

Turn the archive over and read the demand side — 6,316 customer messages — and the market's true organising variable appears. Classified by intent, customer questions distribute as: **general inquiry 53.6%; booking/queue 40.3%; price 3.4%; availability 2.6%** (as an explicit question); **location 0.1%; hours 0.0%.** Customers ask to *book* — to reserve a person, a slot, a queue — roughly **twelve times more often than they ask the price**, and they essentially never ask where a place is or when it opens.

This is the paper's quietest and most consequential finding. A normal directory exists to answer *where, when,* and *how much.* This market has pre-empted all three: every broadcast already carries the pin, the hours, and the rate. The friction is gone. What remains — the only thing left to negotiate — is **availability:** is a person free, right now, and can I have her. A market that has eliminated price and place as questions, and reorganised itself entirely around the real-time reservation of a human being, is no longer behaving like a catalogue. **It is behaving like a labour-dispatch system** — and the thing being dispatched is people.

### 4.4 The lexicon of the threshold

Here the machine earns its keep, because the market's central operation is *lexical.* The work is sold by never naming the work. The euphemisms are not decoration; they are the load-bearing structure, and they cluster, revealingly, around a single image — the **threshold** between therapeutic and sexual contact, encoded as a sequence of spatial and bodily preconditions that the intended reader assembles and the censor cannot prosecute.

| Term | Occurrences | What it encodes |
|---|---|---|
| **ห้อง** (room) | 2,138 | *Enclosure.* The existence of a private room signals that what happens is not the public, clothed, therapeutic massage but something requiring a door. |
| **น้ำมัน / นวดน้ำมัน** (oil / oil massage) | 610 / 438 | *Exposure.* The shift from dry Thai massage (clothed, pressure) to oil (undressed, glide) is the threshold of the erotic — the body reconstituted as a surface. |
| **อโรมา** (aroma) | 418 | *Atmosphere.* The aromatherapy frame imports a spa legitimacy while signalling the oil-and-skin register beneath it. |
| **บอดี้** (body) | 385 | *Contact.* "Body" — body massage, body-to-body — names the medium without naming the act. |
| **อาบ** (shower / soap) | 317 | *Preparation.* The ablution — the famous *อาบอบนวด,* soap-steam-massage — the ritual that prepares and signals. To "take a shower together" is the whole transaction in a single deniable verb. |

The sequence is a grammar of the threshold: **a room** (enclosure), **oil and aroma** (exposure), **a shower** (preparation). Assembled, they describe the full service without uttering a prosecutable word. And the most telling number in the table is one that is not there: **ฟรีสไตล์** ("freestyle," the explicit term for service without limits) appears **zero** times. The code self-censors at exactly the boundary where deniability would fail. This is Foucault rendered as frequency count: the discourse proliferates (10,000+ threshold terms) *by* withholding its referent, and the one word that would make the referent explicit is the one word the market has learned never to say.

Against this, the diminutive **น้อง** (6,716) and the availability marker **ว่าง** ("free/available," 1,815) and **น้องใหม่** ("new girl," 1,573) do the affective and logistical work: softness, freshness, and the perpetual signal that someone is available *now.* The lexicon and the dispatch-system finding (§4.3) are the same fact seen twice.

> **[Probe — attempted, and a finding about the instrument]** I tried to read the lexicon diachronically — to track euphemism drift across the six-year window as a "textual seismograph" of enforcement. The attempt failed, instructively. Although the raw corpus reaches back to 2020, the *classified listing* extraction is heavily recency-weighted: only the last three months (March–May 2026) carry enough broadcasts (200, 1,791, 3,320) to support a monthly reading. The apparent "growth" of the market from a handful of posts per year to thousands is therefore an artifact of the scraper's coverage, **not** a measured expansion of the trade, and I decline to present it as one. The seismograph remains the single most promising desk-based probe, but it requires a backfill of historical listing-classification before it can speak. The instrument is built; the tape does not yet run deep enough. (See Appendix A.2.)

### 4.5 The alibi price

Where the corpus names a number at all — and §4.3 already showed it rarely does — the number clusters with revealing tightness. Across 551 baht figures extracted from the text (only where a price token sits adjacent, bounded to exclude phone numbers and clock times), the **median named price is ฿450**, and the distribution is sharply low: **51.5% fall in ฿200–499, 38.3% in ฿500–999** — roughly nine in ten under one thousand baht — with a thin tail of ฿2,000-plus (8%).

Read in isolation this looks like ordinary therapeutic pricing, and that is precisely the point. The visible price is the *legitimate-massage* price: the ฿450 hour of dry, clothed, pressure-point bodywork that the entire threshold lexicon (§4.4) is built to invoke as alibi. The other price — the one attached to what the room, the oil, the shower, and the diminutive actually imply — is the one figure the corpus almost never contains. It is settled in private, off the record, in the same silence that withholds the women's names (§4.4) and their nationalities (§5.1). **The price you are permitted to read is the price of the cover story.** The market's pricing transparency is not transparency; it is the public half of a two-tier tariff whose real schedule is, by design, undocumented. A directory that publishes the alibi and hides the transaction is not under-reporting; it is *correctly* reporting the only price the prohibition allows it to write down.

---

## 5. Discussion: Three Scaffolded Probes

The findings above are firm. What follows is more speculative — the beginning of an interpretation that further work must test. I mark it as such.

### 5.1 Who are they? Reading the silence

The data cannot directly tell us who these women are. But it tells us, with great force, *who the market refuses to name,* and read against the migration statistics that silence is eloquent. The corpus names **นักศึกษา** (student) 115 times, **เวียดนาม** (Vietnamese) 176 times — and **พม่า** (Burmese) **zero** times, **เขมร/กัมพูชา** (Cambodian) **zero** times, **ลาว** (Lao) **twice.** Yet the labour pool that actually staffs Thailand's informal economy is, per the migration data, overwhelmingly Burmese and Cambodian — millions of them, many irregular, many displaced by the coup and the conscription and the border war.

The conclusion is not that these workers are absent. It is that they are **unadvertised** — folded into the undifferentiated **น้อง,** their nationality a market liability to be hidden, while "Vietnamese" is *named* precisely because it carries a desirable cachet and "student" is named because youth and the fantasy of the non-professional sell. The market's silence performs, at the level of language, the same erasure the law performs at the level of status: the most precarious worker — the irregular migrant, the post-coup refugee — is rendered invisible, her labour absorbed without acknowledgement. The firewall name (the woman hides her identity) extends to a **firewall nationality** (the market hides her origin). Pasuk's remittance economy has gone cross-border, and the cross-border worker is the one the discourse is most careful never to mention.

> **[Probe — to add]** This is the single most important claim to validate and the hardest. Photo-level analysis, language-of-posting analysis, and targeted fieldwork could each triangulate the demographic composition the text suppresses. Until then this stands as a strong inference from a structured absence, not a demonstrated fact. State it that way.

### 5.2 The status of women, held in tension

It is tempting, and it is wrong, to resolve this study into a single verdict on these women — victim or entrepreneur, coerced or free. The evidence forbids the resolution. The same corpus contains the firewall name (a defensive, protective intelligence), the remittance economy (a woman supporting a household the state does not), the bounded-authenticity labour (genuine skill, genuinely sold), the flooding desperation of the visibility trap, and the structural coercion of an opportunity set narrowed by poverty, displacement, and law. Agustín (2007) is right that the rescue frame infantilises; the trafficking literature (Bales and others) is right that real coercion exists; and the honest position is to hold both without flinching toward the comfort of either. The status of women that this market reveals is the status of women under a specific contradiction: asked to commodify intimacy because the economy rewards it, and shamed for doing so because the morality forbids it — and made to absorb, in their own bodies and aliases, the cost of the gap between the two.

### 5.3 The collapse, reconsidered

Which returns us to the prompt that began this study — the intuition that something is collapsing, and that the collapse and the taboo are related. I think the intuition is correct and the usual reading of it is exactly inverted.

The moral reading locates the collapse *in the women* — in their choices, their numbers, the apparent ease with which a generation now self-commodifies, on OnlyFans and its analogues, at a scale without precedent. But the data, read through Foucault, relocates it. The prohibition does not suppress this economy; it **produces** it — produces the code (§4.4), the precarity (§4.2), the disposable and unnamed migrant labour (§5.1), and, above all, the *stigma* that makes the work dangerous rather than merely difficult. A society that needed this labour to be invisible got exactly the invisibility it demanded, and then mistook the invisibility for an absence, and then mistook the occasional surfacing of the inevitable into the visible — the massage channel, the OnlyFans feed — for a new decay.

There is nothing new in it. There is only the scaling, individualising, and platforming of an arrangement the margins always ran. The "collapse," if the word is to be used at all, is not moral and it is not located in the women. It is the visible cost of a contradiction the rest of us maintain in good conscience: an economy that requires the commodification of intimacy at industrial scale, and a public culture that forbids us to say so, and that therefore drives the entire apparatus into a coded, criminalised, deniable underground where the people who staff it must hide their faces, their names, and their countries of origin in order to do work the economy is quietly delighted to buy.

Dr Non's framing — that had we not made our most primal needs so taboo, we might not have arrived here — is, in the end, a version of Foucault's: not a libertarian plea to deregulate, but the harder observation that *the regulation is productive of the harm it names.* One need not believe that the answer is the open market in intimacy (it is not obviously better; Zelizer would warn that the question is always *which* matches we permit, never whether money and intimacy may touch). One need only notice that the prohibition has not stopped the thing. It has only made it dangerous, and silent, and 85,632 messages deep, and very, very good at never saying its own name.

---

## 6. Conclusion

I began by saying that the least interesting thing in this archive is sex, and I will end there. What is interesting is a doorway, opened at 9am by someone who does not yet know whether she will eat tonight, and broadcast 711 times because the feed forgets her the instant she stops; a customer who asks not *how much* but *is she free, now;* a language built with great collective skill to say everything and admit nothing; and a labour force the size of a small nation, drawn across collapsing borders, absorbed into an economy that depends on it and a morality that disowns it, and folded, all of it, into a single soft word that means *younger sister.*

It would be a tidy ending to say what should be done. I don't know what should be done, and I distrust the people who are certain. I know only what the data says, which is smaller and harder: that this is not a story about bad women or a fallen age. It is a story about the cost of a silence we all keep, paid by the people least able to afford it, and now — through the same platforms that let the rest of us watch — becoming, for the first time, too large to keep silent about. Whether we will be able to look at it without immediately reaching for the old, comforting, repressive lie is, I think, the open question. The machine has finished reading. The reading has barely begun.

---

## References

- Agustín, Laura María. 2007. *Sex at the Margins: Migration, Labour Markets and the Rescue Industry.* London: Zed Books.
- Bataille, Georges. 1986 [1957]. *Erotism: Death and Sensuality.* Trans. Mary Dalwood. San Francisco: City Lights.
- Bernstein, Elizabeth. 2007. *Temporarily Yours: Intimacy, Authenticity, and the Commerce of Sex.* Chicago: University of Chicago Press.
- Brennan, Denise. 2004. *What's Love Got to Do with It? Transnational Desires and Sex Tourism in the Dominican Republic.* Durham, NC: Duke University Press.
- Cheng, Sealing. 2010. *On the Move for Love: Migrant Entertainers and the U.S. Military in South Korea.* Philadelphia: University of Pennsylvania Press.
- Di Cicco, Margherita, and Davide Beraldo. 2025. "Sex Work as Cross-Platform Self-Branding: Challenges and Strategies of OnlyFans' Content Creators in a Precarious Ecosystem." *New Media & Society* (online first).
- Foucault, Michel. 1978 [1976]. *The History of Sexuality, Volume 1: An Introduction.* Trans. Robert Hurley. New York: Pantheon.
- Hochschild, Arlie Russell. 1983. *The Managed Heart: Commercialization of Human Feeling.* Berkeley: University of California Press.
- Human Rights Watch. 2025. *"I'll Never Feel Secure": Undocumented and Exploited Myanmar Nationals in Thailand.* New York: HRW.
- Illouz, Eva. 2007. *Cold Intimacies: The Making of Emotional Capitalism.* Cambridge: Polity.
- International Organization for Migration (IOM). 2024–2025. *Thailand Labour Migration Profile* and *Rapid Assessment, Ranong and Tak Provinces.* Bangkok: IOM Thailand.
- Jones, Angela. 2020. *Camming: Money, Power, and Pleasure in the Sex Work Industry.* New York: NYU Press.
- Ong, Aihwa. 1987. *Spirits of Resistance and Capitalist Discipline: Factory Women in Malaysia.* Albany: SUNY Press.
- Phongpaichit, Pasuk. 1982. *From Peasant Girls to Bangkok Masseuses.* Geneva: International Labour Office.
- Rubin, Gayle. 1984. "Thinking Sex: Notes for a Radical Theory of the Politics of Sexuality." In *Pleasure and Danger: Exploring Female Sexuality,* ed. Carole S. Vance. Boston: Routledge & Kegan Paul.
- Schuchmann, [first initial]. 2025. "Elites of the Whorearchy — OnlyFans Creators' Power, Identity and Sex Work Stigma Negotiation." *Gender, Work & Organization* (online first).
- World Bank. 2025. *Labor Mobility from Cambodia, Lao PDR, and Myanmar to Thailand.* Washington, DC: World Bank.
- Zelizer, Viviana A. 2005. *The Purchase of Intimacy.* Princeton, NJ: Princeton University Press.

*Contemporary figures on migration and the informal economy are drawn from IOM (2024–2025), HRW (2025), RFA reporting (Jan. 2025), the World Bank (2025), and standard estimates of Thailand's informal economy at c. 42% of GDP. Full citation details to be completed in Draft 0.2.*

---

## Appendix A: Scaffolding Register — What to Probe Next

This paper is a skeleton with load-bearing prose. The following are the joints where it should grow, in rough priority:

1. **The demographic silence (§5.1)** — the strongest claim and the least proven. Triangulate the migrant composition the text suppresses (photo, language-of-posting, fieldwork). Highest analytic payoff, highest difficulty.
2. **The diachronic lexicon (§4.4) — blocked on data, not method.** The seismograph code is built and runs; the *listing-classification* is recency-weighted (only Mar–May 2026 are dense), so the tape is too short. The unlock is a historical backfill: re-run the AI listing classifier over the full 2020-onward raw archive (the raw messages exist; only their *labels* are recent). Once the tape runs deep, this becomes the highest-yield probe in the study — a textual record of enforcement episodes datable from the language alone.
3. **The aggregator/shop distinction (§4.2) — done (Draft 0.2).** Two aggregators (4,597 posts) vs seven shops (1,270); the sub-hour cadence is aggregator throughput. Next: re-run the interval distribution *within* the shop tier alone to isolate genuine individual-shop rhythm.
4. **Pricing (§4.3, §4.5) — done (Draft 0.2).** Median ฿450, ~90% under ฿1,000; established as the *alibi* price. Next: mine the ฿2,000+ tail and the rare explicit transactional language to estimate the hidden second tariff.
5. **Ethnographic validation (§2)** — 10–15 interviews to test the dispatch-system thesis against operators' self-understanding. The computational census proposes; fieldwork disposes.
6. **The OnlyFans bridge (§3.4, §5.3)** — a direct comparative read of a sample of Thai OnlyFans self-branding against the massage-channel lexicon. Does the analog ancestor's grammar survive the platform turn?
7. **The economic magnitude** — situate the channel economy within the c. 42%-of-GDP informal sector and the various (and wildly divergent) estimates of the sex industry's share, with proper scepticism about all of them.

*Draft 0.1 ends here. Add, contest, and probe.*
