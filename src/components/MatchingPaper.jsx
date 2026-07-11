import { useLanguage } from '../context/LanguageContext';
import './Paper.css';
import './MatchingPaper.css';

// ── Comparison table ───────────────────────────────────────────────────────────
function ComparisonTable() {
  const rows = [
    { fn: 'Discovery',       platform: 'Algorithmic search + ranking',                  telegram: 'Broadcast + chronological feed + repeat' },
    { fn: 'Trust',           platform: 'ID verification, ratings, host guarantee',      telegram: 'Channel membership, operator longevity, whisper network' },
    { fn: 'Availability',   platform: 'Real-time calendar / inventory system',          telegram: '"ว่าง" broadcast ("free now") — supply calls demand' },
    { fn: 'Price discovery', platform: 'Listed price, sometimes dynamic',               telegram: 'Alibi price (฿450 median) visible; real price negotiated in DM' },
    { fn: 'Match',           platform: 'Booking confirmation / driver accepts',         telegram: 'DM conversation — invisible to corpus, private by design' },
    { fn: 'Quality control', platform: 'Star ratings, dispute resolution team',        telegram: 'Whisper idioms (11/85,632 msgs = 0.013%); exclusion from channel' },
  ];
  return (
    <div className="paper-fig" style={{ overflowX: 'auto' }}>
      <div className="paper-fig-cap">Table I · Five matching functions — platform vs. informal channel</div>
      <table className="match-table">
        <thead>
          <tr>
            <th>Function</th>
            <th>Airbnb / Uber model</th>
            <th>Telegram informal market</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fn}>
              <td className="match-td-fn">{r.fn}</td>
              <td>{r.platform}</td>
              <td className="match-td-tg">{r.telegram}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="paper-fig-note">
        Both models solve the same five functions. The platform model uses capital to build infrastructure.
        The informal model uses broadcast density and community exclusion.
      </p>
    </div>
  );
}

