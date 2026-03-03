import './HowItWorks.css';

function HowItWorks({ t }) {
  return (
    <section className="how-it-works" id="workflow">
      <div className="hiw-header">
        <span className="section-kicker">{t.howItWorks.kicker}</span>
        <h2>{t.howItWorks.title}</h2>
        <p>{t.howItWorks.subtitle}</p>
      </div>

      <div className="hiw-steps">
        <div className="hiw-step">
          <div className="step-icon">01</div>
          <h3>{t.howItWorks.step1Title}</h3>
          <p>{t.howItWorks.step1Desc}</p>
        </div>
        <div className="hiw-step">
          <div className="step-icon">02</div>
          <h3>{t.howItWorks.step2Title}</h3>
          <p>{t.howItWorks.step2Desc}</p>
        </div>
        <div className="hiw-step">
          <div className="step-icon">03</div>
          <h3>{t.howItWorks.step3Title}</h3>
          <p>{t.howItWorks.step3Desc}</p>
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
