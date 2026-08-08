"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, CircleDollarSign, FileCheck2, Link2, MessageSquareText, Radio, RefreshCw, Route, ShieldCheck, SlidersHorizontal, Sparkles, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import type { z } from "zod";
import { CampaignDetailResponseSchema, SseEventSchema, type SseEvent } from "../../../src/contracts/api";
import type { Approval, Edge, Signal, Target } from "../../../src/contracts/entities";
import { PlanDataSchema } from "../../../src/contracts/steps";
import { readContractJson } from "./http";
import { replayCampaign, replayEvents, replayPlan } from "./replay-fixture";

type CampaignDetail = z.infer<typeof CampaignDetailResponseSchema>;
type PlanData = z.infer<typeof PlanDataSchema>;
type View = "plan" | "grid" | "approvals";
type Connection = "connecting" | "connected" | "reconnecting" | "offline" | "replay";

type Projection = {
  plan: PlanData | null;
  targets: Target[];
  reasons: Record<string, string>;
  signals: Signal[];
  edges: Edge[];
  approvals: Approval[];
  operatingCents: number;
  commitCents: number;
  warning: string | null;
  replan: { trigger: string; reason: string } | null;
  activities: { id: string; text: string; at: string }[];
};

function initialProjection(detail: CampaignDetail, plan: PlanData | null): Projection {
  return { plan, targets: detail.targets, reasons: {}, signals: [], edges: [], approvals: [], operatingCents: detail.campaign.operatingSpentCents, commitCents: detail.campaign.commitSpentCents, warning: null, replan: null, activities: [] };
}

function activityText(event: SseEvent) {
  if (event.type === "motion_selected") return `Selected ${event.data.motionId} — ${event.data.rationale}`;
  if (event.type === "motion_declined") return `Declined ${event.data.motionId} — ${event.data.reason}`;
  if (event.type === "target.state") return `${event.data.to.replace("_", " ")} target ${event.data.targetId.slice(0, 8)}`;
  if (event.type === "signal.added") return `Verified evidence for target ${event.data.signal.targetId.slice(0, 8)}`;
  if (event.type === "edge.discovered") return `Found a ${event.data.edge.kind.replace("_", " ")} relationship`;
  if (event.type === "replan_started") return `Re-planning — ${event.data.reason}`;
  if (event.type === "approval.required") return "Human approval required";
  if (event.type === "message.sent") return `Sent ${event.data.message.channel} message`;
  if (event.type === "interaction.received") return `Received ${event.data.kind} via ${event.data.channel}`;
  if (event.type === "run.done") return "Campaign run completed";
  if (event.type === "cost.tick") return `Recorded ${formatUsd(event.data.operatingDeltaCents)} operating cost`;
  if (event.type === "policy_warning") return event.data.reason;
  if (event.type === "binding_chosen") return `Bound ${event.data.capabilityId} to ${event.data.chosen.adapterId}`;
  if (event.type === "capability_ranked") return `Ranked ${event.data.candidates.length} providers for ${event.data.capabilityId}`;
  return event.data.delta;
}

function projectRun(previous: Projection, event: SseEvent): Projection {
  const activity = { id: event.id, text: activityText(event), at: new Date(event.occurredAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) };
  const next = { ...previous, activities: [activity, ...previous.activities].slice(0, 12) };
  if (event.type === "plan.delta" && event.data.snapshot !== null) return { ...next, plan: event.data.snapshot };
  if (event.type === "target.state") return { ...next, targets: previous.targets.map((target) => target.id === event.data.targetId ? { ...target, status: event.data.to } : target), reasons: event.data.reason === null ? previous.reasons : { ...previous.reasons, [event.data.targetId]: event.data.reason } };
  if (event.type === "signal.added") return { ...next, signals: [...previous.signals.filter((signal) => signal.id !== event.data.signal.id), event.data.signal] };
  if (event.type === "edge.discovered") return { ...next, edges: [...previous.edges.filter((edge) => edge.id !== event.data.edge.id), event.data.edge] };
  if (event.type === "approval.required") return { ...next, approvals: [...previous.approvals.filter((approval) => approval.id !== event.data.approval.id), event.data.approval] };
  if (event.type === "cost.tick") return { ...next, operatingCents: event.data.operatingTotalCents, commitCents: event.data.commitTotalCents };
  if (event.type === "policy_warning") return { ...next, warning: event.data.reason };
  if (event.type === "replan_started") return { ...next, replan: { trigger: event.data.trigger, reason: event.data.reason } };
  return next;
}

function formatUsd(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100); }
function formatInr(cents: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(cents / 100); }