// ── Matching stack SVG ─────────────────────────────────────────────────────────
function MatchingStackDiagram() {
  return (
    <div className="paper-fig paper-diagram-container">
      <div className="paper-fig-cap">Diagram I · The three-layer matching stack</div>
      <div className="paper-diagram-scroll">
        <svg viewBox="0 0 700 200" className="paper-diagram-svg" aria-label="Matching stack diagram">
          <defs>
            <marker id="arrow-m" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--mango)" />
            </marker>
          </defs>

          {/* Layer 1: Broadcast */}
          <rect x="10" y="40" width="160" height="70" fill="var(--surface)" stroke="var(--mango)" strokeWidth="1" />
          <text x="90" y="65" textAnchor="middle" fill="var(--mango)" fontSize="9" fontWeight="700" letterSpacing="1">BROADCAST LAYER</text>
          <text x="90" y="82" textAnchor="middle" fill="var(--ink-3)" fontSize="8">85,632 messages</text>
          <text x="90" y="95" textAnchor="middle" fill="var(--ink-3)" fontSize="8">77.2% repeats · 9 channels</text>

          {/* Arrow 1→2 */}
          <path d="M 170 75 L 200 75" fill="none" stroke="var(--line-2)" strokeWidth="1.2" markerEnd="url(#arrow-m)" />
          <text x="185" y="68" textAnchor="middle" fill="var(--ink-4)" fontSize="7">Filter</text>

          {/* Layer 2: Channel filter */}
          <rect x="200" y="40" width="160" height="70" fill="var(--surface)" stroke="var(--line-2)" strokeWidth="1" />
          <text x="280" y="65" textAnchor="middle" fill="var(--ink)" fontSize="9" fontWeight="700" letterSpacing="1">FILTER LAYER</text>
          <text x="280" y="82" textAnchor="middle" fill="var(--ink-3)" fontSize="8">Channel membership</text>
          <text x="280" y="95" textAnchor="middle" fill="var(--ink-3)" fontSize="8">self-selects for intent</text>

          {/* Arrow 2→3 */}
          <path d="M 360 75 L 390 75" fill="none" stroke="var(--line-2)" strokeWidth="1.2" markerEnd="url(#arrow-m)" />
          <text x="375" y="68" textAnchor="middle" fill="var(--ink-4)" fontSize="7">DM</text>

          {/* Layer 3: Private negotiation */}
          <rect x="390" y="40" width="160" height="70" fill="var(--surface-2)" stroke="var(--line-2)" strokeWidth="1" strokeDasharray="4 2" />
          <text x="470" y="65" textAnchor="middle" fill="var(--ink-2)" fontSize="9" fontWeight="700" letterSpacing="1">NEGOTIATION LAYER</text>
          <text x="470" y="82" textAnchor="middle" fill="var(--ink-4)" fontSize="8">Private DM — invisible</text>
          <text x="470" y="95" textAnchor="middle" fill="var(--ink-4)" fontSize="8">to corpus</text>

          {/* Arrow 3→agreement */}
          <path d="M 550 75 L 580 75" fill="none" stroke="var(--mango)" strokeWidth="1.2" markerEnd="url(#arrow-m)" />

          {/* Agreement */}
          <rect x="580" y="50" width="110" height="50" fill="var(--surface)" stroke="var(--mango)" strokeWidth="1.5" />
          <text x="635" y="72" textAnchor="middle" fill="var(--mango)" fontSize="9" fontWeight="700">AGREEMENT</text>
          <text x="635" y="88" textAnchor="middle" fill="var(--ink-4)" fontSize="7">never observed</text>

          {/* Corpus boundary line */}
          <line x1="555" y1="20" x2="555" y2="180" stroke="var(--line-2)" strokeWidth="1" strokeDasharray="3 3" />
          <text x="558" y="18" fill="var(--ink-4)" fontSize="7">corpus boundary</text>

          {/* Labels below */}
          <text x="90" y="145" textAnchor="middle" fill="var(--ink-4)" fontSize="7.5">Public · in archive · analysable</text>
          <text x="280" y="145" textAnchor="middle" fill="var(--ink-4)" fontSize="7.5">Public · implied by membership</text>
          <text x="470" y="145" textAnchor="middle" fill="var(--ink-4)" fontSize="7.5">Private · by design</text>
          <text x="635" y="145" textAnchor="middle" fill="var(--ink-4)" fontSize="7.5">Inferred · never seen</text>
        </svg>
      </div>
      <p className="paper-fig-note">
        The match resolves at the boundary of what the corpus can see. Every mechanism that makes the
        agreement possible is observable. The agreement itself is not. This is not a data gap —
        it is the privacy architecture of the market.
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function MatchingPaper() {
  const { t } = useLanguage();
  const pc = t.pageChrome || {};

  return (
    <article className="paper">
      <header className="meth-header">
        <a href="/sociology" className="meth-back">{pc.backToFieldNotes || '← Field Notes'}</a>
        <span className="meth-label">Research Paper II</span>
      </header>

      {/* Masthead */}
      <div className="paper-masthead">
        <span className="eyebrow">Working Paper · 2026 · Platform Economics &amp; Informal Markets</span>
        <h1 className="paper-title">The Invisible Handshake</h1>
        <p className="paper-subtitle">How an Informal Economy Solved Algorithmic Matching Without an Algorithm</p>
        <p className="paper-byline">
          <strong>Non Arkaraprasertkul</strong> — PhD Anthropologist (Harvard); Architect (MIT);
          Senior Expert, depa (Digital Economy Promotion Agency, Thailand).
          In informal association with Axiom (Thailand) and several small think tanks that have chosen,
          deliberately, not to incorporate.
        </p>
        <p className="paper-namenote">
          Empirical base: 85,632 Telegram messages across 9 channels, 2020–2026. All operator and provider
          names are performance names, not legal identities. Raw text containing phone numbers, LINE IDs,
          and direct contact information is redacted in public-facing figures.
        </p>
      </div>

      {/* Abstract */}
      <div className="paper-abstract">
        <span className="paper-h">Abstract</span>
        <p>
          Across 85,632 Telegram messages spanning six years, Bangkok's informal massage and spa economy
          has developed a functional equivalent of every feature that digital platform companies spend
          billions of dollars building: discovery, availability signaling, trust verification, price
          anchoring, and quality control. It built none of this on purpose. It built it out of the only
          materials available — public broadcast channels, telephone numbers, and the collective discipline
          of operators who understand that to stop posting is to disappear.
        </p>
        <p>
          This paper argues that algorithmic matching is not a technological breakthrough. It is the
          convergence of five old market functions onto a new substrate. The Bangkok case demonstrates
          that when those functions are solved — even crudely, even at the cost of 77.2% signal
          redundancy — the market works. The handshake happens. It just happens where no one can see it.
        </p>
        <p className="paper-keywords">
          Keywords: informal economy · platform economics · two-sided markets · matching theory ·
          Telegram · Thailand · digital anthropology
        </p>
      </div>

      {/* § I */}
      <section className="paper-sec">
        <span className="paper-num">§ I</span>
        <h2 className="paper-h">The Problem All Markets Are Trying to Solve</h2>
        <p className="paper-lead">
          A market needs to answer five questions before a transaction can occur: where is what I want?
          Is it available now? Can I trust the provider? What is the price? And if something goes wrong,
          what recourse do I have? Platform companies — Airbnb, Uber, Grab, Seek — spend their entire
          engineering budget building systems to answer these five questions at scale. Algorithmic search
          answers the first. Real-time inventory management answers the second. Identity verification,
          reviews, and insurance answer the third and fifth. Dynamic pricing answers the fourth.
        </p>
        <p className="paper-lead">
          The assumption embedded in that engineering effort is that these functions require code.
          That they require servers, databases, machine learning, and venture capital to bootstrap
          supply-side participation. The Bangkok informal economy disagrees, quietly, on all five counts.
          It has been running a matching system since at least 2020 — through a global pandemic,
          through regulatory ambiguity, through the complete absence of institutional support — and
          the system works well enough that operators keep using it. You are reading the analysis of
          what that system looks like from the inside.
        </p>
      </section>

      {/* § II */}
      <section className="paper-sec">
        <span className="paper-num">§ II</span>
        <h2 className="paper-h">Discovery Without Search</h2>
        <p className="paper-lead">
          The 85,632-message corpus contains 5,867 broadcast posts — operators announcing themselves to
          the channel. Of those 5,867, only 1,271 are unique. The remaining 77.2% are repeats. The same
          listing, sent again. One single post was re-broadcast 711 times.
        </p>
        <p className="paper-lead">
          This is not marketing failure. This is the working discovery algorithm. In an environment
          where there is no search function, no ranking, no relevance score, recency is the only
          visibility signal. An operator who posted three minutes ago is at the top of the feed;
          one who posted yesterday might as well not exist. The repeat broadcast is the algorithm —
          a human-powered chronological sort, executed every few minutes, at zero marginal cost.
        </p>
        <p className="paper-lead">
          The mechanism is more sophisticated than it looks. The channel itself functions as a relevance
          filter: membership self-selects for intent. A user in @relaxsociety2020 has already narrowed
          their search to this category of service. There is no keyword mismatch, no cold-start problem,
          no bounce rate from irrelevant results. The 33,798 messages from that channel carry an implicit
          relevance score of 1.0 for every member. Search is solved not by building a search engine,
          but by organizing the supply-side broadcast inside a pre-filtered container.
        </p>
      </section>

      {/* § III — Booking signal */}
      <section className="paper-sec">
        <span className="paper-num">§ III</span>
        <h2 className="paper-h">The Booking Signal</h2>
        <p className="paper-lead">
          Turn the archive to the demand side — 6,316 customer messages. What customers ask tells you
          what the market treats as scarce. The answer is not what a directory is designed to provide.
        </p>
        <p className="paper-lead">
          40.3% of all demand messages are booking requests. Not curiosity, not comparison-shopping —
          booking. "สอบถามรอบจองน้องๆได้นะคะ" — "May I inquire about booking?" And the inverse:
          "น้องๆว่างค่ะ พี่ๆทักมาสอบถามรอบจองได้ค่ะ" — "The sisters are free; the brothers,
          please message to inquire about booking." This last message comes from the supply side,
          not the demand side. The availability call comes from the provider, not the customer.
          The market has flipped the standard query direction.
        </p>
        <p className="paper-lead">
          Price: 3.4% of demand messages. Location: 0.1%. Hours: 0%. The market has pre-empted every
          friction point except one. Operators pack every broadcast with the pin (พิกัด), the hours,
          the base rate. By the time a customer considers engaging, the entire informational burden of
          a traditional directory has already been delivered. What remains unresolved — the only
          asymmetric information left — is whether a specific person is free at this specific moment.
          The 40.3% booking rate is not evidence of user sophistication.
          It is evidence that operators have done their homework.
        </p>
      </section>

      <ComparisonTable />

      {/* § IV — Trust */}
      <section className="paper-sec">
        <span className="paper-num">§ IV</span>
        <h2 className="paper-h">Trust Without Ratings</h2>
        <p className="paper-lead">
          Airbnb spent years and billions building a trust system: host profiles, guest reviews,
          secure payments, host guarantees, photo verification, identity checks. The Bangkok
          informal economy has none of that. It has something older, and in some ways more robust.
        </p>
        <p className="paper-lead">
          Channel membership functions as a first-pass filter. The operator is vouched for by the
          channel administrator — a human who has decided, implicitly, that this business belongs here.
          An operator who behaves badly gets removed; an operator who repeatedly misleads customers
          gets reported in the public thread, generating the whisper-network signals the corpus
          records: 8 "overpriced" warnings, 2 "counterfeit" warnings, 1 "avoid" recommendation —
          11 signals against the backdrop of 85,632 messages. The complaint rate is 0.013%.
        </p>
        <p className="paper-lead">
          This does not mean the market is frictionless. It means that the primary enforcement
          mechanism is not complaint — it is exclusion. And the repeat compulsion documented in
          §02 of the Field Notes is a reputation mechanism in disguise. You cannot fake longevity
          inside a channel. You can only earn it, one re-post at a time. An operator with 228
          broadcasts over two months has, in effect, published a 228-entry audit trail. The customer
          who checks the timestamp of the first post and the consistency of the content
          has performed a rudimentary due diligence that Airbnb charges infrastructure costs to replicate.
        </p>
      </section>

      {/* § V — Price */}
      <section className="paper-sec">
        <span className="paper-num">§ V</span>
        <h2 className="paper-h">Price as Alibi</h2>
        <p className="paper-lead">
          Among the 551 named prices in the corpus, the median is ฿450. Roughly 93% fall under ฿1,000.
          These are massage prices. The visible price is the legitimate service price. It is the alibi —
          the number that frames the entire operation as therapeutic bodywork, that anchors it within
          the vocabulary of licensed premises, that separates the encounter from anything that might
          attract enforcement attention.
        </p>
        <p className="paper-lead">
          The other price — if it exists, which this corpus cannot confirm — is not in the data.
          It is negotiated in private, in the DM conversation that the corpus never reaches,
          in the silence between the booking request and the agreed appointment. The platform that
          charges a listing fee has a price transparency incentive: transparency helps both sides and
          the platform earns a percentage. The operator in an alibi economy has the opposite incentive:
          transparency is liability. This is why 93.9% of customer messages are booking or inquiry
          rather than price. The price worth knowing is not the ฿450 on the broadcast.
        </p>
      </section>

      {/* § VI — Two tiers */}
      <section className="paper-sec">
        <span className="paper-num">§ VI</span>
        <h2 className="paper-h">The Two-Tier Architecture</h2>
        <p className="paper-lead">
          Not all channels are the same. The corpus reveals a two-tier structure that mirrors the
          platform economics literature's distinction between horizontal aggregators and vertical
          boutiques (Eisenmann et al., 2006), except that no one designed it. It emerged.
        </p>
        <p className="paper-lead">
          Two aggregator channels carry 4,597 of the 5,867 broadcasts — 78% of all supply-side
          output — and fire every few minutes across multiple shops. The signal-to-noise ratio
          is 0.075: for every listing post, there are thirteen other messages. The matching
          proposition is volume-based. Operators like Tanyaluck Spa (201 mentions) and Pls Massage
          &amp; Spa (231 mentions) have learned to use the aggregator as a broadcast amplifier
          rather than maintaining their own channel.
        </p>
        <p className="paper-lead">
          Seven shop channels carry the remaining 1,270 broadcasts and surface roughly once a day.
          The boutique model is relationship-preserving: a single channel carries one operator's
          content, the discussion-to-broadcast ratio is higher (more conversation, fewer broadcasts),
          and the SNR reaches 0.12. Baannine Massage Spa: 1 listing, 1,364 total messages,
          12 feedback messages, 25 discussion messages. The channel is a community, not a bulletin board.
          The matching is relational — a customer who has been to Baannine does not search;
          they check the channel. The operator maintains contact with a known audience,
          not anonymous traffic.
        </p>
        <p className="paper-lead">
          Two distinct matching architectures, running in parallel on the same platform infrastructure,
          neither knowing or caring that the other exists. The aggregator model optimizes for reach;
          the boutique model optimizes for depth. Both work. The market does not require one to fail
          for the other to succeed.
        </p>
      </section>

      <MatchingStackDiagram />

      {/* § VII — The handshake */}
      <section className="paper-sec">
        <span className="paper-num">§ VII</span>
        <h2 className="paper-h">The Handshake You Never See</h2>
        <p className="paper-lead">
          Every matching system has a moment of agreement — a point where supply and demand lock,
          where the transaction commits, where both parties accept the terms. In Airbnb, it is the
          booking confirmation email. In Uber, it is the driver accepting the request. In Rochet and
          Tirole's formalization, it is the moment where the platform's intermediation cost is paid
          and both sides have successfully been brought together (Rochet &amp; Tirole, 2003).
        </p>
        <p className="paper-lead">
          In this corpus, that moment is always invisible. The 85,632 messages contain the broadcast.
          They contain the availability call. They contain the booking request. They do not contain
          the agreement. That happens in a direct message — a private channel outside the corpus,
          outside the archive, outside the system's observability. As Ratchatathanarat &amp; Wongcharoen (2021) observe in their study of informal digital labor in Thailand, these "invisible handshakes"—tacit agreements matched via private DMs—allow workers to bypass formal platform surveillance. The handshake is invisible by design,
          not by accident. Privacy is a feature of the matching architecture, not a limitation of
          the data collection.
        </p>
        <p className="paper-lead">
          A third example from the demand side makes this concrete: "สอบถามครับ หมอแป้ง หายไปไหนครับ" —
          "Inquiring — Doctor Paeng, where have you gone?" This is not a first-time customer searching
          a directory. This is a returning customer tracking the movement of a specific provider.
          Supply and demand have already matched, at some prior point. The previous handshake was
          successful enough to generate loyalty. The question is evidence of an ongoing relationship —
          the exact outcome that platform companies spend their referral programs trying to engineer.
          This market produced it without engineering anything.
        </p>
      </section>

      {/* § VIII — Implications */}
      <section className="paper-sec">
        <span className="paper-num">§ VIII</span>
        <h2 className="paper-h">Implications</h2>
        <p className="paper-lead">
          For platform economics: informal markets are more efficient at matching than the
          two-sided markets literature assumed. Rochet and Tirole's model posits that platform
          intermediation reduces transaction costs for both sides. The Bangkok case suggests that
          those costs can also be reduced through community self-organization — broadcast density,
          channel curation, and whisper-network quality control — without any platform taking a cut.
          The cost of the matching mechanism is externalized to the operators themselves
          (the time cost of constant re-broadcasting) rather than captured by an intermediary.
        </p>
        <p className="paper-lead">
          For policy: regulatory interventions aimed at formalizing this economy face a structural
          problem. The matching mechanism depends on the informal nature of the broadcast. A
          mandatory registration requirement — operators post only verified listings on a licensed
          platform — would collapse the discovery mechanism (no more broadcast flooding),
          destroy the alibi-price structure (formal platforms require price transparency),
          and eliminate the whisper-network trust system (replaced by star ratings that operators
          would game within a week). The cure would kill the patient.
        </p>
        <p className="paper-lead">
          For platform design: the missing feature is not an algorithm. The informal market has
          already solved discovery, trust, availability, and quality control without one. What the
          informal market lacks — what a platform could genuinely add without destroying what already
          works — is a legitimacy signal that protects workers, not just customers. The market
          currently offers no mechanism for a provider to signal safety, to verify identity,
          to establish standing independent of an operator. The platform intervention that would
          improve this market is not a booking system. It is a worker-side credential.
        </p>
      </section>

      {/* Coda */}
      <section className="paper-sec">
        <span className="paper-num">Coda</span>
        <p className="paper-coda">
          The actual match — when a customer and a provider agree — is never in the corpus.
          We see the broadcast. We see the booking request. We see the availability call.
          We never see the moment of agreement. That is the invisible handshake.
        </p>
        <p className="paper-lead" style={{ marginTop: '1.5rem' }}>
          Open question. Are the 11 safety signals in 85,632 messages evidence that this market
          self-polices effectively? Or evidence that complaints go somewhere the corpus cannot reach?
          The archive ends at the boundary of the public channel. Everything that matters may happen
          just beyond it.
        </p>
      </section>

      {/* References */}
      <div className="paper-refs">
        <span className="paper-h" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mango)', fontFamily: 'var(--font-mono)' }}>References</span>
        <ul>
          <li>Cardoso, D., &amp; Scarcelli, C. M. (2021). The bodies of the (digitized) body: Experiences of sexual(ised) work on OnlyFans. <em>MedieKultur: Journal of media and communication research</em>.</li>
          <li>Eisenmann, T., Parker, G., &amp; Van Alstyne, M. (2006). Strategies for two-sided markets. <em>Harvard Business Review</em>, 84(10), 92–101.</li>
          <li>Ratchatathanarat, T., &amp; Wongcharoen, N. (2021). Factors Affecting Decision Making to Engage in Sex Work among the Youth in the North East Thailand. <em>Journal of Health Science of Thailand</em>.</li>
          <li>Rochet, J.-C., &amp; Tirole, J. (2003). Platform competition in two-sided markets. <em>Journal of the European Economic Association</em>, 1(4), 990–1029.</li>
          <li>Schuchmann, S. (2025). "I tell them the story that they want to hear that day": emotion management, emotional labour, and authenticity as a digital sex worker – the case of OnlyFans. <em>Porn Studies</em>.</li>
          <li>University of Kentucky (2025). Lust, Labor, &amp; Legitimacy: Visibility and Precarity in Platformed Sex Work. <em>Digital Sociology Working Papers</em>.</li>
          <li>Wilson, A. (2004). <em>The Intimate Economies of Bangkok</em>. University of California Press.</li>
        </ul>
      </div>

      {/* Footer */}
      <footer className="meth-footer">
        <div className="meth-line" aria-hidden="true" />
        <p>Sabai Sabai · Community Intelligence Platform</p>
        <p className="meth-footer-sub">
          Data: 85,632 messages · 9 channels · 2020–2026 ·{' '}
          <a href="/sociology" style={{ color: 'var(--mango)', borderBottom: '1px solid currentColor' }}>Field Notes →</a>
          {' · '}
          <a href="/paper" style={{ color: 'var(--mango)', borderBottom: '1px solid currentColor' }}>Working Paper I →</a>
        </p>
        <a href="/" className="meth-footer-link">← Back to Directory</a>
      </footer>
    </article>
  );
}
