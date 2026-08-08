import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  Compass,
  Mail,
  MessageSquareText,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const workflow = [
  { icon: Search, label: "Find the right market" },
  { icon: Target, label: "Qualify every target" },
  { icon: MessageSquareText, label: "Build the campaign" },
  { icon: ShieldCheck, label: "Route for approval" },
  { icon: BarChart3, label: "Learn from results" },
];

const motions = [
  {
    icon: Building2,
    tone: "blue",
    eyebrow: "Business motion",
    title: "Turn market signals into qualified pipeline",
    body: "Find high-fit companies, verify the buying signal, map decision-makers, and build outreach with evidence attached.",
    stat: "48",
    statLabel: "qualified accounts",
  },
  {
    icon: UsersRound,
    tone: "coral",
    eyebrow: "Creator motion",
    title: "Build partnerships people actually remember",
    body: "Discover aligned creators, understand their work, design the right partnership, and track attributable results.",
    stat: "12",
    statLabel: "strong-fit creators",
  },
  {
    icon: Sparkles,
    tone: "gold",
    eyebrow: "Consumer motion",
    title: "Make every lifecycle moment feel personal",
    body: "Turn consented customer behavior into better audiences, timely offers, and experiments that compound.",
    stat: "+18%",
    statLabel: "retention opportunity",
  },
];

const activity = [
  ["Found", "82 independent gyms in Bangalore"],
  ["Checked", "34 booking flows and pricing pages"],
  ["Qualified", "CoreLab — phone-only booking verified"],
  ["Ready", "7 evidence-backed messages for approval"],
];

