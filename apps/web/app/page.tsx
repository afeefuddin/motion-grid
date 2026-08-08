import { ArrowDownRight, ArrowUpRight, CheckCircle2, Route, ShieldCheck, Waypoints } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { CampaignWorkbench } from "@/components/campaign-workbench";

const principles = [
  {
    number: "01",
    icon: Waypoints,
    title: "Agents reason",
    body: "Three domain agents interpret the objective and produce structured plans—not a maze of visible micro-agents.",
  },
  {
    number: "02",
    icon: Route,
    title: "Integrations execute",
    body: "Vendor-neutral capabilities route each step to the strongest connected provider for cost, coverage and confidence.",
  },
  {
    number: "03",
    icon: ShieldCheck,
    title: "Policies control",
    body: "Budgets, consent, suppression and consequential external actions are enforced outside the model.",
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="MotionGrid home">
          <BrandMark /> MotionGrid
        </a>
        <nav aria-label="Primary navigation">
          <a href="#system">System</a>
          <a href="#motions">Motions</a>
          <a href="#control">Control</a>
        </nav>
        <a className="header-action" href="#workbench">Build a motion <ArrowUpRight size={15} /></a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="section-label"><span>GTM operating system</span><span>2026 / 01</span></div>
          <h1>One goal.<br /><em>Every GTM motion,</em><br />orchestrated.</h1>
        </div>
        <div className="hero-aside">
          <p>MotionGrid selects the right agents, constructs an auditable campaign plan and executes approved work across your stack.</p>
          <a href="#workbench">Start with an objective <ArrowDownRight size={18} /></a>
        </div>
      </section>

      <CampaignWorkbench />

      <section className="system-section" id="system">
        <div className="section-intro">
          <span className="eyebrow">The operating model</span>
          <h2>Judgment where it helps.<br /><em>Control where it matters.</em></h2>
        </div>
        <div className="principle-list">
          {principles.map(({ number, icon: Icon, title, body }) => (
            <article className="principle" key={number}>
              <span className="principle-number">{number}</span>
              <Icon size={23} strokeWidth={1.6} />
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
              <ArrowUpRight className="principle-arrow" size={17} />
            </article>
          ))}
        </div>
      </section>

      <section className="motion-band" id="motions">
        <div className="motion-band-heading">
          <span className="eyebrow">One interface / three motions</span>
          <p>MotionGrid chooses the domain. You stay focused on the outcome.</p>
        </div>
        <div className="motion-grid">
          <div className="motion motion--creator"><span>Creator</span><strong>Partnerships<br />with attribution.</strong></div>
          <div className="motion motion--business"><span>Business</span><strong>Qualified pipeline<br />with evidence.</strong></div>
          <div className="motion motion--consumer"><span>Consumer</span><strong>Lifecycle growth<br />with consent.</strong></div>
        </div>
      </section>

      <section className="control-section" id="control">
        <div>
          <CheckCircle2 size={24} />
          <span className="eyebrow">Approval is part of the architecture</span>
        </div>
        <h2>Nothing consequential<br />happens in the dark.</h2>
        <p>Every provider call, assumption, cost, approval, mutation and failure remains attributable to a campaign and visible to the operator.</p>
        <a href="#workbench">Construct your first plan <ArrowUpRight size={17} /></a>
      </section>

      <footer>
        <a className="wordmark" href="#top"><BrandMark /> MotionGrid</a>
        <p>One goal. The right agents. Every GTM motion.</p>
        <span className="mono-label">PLAN → APPROVE → EXECUTE → LEARN</span>
      </footer>
    </main>
  );
}