export function CampaignWorkspace({ campaignId, replay }: Readonly<{ campaignId: string; replay: boolean }>) {
  const [detail, setDetail] = useState<CampaignDetail | null>(replay ? replayCampaign : null);
  const [projection, setProjection] = useState<Projection | null>(replay ? initialProjection(replayCampaign, replayPlan) : null);
  const [connection, setConnection] = useState<Connection>(replay ? "replay" : "connecting");
  const [view, setView] = useState<View>("plan");
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [replayIndex, setReplayIndex] = useState(0);

  useEffect(() => {
    if (replay) return;
    async function load() {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}`);
        const parsed = CampaignDetailResponseSchema.parse(await readContractJson(response));
        const parsedPlan = parsed.plan === null ? null : PlanDataSchema.safeParse(parsed.plan.spec);
        let planData: PlanData | null = null;
        if (parsedPlan !== null) {
          if (parsedPlan.success) planData = parsedPlan.data;
        }
        setDetail(parsed);
        setProjection(initialProjection(parsed, planData));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Campaign could not be loaded.");
        setConnection("offline");
      }
    }
    void load();
  }, [campaignId, replay]);

  useEffect(() => {
    if (replay) return;
    const source = new EventSource(`/api/stream/${campaignId}`);
    const receive = (message: MessageEvent<string>) => {
      const value: unknown = JSON.parse(message.data, (_key, item: unknown) => {
        if (typeof item === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(item)) return new Date(item);
        return item;
      });
      const event = SseEventSchema.parse(value);
      setProjection((current) => current === null ? current : projectRun(current, event));
    };
    const eventTypes = ["plan.delta", "motion_selected", "motion_declined", "capability_ranked", "binding_chosen", "policy_warning", "replan_started", "target.state", "cost.tick", "signal.added", "edge.discovered", "approval.required", "message.sent", "interaction.received", "run.done"];
    source.onopen = () => setConnection("connected");
    source.onerror = () => setConnection(source.readyState === EventSource.CONNECTING ? "reconnecting" : "offline");
    for (const eventType of eventTypes) source.addEventListener(eventType, receive);
    return () => source.close();
  }, [campaignId, replay]);

  useEffect(() => {
    if (!replay || replayIndex >= replayEvents.length) return;
    const timer = window.setTimeout(() => {
      const event = replayEvents[replayIndex];
      if (event !== undefined) setProjection((current) => current === null ? current : projectRun(current, event));
      setReplayIndex((current) => current + 1);
    }, replayIndex === 0 ? 350 : 650);
    return () => window.clearTimeout(timer);
  }, [replay, replayIndex]);

  if (error) return <section className="workspace-error"><AlertTriangle size={28} /><h1>We couldn’t open this campaign</h1><p>{error}</p><Link className="product-button product-button--primary" href={`/campaigns/${campaignId}?replay=1`}>Open recorded run</Link></section>;
  if (detail === null || projection === null) return <div className="workspace-loading"><span>Loading the campaign route</span><i /></div>;

  const selectedTarget = projection.targets.find((target) => target.id === selectedTargetId) ?? null;
  const fitCount = projection.targets.filter((target) => ["fit", "contact_found", "draft_ready", "pending_approval", "sent", "delivered", "engaged"].includes(target.status)).length;
  const rejectedCount = projection.targets.filter((target) => target.status === "not_fit").length;
  const pending = projection.approvals.filter((approval) => approval.status === "pending");

  return (
    <section className="workspace-page">
      <header className="workspace-title"><div><Link className="back-link" href="/campaigns"><ArrowLeft size={14} /> Campaigns</Link><h1>{detail.campaign.name}</h1><p>{detail.objective.prompt}</p></div><span className={`connection-pill connection-pill--${connection}`}><Radio size={13} /> {connection}</span></header>
      <div className="command-strip" aria-live="polite"><div><span>Phase</span><strong>{detail.campaign.status.replace("_", " ")}</strong></div><div><span>Examined</span><strong>{projection.targets.length}</strong></div><div><span>Qualified / rejected</span><strong>{fitCount} / {rejectedCount}</strong></div><div><span>Operating</span><strong>{formatUsd(projection.operatingCents)}</strong></div><div><span>Committed</span><strong>{formatInr(projection.commitCents)}</strong></div><button className={pending.length > 0 ? "needs-attention" : ""} type="button" onClick={() => setView("approvals")}><ShieldCheck size={15} /> {pending.length} approvals</button></div>
      {projection.warning && <div className="budget-warning"><AlertTriangle size={18} /><div><strong>Budget checkpoint</strong><span>{projection.warning}</span></div></div>}
      <nav className="workspace-tabs" aria-label="Campaign views"><button className={view === "plan" ? "is-active" : ""} onClick={() => setView("plan")} type="button"><Route size={16} /> Plan</button><button className={view === "grid" ? "is-active" : ""} onClick={() => setView("grid")} type="button"><SlidersHorizontal size={16} /> The Grid</button><button className={view === "approvals" ? "is-active" : ""} onClick={() => setView("approvals")} type="button"><FileCheck2 size={16} /> Approvals {pending.length > 0 && <b>{pending.length}</b>}</button></nav>
      {view === "plan" && <PlanView plan={projection.plan} replan={projection.replan} approvals={pending} replay={replay} campaignId={campaignId} onApproved={(approvalId) => setProjection((current) => current === null ? current : { ...current, approvals: current.approvals.map((approval) => approval.id === approvalId ? { ...approval, status: "approved" } : approval) })} />}
      {view === "grid" && <GridView projection={projection} selectedTargetId={selectedTargetId} onSelect={setSelectedTargetId} />}
      {view === "approvals" && <ApprovalView approvals={pending} campaignId={campaignId} replay={replay} onDecided={(approvalId) => setProjection((current) => current === null ? current : { ...current, approvals: current.approvals.map((approval) => approval.id === approvalId ? { ...approval, status: "approved" } : approval) })} />}
      {selectedTarget && <EvidenceDrawer target={selectedTarget} signals={projection.signals.filter((signal) => signal.targetId === selectedTarget.id)} edge={projection.edges.find((edge) => edge.toTargetId === selectedTarget.id) ?? null} reason={projection.reasons[selectedTarget.id]} onClose={() => setSelectedTargetId(null)} />}
    </section>
  );
}

function PlanView({ plan, replan, approvals, replay, campaignId, onApproved }: Readonly<{ plan: PlanData | null; replan: Projection["replan"]; approvals: Approval[]; replay: boolean; campaignId: string; onApproved: (approvalId: string) => void }>) {
  if (plan === null) return <div className="empty-workspace"><RefreshCw size={28} /><h2>The plan is taking shape</h2><p>Motion selection and provider ranking will appear here when the planner publishes them.</p></div>;
  const planApproval = approvals.find((approval) => approval.messageId === null);
  return <div className="plan-layout"><div className="plan-main"><section className="plan-intro"><span className="product-kicker">Decision route</span><h2>Why this campaign will run this way</h2><p>Every selected motion, rejected route, provider score, policy, and cost is visible before execution.</p><div className="dual-budget"><div><CircleDollarSign size={18} /><span>Operating ceiling</span><strong>{formatUsd(plan.budget.operating.amountMinor)}</strong></div><div><span className="rupee-mark">₹</span><span>Commit ceiling</span><strong>{formatInr(plan.budget.commit.amountMinor)}</strong></div></div></section>{replan && <div className="replan-card"><RefreshCw size={19} /><div><span>Route amended · {replan.trigger.replace("_", " ")}</span><strong><s>outscraper</s> <ArrowRight size={15} /> market.geo</strong><p>{replan.reason}</p></div></div>}<div className="motion-plan-list">{plan.motions.map((motion) => <article className="motion-plan" key={motion.motionId}><header><div><span className="selected-marker"><Check size={13} /> Selected motion</span><h3>{motion.motionId}</h3><p>{motion.rationale}</p></div><div className="motion-budget"><span>{formatUsd(motion.operatingBudgetCents)}</span><span>{formatInr(motion.commitBudgetCents)}</span></div></header>{motion.bindings.map((binding) => <div className="ranking-block" key={binding.capabilityId}><div className="ranking-heading"><div><span>Capability</span><h4>{binding.capabilityId}</h4></div><blockquote>“{binding.weightsRationale}”</blockquote></div><div className="ranking-table-wrap"><table className="ranking-table"><thead><tr><th>Provider</th><th>Mode</th><th>Cost</th><th>Fresh</th><th>Confidence</th><th>Coverage</th><th>Total</th><th>Decision</th></tr></thead><tbody>{binding.candidates.map((candidate) => <tr className={!candidate.eligible ? "is-ineligible" : candidate.adapterId === binding.chosen.adapterId ? "is-winner" : ""} key={candidate.adapterId}><td><strong>{candidate.adapterId}</strong><small>{candidate.reason}</small></td><td>{candidate.mode}</td><td>{Math.round(candidate.dimensionScores.cost * 100)}</td><td>{Math.round(candidate.dimensionScores.freshness * 100)}</td><td>{Math.round(candidate.dimensionScores.confidence * 100)}</td><td>{Math.round(candidate.dimensionScores.coverage * 100)}</td><td><strong>{candidate.totalScore.toFixed(3)}</strong></td><td>{candidate.adapterId === binding.chosen.adapterId ? <span className="winner-label"><CheckCircle2 size={14} /> Chosen</span> : candidate.eligible ? "Eligible" : <span className="declined-label"><XCircle size={14} /> Ineligible</span>}</td></tr>)}</tbody></table></div></div>)}</article>)}</div><section className="declined-section"><div className="section-line-heading"><div><span className="product-kicker">Deliberate restraint</span><h2>Routes we declined</h2></div><p>Rejected motions remain visible because a credible system can explain what it chose not to do.</p></div>{plan.declinedMotions.map((motion) => <article key={motion.motionId}><XCircle size={19} /><div><strong>{motion.motionId}</strong><p>{motion.reason}</p></div></article>)}</section></div><aside className="plan-side"><section><span className="product-kicker">Policies</span><h3>Guardrails on this route</h3>{plan.policies.map((policy) => <div className="policy-item" key={policy.kind}><ShieldCheck size={17} /><div><strong>{policy.kind.replace("_", " ")}</strong><p>{policy.description}</p></div></div>)}</section>{planApproval && <section className="approval-callout"><span>Needs your decision</span><h3>Approve this route to begin execution</h3><p>{planApproval.reason}</p><ApprovalButtons approval={planApproval} campaignId={campaignId} replay={replay} onDecided={onApproved} /></section>}</aside></div>;
}

function GridView({ projection, selectedTargetId, onSelect }: Readonly<{ projection: Projection; selectedTargetId: string | null; onSelect: (targetId: string) => void }>) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"recent" | "state">("recent");
  const visible = useMemo(() => [...projection.targets.filter((target) => filter === "all" || target.status === filter)].sort((left, right) => sort === "state" ? left.status.localeCompare(right.status) : right.createdAt.getTime() - left.createdAt.getTime()), [filter, projection.targets, sort]);
  return <div className="grid-layout"><div className="grid-main"><div className="grid-toolbar"><div className="filter-chips">{["all", "fit", "not_fit", "pending_approval", "engaged"].map((item) => <button className={filter === item ? "is-active" : ""} key={item} onClick={() => setFilter(item)} type="button">{item.replace("_", " ")}</button>)}</div><button className="sort-control" onClick={() => setSort((current) => current === "recent" ? "state" : "recent")} type="button"><SlidersHorizontal size={14} /> Sort: {sort}</button></div><div className="target-table-wrap"><table className="target-table"><thead><tr><th>Target</th><th>Motion</th><th>State</th><th>Why</th><th>Evidence</th></tr></thead><tbody>{visible.map((target) => { const warmEdge = projection.edges.find((edge) => edge.toTargetId === target.id && edge.kind === "mentions"); const evidenceCount = projection.signals.filter((signal) => signal.targetId === target.id).length; return <tr className={selectedTargetId === target.id ? "is-selected" : target.status === "not_fit" ? "is-muted" : ""} key={target.id} onClick={() => onSelect(target.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onSelect(target.id); }}><td><strong>{target.name}</strong><small>{target.kind === "organization" ? target.payload.locality : target.kind === "person" ? target.payload.handle : target.payload.description}</small></td><td>{target.kind === "person" ? "creator" : "business.local"}</td><td><span className={`state-label state-label--${target.status}`}>{target.status.replace("_", " ")}</span></td><td><span className="reason-preview">{projection.reasons[target.id] ?? (target.status === "not_fit" ? "Rejected by qualification" : "Awaiting next receipt")}</span></td><td>{warmEdge ? <button className="warm-intro" type="button"><Link2 size={13} /> Warm intro</button> : <span>{evidenceCount} signals <ChevronRight size={13} /></span>}</td></tr>; })}</tbody></table></div></div><aside className="activity-rail"><header><div><span className="live-pulse" /> Live activity</div><small>Semantic receipts</small></header>{projection.activities.length === 0 ? <p className="quiet-empty">Verified work will appear here during the run.</p> : projection.activities.map((activity) => <div className="activity-receipt" key={activity.id}><i /><p>{activity.text}</p><time>{activity.at}</time></div>)}</aside></div>;
}

function ApprovalView({ approvals, campaignId, replay, onDecided }: Readonly<{ approvals: Approval[]; campaignId: string; replay: boolean; onDecided: (approvalId: string) => void }>) {
  if (approvals.length === 0) return <div className="empty-workspace"><CheckCircle2 size={28} /><h2>You’re all caught up</h2><p>New plan or message decisions will stay here until you act.</p></div>;
  return <div className="approval-list"><header><span className="product-kicker">Human checkpoints</span><h2>{approvals.length} consequential {approvals.length === 1 ? "action" : "actions"} waiting</h2><p>Review the consequence and policy reason before work resumes.</p></header>{approvals.map((approval) => <article key={approval.id}><div className="approval-icon"><MessageSquareText size={20} /></div><div className="approval-copy"><span>{approval.messageId === null ? "Plan approval" : "Message approval"}</span><h3>{approval.messageId === null ? "Start the approved campaign route" : "Send an evidence-linked message"}</h3><p>{approval.reason}</p><dl><div><dt>Decision</dt><dd>{approval.decision.replace("_", " ")}</dd></div><div><dt>Requested</dt><dd>{approval.requestedAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</dd></div><div><dt>Consequence</dt><dd>{approval.messageId === null ? "Agent execution resumes" : "Message is delivered to the approved contact"}</dd></div></dl><ApprovalButtons approval={approval} campaignId={campaignId} replay={replay} onDecided={onDecided} /></div></article>)}</div>;
}

function ApprovalButtons({ approval, campaignId, replay, onDecided }: Readonly<{ approval: Approval; campaignId: string; replay: boolean; onDecided: (approvalId: string) => void }>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(approved: boolean) {
    setBusy(true); setError("");
    try {
      if (!replay) {
        const url = approval.messageId === null ? `/api/campaigns/${campaignId}/approve` : `/api/messages/${approval.messageId}/approve`;
        const body = approval.messageId === null ? { approvalId: approval.id, approved, decidedBy: "demo-operator" } : { approved, decidedBy: "demo-operator" };
        await readContractJson(await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
      }
      onDecided(approval.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The decision could not be recorded."); }
    setBusy(false);
  }
  return <div className="approval-actions"><button className="product-button product-button--primary" disabled={busy} onClick={() => void decide(true)} type="button"><Check size={16} /> {busy ? "Recording…" : "Approve"}</button><button className="product-button product-button--quiet" disabled={busy} onClick={() => void decide(false)} type="button"><X size={16} /> Reject</button>{error && <p role="alert">{error}</p>}</div>;
}

function EvidenceDrawer({ target, signals, edge, reason, onClose }: Readonly<{ target: Target; signals: Signal[]; edge: Edge | null; reason: string | undefined; onClose: () => void }>) {
  const titleId = useId();
  return <div className="drawer-scrim"><aside aria-labelledby={titleId} aria-modal="true" className="evidence-drawer" role="dialog"><header><div><span className="product-kicker">Proof graph</span><h2 id={titleId}>{target.name}</h2><p>{reason ?? "Evidence accumulated for this target."}</p></div><button aria-label="Close evidence" onClick={onClose} type="button"><X size={18} /></button></header>{edge && <div className="intro-path"><Link2 size={17} /><div><span>Warm introduction available</span><strong>Linked through a verified creator mention</strong></div></div>}<div className="proof-chain"><span>Signal</span><i /><span>Source</span><i /><span>Implication</span><i /><span>Action</span></div>{signals.length === 0 ? <div className="drawer-empty"><Sparkles size={23} /><h3>No evidence receipts yet</h3><p>The target is known, but its source-backed signals have not arrived on this stream.</p></div> : signals.map((signal) => <article className="evidence-card" key={signal.id}><div className="evidence-head"><span>{signal.evidenceKind}</span>{signal.evidenceKind === "documentary" && signal.payload.verified ? <b><CheckCircle2 size={13} /> Verified</b> : <b>{Math.round(signal.payload.strength * 100)}% strength</b>}</div>{signal.evidenceKind === "documentary" ? <><blockquote>“{signal.payload.excerpt}”</blockquote><a href={signal.payload.sourceRef} rel="noreferrer" target="_blank">{signal.payload.sourceRef}</a><p><strong>Implication</strong>{signal.payload.implication}</p></> : <><div className="stat-evidence"><strong>{signal.payload.value}</strong><span>{signal.payload.metric}<small>Baseline {signal.payload.baseline} · {signal.payload.window}</small></span></div><p><strong>Implication</strong>{signal.payload.implication}</p></>}</article>)}<div className="dropped-claims"><ShieldCheck size={16} /><span><strong>Verification filtering is active.</strong> The dropped-claim count is not exposed by the current detail or SSE contract.</span></div></aside></div>;
}