export default function Home() {
  return (
    <main id="top">
      <a className="announcement" href="#system">
        <span className="announcement-art" aria-hidden="true">✦ · ✿ · ✦</span>
        Meet the GTM engine that turns one objective into a complete campaign
        <ArrowRight size={16} />
        <span className="announcement-art" aria-hidden="true">✦ · ✿ · ✦</span>
      </a>

      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="MotionGrid home">
          <BrandMark /> MotionGrid
        </a>
        <nav aria-label="Primary navigation">
          <a href="#platform">Platform <ChevronDown size={13} /></a>
          <a href="#system">How it works <ChevronDown size={13} /></a>
          <a href="#motions">Built for <ChevronDown size={13} /></a>
          <a href="#proof">Resources <ChevronDown size={13} /></a>
        </nav>
        <div className="header-actions">
          <a className="login-link" href="#workbench">Log in</a>
          <a className="button button--blue button--small" href="#workbench">Get a demo</a>
        </div>
      </header>

      <section className="hero">
        <div className="hero-pill"><Sparkles size={14} /> One goal in. A complete GTM motion out. <ArrowRight size={14} /></div>
        <h1>GTM campaigns<br />operators love</h1>
        <p>MotionGrid is the all-in-one agentic GTM platform that finds the right market, builds an auditable plan, and runs approved work across your stack.</p>
        <a className="button button--blue" href="#workbench">Build your first campaign</a>
        <div className="trust-line"><span>★★★★★</span> Plan, approve, execute, and learn in one place</div>

        <div className="product-stage" id="workbench">
          <div className="stage-tabs" role="group" aria-label="Product capabilities">
            <span className="tab-arrow" aria-hidden="true">←</span>
            <span className="active"><Compass size={17} /> Discovery</span>
            <span><UserRoundSearch size={17} /> Qualification</span>
            <span><Route size={17} /> Planning</span>
            <span><Mail size={17} /> Outreach</span>
            <span><BarChart3 size={17} /> Reporting</span>
            <span><Sparkles size={17} /> AI</span>
            <span className="tab-arrow" aria-hidden="true">→</span>
          </div>

          <div className="desk-doodle desk-doodle--left" aria-hidden="true">
            <span className="doodle-star">✦</span><span className="doodle-pot">⌇</span><span className="doodle-leaf">⌁</span>
          </div>
          <div className="desk-doodle desk-doodle--right" aria-hidden="true">
            <span className="doodle-orbit">◎</span><span className="doodle-cup">∪</span><span className="doodle-spark">✧</span>
          </div>

          <div className="app-window">
            <aside className="app-sidebar">
              <div className="mini-wordmark"><BrandMark /> motiongrid</div>
              <div className="search-box"><Search size={14} /> Search <kbd>⌘K</kbd></div>
              <div className="nav-item nav-item--active"><Compass size={15} /> Campaigns</div>
              <div className="nav-item"><Target size={15} /> Targets</div>
              <div className="nav-item"><MessageSquareText size={15} /> Approvals <b>7</b></div>
              <div className="nav-item"><BarChart3 size={15} /> Outcomes</div>
              <div className="sidebar-note">
                <span>Campaign health</span>
                <strong><i /> All systems ready</strong>
              </div>
            </aside>
            <div className="app-content">
              <div className="app-toolbar">
                <div><span className="app-kicker">LIVE CAMPAIGN</span><h2>Bangalore fitness expansion</h2></div>
                <div className="toolbar-actions"><span>Connected</span><button type="button">Pause</button></div>
              </div>
              <div className="campaign-status">
                <div><span>Discovery</span><strong>68 of 120</strong><small>targets examined</small></div>
                <div><span>Qualified</span><strong>22</strong><small>high-confidence fits</small></div>
                <div><span>Operating spend</span><strong>$6.42</strong><small>within $25 budget</small></div>
                <div className="approval-card"><span>Needs you</span><strong>7 drafts</strong><small>ready for approval</small></div>
              </div>
              <div className="campaign-main">
                <div className="territory-card">
                  <div className="card-heading"><div><span>Live territory</span><strong>Indiranagar, Bengaluru</strong></div><span className="live-dot">● Following live</span></div>
                  <div
                    className="map-canvas"
                    role="img"
                    aria-label="Stylized campaign territory map"
                  >
                    <i className="road road--one" /><i className="road road--two" /><i className="road road--three" /><i className="road road--four" />
                    <span className="map-label map-label--one">Indiranagar</span><span className="map-label map-label--two">Domlur</span>
                    <button className="map-pin pin-one" type="button" aria-label="Qualified target CoreLab">1</button>
                    <button className="map-pin pin-two" type="button" aria-label="Qualified target Flex House">2</button>
                    <button className="map-pin map-pin--muted pin-three" type="button" aria-label="Rejected target">×</button>
                    <button className="map-pin pin-four" type="button" aria-label="Qualified target Lift Club">3</button>
                  </div>
                </div>
                <div className="activity-card">
                  <div className="card-heading"><div><span>Agent activity</span><strong>Verified work, as it happens</strong></div><Sparkles size={18} /></div>
                  <div className="activity-list">
                    {activity.map(([verb, text], index) => (
                      <div className="activity-item" key={text}>
                        <span className={`activity-check activity-check--${index}`}><Check size={12} /></span>
                        <p><strong>{verb}</strong> {text}</p>
                        <small>{index === activity.length - 1 ? "now" : `${8 - index * 2}m`}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="logo-strip" aria-label="Example connected systems">
        <p>Work across the tools your team already trusts</p>
        <div><span>Salesforce</span><span>HubSpot</span><span>Clay</span><span>Slack</span><span>Resend</span><span>Twilio</span></div>
      </section>

      <section className="intro-section" id="system">
        <div className="section-copy">
          <span className="eyebrow">Get to know MotionGrid</span>
          <h2>Replace scattered GTM work with one delightful system</h2>
          <p>From the first market signal to the final outcome, every step stays connected, explainable, and under your control.</p>
          <a className="button button--neutral" href="#platform">Platform overview</a>
        </div>
        <div className="workflow-card">
          <div className="workflow-top"><span>One objective</span><strong>Find independent gyms without online booking and get qualified demos.</strong></div>
          <div className="workflow-list">
            {workflow.map(({ icon: Icon, label }, index) => (
              <div key={label}><span>{index + 1}</span><Icon size={19} /><strong>{label}</strong>{index < workflow.length - 1 && <i />}</div>
            ))}
          </div>
          <div className="workflow-stamp"><Check size={16} /> Auditable plan ready</div>
        </div>
      </section>

      <section className="platform-section" id="platform">
        <div className="section-heading">
          <span className="eyebrow">One platform</span>
          <h2>The whole campaign,<br />not another point solution</h2>
          <p>MotionGrid joins strategy, execution, evidence, and outcomes so your team can move quickly without losing the plot.</p>
        </div>
        <div className="feature-grid">
          <article className="feature-card feature-card--wide feature-card--blue">
            <div className="feature-copy"><span>Market intelligence</span><h3>Don&apos;t let another buying signal slip through the cracks</h3><p>Discover accounts, understand what changed, and rank the opportunities worth your team&apos;s attention.</p></div>
            <div className="signal-illustration">
              <div className="signal-card signal-card--one"><span>Signal detected</span><strong>No online booking</strong><small>CoreLab · Indiranagar</small></div>
              <div className="signal-card signal-card--two"><span>Evidence</span><strong>“Call us to reserve your trial”</strong><small>Observed 2 minutes ago</small></div>
              <div className="paper-note">Why now?<br /><strong>Demand is visible.<br />Conversion is manual.</strong><i /></div>
            </div>
          </article>
          <article className="feature-card feature-card--yellow">
            <div className="feature-copy"><span>Planning</span><h3>A route everyone can understand</h3><p>See steps, assumptions, cost, and human gates before execution starts.</p></div>
            <div className="route-illustration"><span>Discover</span><i /><span>Qualify</span><i /><span className="route-approval">Approve</span><i /><span>Launch</span></div>
          </article>
          <article className="feature-card feature-card--mint">
            <div className="feature-copy"><span>Governance</span><h3>Approval is built in</h3><p>Budgets, consent, suppression, and consequential actions are enforced outside the model.</p></div>
            <div className="approval-note"><ShieldCheck size={28} /><strong>7 messages are ready</strong><span>Projected cost ₹14.00</span><button type="button">Review drafts</button></div>
          </article>
        </div>
      </section>

      <section className="motions-section" id="motions">
        <div className="section-heading section-heading--center">
          <span className="eyebrow">Built for every go-to-market motion</span>
          <h2>One interface.<br />Three expert motions.</h2>
          <p>Describe the outcome. MotionGrid selects the domain, capabilities, and connected providers.</p>
        </div>
        <div className="motion-cards">
          {motions.map(({ icon: Icon, tone, eyebrow, title, body, stat, statLabel }) => (
            <article className={`motion-card motion-card--${tone}`} key={eyebrow}>
              <div className="motion-icon"><Icon size={24} /></div>
              <span>{eyebrow}</span><h3>{title}</h3><p>{body}</p>
              <div className="motion-stat"><strong>{stat}</strong><span>{statLabel}</span></div>
              <a href="#workbench" aria-label={`Explore ${eyebrow}`}>Explore motion <ArrowRight size={16} /></a>
            </article>
          ))}
        </div>
      </section>

      <section className="proof-section" id="proof">
        <div className="portrait-illustration" aria-hidden="true">
          <div className="portrait-frame"><div className="portrait-face"><span /><i /><b /></div><div className="portrait-shirt">MG</div></div>
          <span className="portrait-label">Watch story <ArrowRight size={15} /></span>
        </div>
        <div className="proof-copy">
          <span className="eyebrow">Hear what operators are saying</span>
          <h2>“I can finally see what the agents did, why they did it, and what it cost.”</h2>
          <div><strong>Maya Chen</strong><span>VP Growth at Northstar</span></div>
          <a className="button button--neutral" href="#workbench">Read customer story</a>
        </div>
      </section>

      <section className="numbers-section">
        <div><strong>1</strong><span>objective to start</span></div>
        <div><strong>3</strong><span>expert GTM motions</span></div>
        <div><strong>100%</strong><span>of actions attributable</span></div>
        <div><strong>0</strong><span>consequential actions in the dark</span></div>
      </section>

      <section className="cta-section">
        <div className="cta-doodle cta-doodle--left" aria-hidden="true">✿<br />╱╲<br />⌁</div>
        <div>
          <span className="eyebrow">One goal is enough</span>
          <h2>Build a campaign your whole team can trust.</h2>
          <p>Tell us the outcome. MotionGrid will map the route.</p>
          <a className="button button--blue" href="mailto:hello@motiongrid.ai">Get a demo</a>
        </div>
        <div className="cta-doodle cta-doodle--right" aria-hidden="true">◎<br />╲╱<br />✦</div>
      </section>

      <footer>
        <div className="footer-brand"><a className="wordmark" href="#top"><BrandMark /> MotionGrid</a><p>One goal. The right agents. Every GTM motion.</p></div>
        <div><strong>Platform</strong><a href="#system">How it works</a><a href="#platform">Capabilities</a><a href="#motions">Motions</a></div>
        <div><strong>Company</strong><a href="#proof">Customers</a><a href="mailto:hello@motiongrid.ai">Contact</a><a href="#top">Security</a></div>
        <div><strong>Product</strong><a href="#workbench">Request demo</a><a href="#top">Documentation</a><a href="#top">Privacy</a></div>
        <p className="copyright">© 2026 MotionGrid. All rights reserved.</p>
      </footer>
    </main>
  );
}
