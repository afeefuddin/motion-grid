"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCircle2, ChevronRight, CircleDollarSign, FileCheck2, Link2, MessageSquareText, Radio, RefreshCw, Route, ShieldCheck, SlidersHorizontal, Sparkles, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import type { z } from "zod";
import { CampaignDetailResponseSchema, ContinueCampaignResponseSchema, SseEventSchema, type SseEvent } from "../../../src/contracts/api";
import type { Approval, CampaignConversationMessage, Edge, Signal, Target } from "../../../src/contracts/entities";
import { PlanDataSchema } from "../../../src/contracts/steps";
import { readContractJson } from "./http";
import { replayCampaign, replayEvents, replayPlan } from "./replay-fixture";
import { BrandMark } from "./brand-mark";

type CampaignDetail = z.infer<typeof CampaignDetailResponseSchema>;
type PlanData = z.infer<typeof PlanDataSchema>;
export type CampaignWorkspaceView = "chat" | "plan" | "targets" | "approvals";
type Connection = "connecting" | "connected" | "reconnecting" | "offline" | "replay";

type Projection = {
  plan: PlanData | null;
  targets: Target[];
  reasons: Record<string, string>;
  droppedCounts: Record<string, number>;
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
  return { plan, targets: detail.targets, reasons: {}, droppedCounts: {}, signals: [], edges: [], approvals: detail.approvals, operatingCents: detail.campaign.operatingSpentCents, commitCents: detail.campaign.commitSpentCents, warning: null, replan: null, activities: [] };
}

function activityText(event: SseEvent) {
  if (event.type === "agent.status") return `${event.data.label} ${event.data.status} — ${event.data.detail}`;
  if (event.type === "motion_selected") return `Selected ${event.data.motionId} — ${event.data.rationale}`;
  if (event.type === "motion_declined") return `Declined ${event.data.motionId} — ${event.data.reason}`;
  if (event.type === "target.state") return `${event.data.to.replace("_", " ")} target ${event.data.targetId.slice(0, 8)}`;
  if (event.type === "signal.added") return `Verified evidence for target ${event.data.signal.targetId.slice(0, 8)}`;
  if (event.type === "assessment.recorded") return `Recorded assessment for target ${event.data.targetId.slice(0, 8)} — ${event.data.droppedCount} claims filtered`;
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
  const next = { ...previous, activities: [activity, ...previous.activities.filter((item) => item.id !== event.id)].slice(0, 12) };
  if (event.type === "plan.delta" && event.data.snapshot !== null) return { ...next, plan: event.data.snapshot };
  if (event.type === "target.state") return { ...next, targets: previous.targets.map((target) => target.id === event.data.targetId ? { ...target, status: event.data.to } : target), reasons: event.data.reason === null ? previous.reasons : { ...previous.reasons, [event.data.targetId]: event.data.reason } };
  if (event.type === "signal.added") return { ...next, signals: [...previous.signals.filter((signal) => signal.id !== event.data.signal.id), event.data.signal] };
  if (event.type === "assessment.recorded") return { ...next, droppedCounts: { ...previous.droppedCounts, [event.data.targetId]: event.data.droppedCount } };
  if (event.type === "edge.discovered") return { ...next, edges: [...previous.edges.filter((edge) => edge.id !== event.data.edge.id), event.data.edge] };
  if (event.type === "approval.required") return { ...next, approvals: [...previous.approvals.filter((approval) => approval.id !== event.data.approval.id), event.data.approval] };
  if (event.type === "cost.tick") return { ...next, operatingCents: event.data.operatingTotalCents, commitCents: event.data.commitTotalCents };
  if (event.type === "policy_warning") return { ...next, warning: event.data.reason };
  if (event.type === "replan_started") return { ...next, replan: { trigger: event.data.trigger, reason: event.data.reason } };
  return next;
}

function formatUsd(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100); }
function formatInr(cents: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(cents / 100); }

export function CampaignWorkspace({ campaignId, replay, view = "chat" }: Readonly<{ campaignId: string; replay: boolean; view?: CampaignWorkspaceView }>) {
  const [detail, setDetail] = useState<CampaignDetail | null>(replay ? replayCampaign : null);
  const [projection, setProjection] = useState<Projection | null>(replay ? initialProjection(replayCampaign, replayPlan) : null);
  const [connection, setConnection] = useState<Connection>(replay ? "replay" : "connecting");
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [replayIndex, setReplayIndex] = useState(0);
  const [conversation, setConversation] = useState<CampaignConversationMessage[]>(replay ? replayCampaign.conversation : []);
  const [activeRunId, setActiveRunId] = useState(campaignId);
  const [activeAgent, setActiveAgent] = useState<{ label: string; detail: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");

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
        setConversation(parsed.conversation);
        const latestRun = [...parsed.conversation].reverse().find((message) => message.runId !== null)?.runId;
        setActiveRunId(latestRun ?? campaignId);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Campaign could not be loaded.");
        setConnection("offline");
      }
    }
    void load();
  }, [campaignId, replay]);

  useEffect(() => {
    if (replay) return;
    const source = new EventSource(`/api/stream/${activeRunId}`);
    const receive = (message: MessageEvent<string>) => {
      const value: unknown = JSON.parse(message.data, (_key, item: unknown) => {
        if (typeof item === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(item)) return new Date(item);
        return item;
      });
      const event = SseEventSchema.parse(value);
      setProjection((current) => current === null ? current : projectRun(current, event));
      if (event.type === "agent.status") {
        if (event.data.status === "running") {
          setActiveAgent({ label: event.data.label, detail: event.data.detail });
        } else {
          setActiveAgent((current) => current?.label === event.data.label ? null : current);
        }
        if (event.data.status === "failed") {
          setConversation((current) => current.map((message) => message.runId === event.runId && message.role === "motiongrid" ? { ...message, status: "failed", content: `I couldn’t finish this change: ${event.data.detail}` } : message));
        }
      }
      if (event.type === "run.done") {
        setActiveAgent(null);
        setConversation((current) => current.map((message) => message.runId === event.runId && message.role === "motiongrid" ? { ...message, status: "completed", content: "The run is complete. The campaign artifact now includes the latest verified results." } : message));
      }
    };
    const eventTypes = ["agent.status", "plan.delta", "motion_selected", "motion_declined", "capability_ranked", "binding_chosen", "policy_warning", "replan_started", "target.state", "cost.tick", "signal.added", "assessment.recorded", "edge.discovered", "approval.required", "message.sent", "interaction.received", "run.done"];
    source.onopen = () => setConnection("connected");
    source.onerror = () => setConnection(source.readyState === EventSource.CONNECTING ? "reconnecting" : "offline");
    for (const eventType of eventTypes) source.addEventListener(eventType, receive);
    return () => source.close();
  }, [activeRunId, replay]);

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
  const agentIsRunning = conversation.some((message) => message.role === "motiongrid" && message.status === "running");
  const originalObjective = detail.objective.prompt.split("\n\nOperator amendment:")[0] ?? detail.objective.prompt;
  const campaignHref = (destination: CampaignWorkspaceView) => {
    const path = destination === "chat" ? `/campaigns/${campaignId}` : `/campaigns/${campaignId}/${destination}`;
    return replay ? `${path}?replay=1` : path;
  };

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (message.length === 0 || sending || agentIsRunning || replay) return;
    setSending(true);
    setChatError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const result = ContinueCampaignResponseSchema.parse(await readContractJson(response));
      setConversation((current) => [...current, result.operatorMessage, result.assistantMessage]);
      setActiveRunId(result.run.id);
      setActiveAgent({ label: "Agent dispatch", detail: "Starting the objective compiler with your latest amendment." });
      setDetail((current) => current === null ? current : { ...current, campaign: { ...current.campaign, status: "planning" } });
      setDraft("");
    } catch (reason) {
      setChatError(reason instanceof Error ? reason.message : "The campaign change could not be started.");
    }
    setSending(false);
  }

  return (
    <section className={`workspace-page workspace-page--${view}`}>
      <header className="workspace-title"><div><Link className="back-link" href="/campaigns"><ArrowLeft size={14} /> Campaigns</Link><h1>{detail.campaign.name}</h1>{view !== "chat" && <p>{originalObjective}</p>}</div><span className={`connection-pill connection-pill--${connection}`}><Radio size={13} /> {connection}</span></header>
      {view === "chat" ? (
        <div className="campaign-chat-workspace">
          <ConversationPanel activeAgent={activeAgent} conversation={conversation} draft={draft} error={chatError} initialObjective={originalObjective} isRunning={agentIsRunning} onDraftChange={setDraft} onSubmit={sendMessage} replay={replay} sending={sending} />
          <CampaignContextPanel activeAgent={activeAgent} campaignName={detail.campaign.name} committed={formatInr(projection.commitCents)} examined={projection.targets.length} fitCount={fitCount} hrefFor={campaignHref} operating={formatUsd(projection.operatingCents)} pending={pending.length} rejectedCount={rejectedCount} status={detail.campaign.status} />
        </div>
      ) : (
        <section className="campaign-artifact campaign-artifact--route" aria-label="Live campaign artifact">
          <nav className="workspace-tabs" aria-label="Campaign views"><Link href={campaignHref("chat")}><MessageSquareText size={16} /> Conversation</Link><Link className={view === "plan" ? "is-active" : ""} href={campaignHref("plan")}><Route size={16} /> Plan</Link><Link className={view === "targets" ? "is-active" : ""} href={campaignHref("targets")}><SlidersHorizontal size={16} /> Targets</Link><Link className={view === "approvals" ? "is-active" : ""} href={campaignHref("approvals")}><FileCheck2 size={16} /> Approvals {pending.length > 0 && <b>{pending.length}</b>}</Link></nav>
          <div className="command-strip" aria-live="polite"><div><span>Phase</span><strong>{detail.campaign.status.replace("_", " ")}</strong></div><div><span>Examined</span><strong>{projection.targets.length}</strong></div><div><span>Qualified / rejected</span><strong>{fitCount} / {rejectedCount}</strong></div><div><span>Operating</span><strong>{formatUsd(projection.operatingCents)}</strong></div><div><span>Committed</span><strong>{formatInr(projection.commitCents)}</strong></div><Link className={pending.length > 0 ? "needs-attention" : ""} href={campaignHref("approvals")}><ShieldCheck size={15} /> {pending.length} approvals</Link></div>
          {projection.warning && <div className="budget-warning"><AlertTriangle size={18} /><div><strong>Budget checkpoint</strong><span>{projection.warning}</span></div></div>}
          {view === "plan" && <PlanView plan={projection.plan} replan={projection.replan} approvals={pending} replay={replay} campaignId={campaignId} onApproved={(approvalId) => setProjection((current) => current === null ? current : { ...current, approvals: current.approvals.map((approval) => approval.id === approvalId ? { ...approval, status: "approved" } : approval) })} />}
          {view === "targets" && <GridView projection={projection} selectedTargetId={selectedTargetId} onSelect={setSelectedTargetId} />}
          {view === "approvals" && <ApprovalView approvals={pending} campaignId={campaignId} replay={replay} onDecided={(approvalId) => setProjection((current) => current === null ? current : { ...current, approvals: current.approvals.map((approval) => approval.id === approvalId ? { ...approval, status: "approved" } : approval) })} />}
        </section>
      )}
      {selectedTarget && <EvidenceDrawer target={selectedTarget} signals={projection.signals.filter((signal) => signal.targetId === selectedTarget.id)} edge={projection.edges.find((edge) => edge.toTargetId === selectedTarget.id) ?? null} reason={projection.reasons[selectedTarget.id]} droppedCount={projection.droppedCounts[selectedTarget.id]} onClose={() => setSelectedTargetId(null)} />}
    </section>
  );
}

function CampaignContextPanel({ activeAgent, campaignName, committed, examined, fitCount, hrefFor, operating, pending, rejectedCount, status }: Readonly<{ activeAgent: { label: string; detail: string } | null; campaignName: string; committed: string; examined: number; fitCount: number; hrefFor: (view: CampaignWorkspaceView) => string; operating: string; pending: number; rejectedCount: number; status: string }>) {
  return <aside className="campaign-context" aria-label="Campaign context"><header><div><span className="product-kicker">Campaign context</span><h2>{campaignName}</h2></div><span className="context-phase"><i />{status.replace("_", " ")}</span></header><nav aria-label="Open campaign view"><Link className="is-active" href={hrefFor("chat")}><MessageSquareText size={18} /><span><strong>Conversation</strong><small>Steer the campaign</small></span><ChevronRight size={15} /></Link><Link href={hrefFor("plan")}><Route size={18} /><span><strong>Plan</strong><small>Route, providers and policies</small></span><ChevronRight size={15} /></Link><Link href={hrefFor("targets")}><SlidersHorizontal size={18} /><span><strong>Targets</strong><small>{examined} examined · {fitCount} qualified</small></span><ChevronRight size={15} /></Link><Link className={pending > 0 ? "needs-attention" : ""} href={hrefFor("approvals")}><FileCheck2 size={18} /><span><strong>Approvals</strong><small>{pending > 0 ? `${pending} waiting for you` : "No pending decisions"}</small></span><b>{pending}</b></Link></nav><section className="context-receipt"><h3>Run receipt</h3><dl><div><dt>Operating</dt><dd>{operating}</dd></div><div><dt>Committed</dt><dd>{committed}</dd></div><div><dt>Qualified</dt><dd>{fitCount}</dd></div><div><dt>Rejected</dt><dd>{rejectedCount}</dd></div></dl></section>{activeAgent && <section className="context-active-agent"><span className="live-pulse" /><div><strong>{activeAgent.label}</strong><p>{activeAgent.detail}</p></div></section>}</aside>;
}

function ConversationPanel({ activeAgent, conversation, draft, error, initialObjective, isRunning, onDraftChange, onSubmit, replay, sending }: Readonly<{ activeAgent: { label: string; detail: string } | null; conversation: CampaignConversationMessage[]; draft: string; error: string; initialObjective: string; isRunning: boolean; onDraftChange: (value: string) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; replay: boolean; sending: boolean }>) {
  return <aside className="campaign-conversation" aria-label="Campaign conversation"><header><div><span className="product-kicker">Campaign brief</span><h2>Steer the agents</h2></div><span className={isRunning ? "conversation-state is-running" : "conversation-state"}>{isRunning ? "Agents working" : "Ready"}</span></header><div className="campaign-conversation-thread" aria-live="polite">{conversation.length === 0 && <><div className="conversation-operator"><p>{initialObjective}</p></div><div className="conversation-assistant"><span className="assistant-mark"><BrandMark /></span><div><strong>MotionGrid</strong><p>The first route is here. Ask me to change the audience, motion mix, budget, evidence bar, or outreach constraints.</p></div></div></>}{conversation.map((message) => message.role === "operator" ? <div className="conversation-operator" key={message.id}><p>{message.content}</p><time>{message.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</time></div> : <div className={`conversation-assistant conversation-assistant--${message.status}`} key={message.id}><span className="assistant-mark"><BrandMark /></span><div><div className="conversation-author"><strong>MotionGrid</strong><span>{message.status === "running" ? "working" : message.status}</span></div><p>{message.content}</p>{message.status === "running" && <span className="thinking-dots"><i /><i /><i /></span>}</div></div>)}{activeAgent && <div className="agent-work-receipt"><span className="live-pulse" /><div><strong>{activeAgent.label}</strong><p>{activeAgent.detail}</p></div></div>}</div><form className="campaign-conversation-composer" onSubmit={onSubmit}><textarea aria-label="Change this campaign" disabled={isRunning || sending || replay} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={isRunning ? "Wait for the current change to finish…" : "Ask the agents to change this campaign…"} rows={3} value={draft} /><div><span>{isRunning ? "The artifact updates as agents finish" : "Enter to send · Shift + Enter for a new line"}</span><button aria-label="Send campaign change" disabled={draft.trim().length === 0 || isRunning || sending || replay} type="submit"><ArrowUp size={16} /></button></div>{error && <p className="chat-error" role="alert">{error}</p>}</form></aside>;
}

function MotionRationale({ rationale }: Readonly<{ rationale: string }>) {
  const rubricIndex = rationale.indexOf("rubric:");
  if (rubricIndex === -1) return <p className="motion-summary">{rationale}</p>;
  const lead = rationale.slice(0, rubricIndex).trim();
  const orderingIndex = lead.indexOf("Targets are ordered");
  const summary = (orderingIndex === -1 ? lead : lead.slice(0, orderingIndex)).trim();
  const rubricAndNote = rationale.slice(rubricIndex + "rubric:".length);
  const noteIndex = rubricAndNote.indexOf("Rejected targets remain visible");
  const rubric = (noteIndex === -1 ? rubricAndNote : rubricAndNote.slice(0, noteIndex)).replace(/[.\s]+$/, "");
  const retentionNote = noteIndex === -1 ? "" : rubricAndNote.slice(noteIndex).trim();
  const criteria = rubric.split(";").map((criterion) => criterion.trim()).filter(Boolean).map((criterion) => {
    const match = criterion.match(/^([\w.-]+)\s*\(([\d.]+)\):\s*(.+)$/);
    if (match === null) return null;
    const [, key = "", weightValue = "0", description = ""] = match;
    return { key, weight: Math.round(Number(weightValue) * 100), description: description.replace(/\.$/, "") };
  }).filter((criterion): criterion is { key: string; weight: number; description: string } => criterion !== null);
  return <div className="motion-rationale"><p className="motion-summary">{summary}</p>{criteria.length > 0 && <section className="rubric-breakdown" aria-label="Qualification rubric"><h4>Qualification rubric</h4><div>{criteria.map((criterion) => <article key={criterion.key}><span>{criterion.weight}%</span><div><strong>{criterion.key.replaceAll("_", " ")}</strong><p>{criterion.description}</p></div></article>)}</div>{retentionNote && <p className="rubric-note"><XCircle size={14} />{retentionNote}</p>}</section>}</div>;
}

const motionLabels: Record<string, string> = {
  "business.local": "Find local businesses",
  "business.online": "Find online businesses",
  creator: "Find relevant creators",
  "consumer.ads": "Build a customer ad audience",
  "consumer.email": "Reach existing customers",
};

const capabilityCopy: Record<string, { title: string; description: string }> = {
  "geo.query": { title: "Find nearby businesses", description: "Identify businesses in the campaign geography that match the target profile." },
  "db.query": { title: "Search the business database", description: "Find organizations or creators that match the requested audience." },
  "web.fetch": { title: "Check their website", description: "Review each candidate's public web presence for useful evidence." },
  "reviews.fetch": { title: "Read customer reviews", description: "Look for recent customer signals that support or rule out a target." },
  "people.find": { title: "Find the right contact", description: "Identify a relevant person and an approved way to reach them." },
  "segment.build": { title: "Build a customer segment", description: "Create an audience from connected first-party customer data." },
};

function readableMotion(motionId: string) {
  return motionLabels[motionId] ?? motionId.replaceAll(".", " ");
}

function readableProvider(adapterId: string, mode: string) {
  if (mode === "generated") return "Generated market research";
  if (mode === "sim") return "Local market simulator";
  return adapterId.replaceAll(".", " ");
}

function readableDecline(reason: string) {
  if (reason.includes("no first-party customer data source")) {
    return "This needs a connected customer data source. Connect one before this route can run.";
  }
  return reason;
}

function ProviderChoice({ binding }: Readonly<{ binding: PlanData["motions"][number]["bindings"][number] }>) {
  const copy = capabilityCopy[binding.capabilityId] ?? { title: binding.capabilityId, description: "Prepare this campaign capability." };
  const selected = binding.candidates.find((candidate) => candidate.adapterId === binding.chosen.adapterId) ?? binding.candidates[0];
  return <section className="capability-choice">
    <div className="capability-choice__heading">
      <div><span>Next step</span><h4>{copy.title}</h4><p>{copy.description}</p></div>
      <div className="source-choice"><span>Using</span><strong>{readableProvider(binding.chosen.adapterId, binding.chosen.mode)}</strong><p>{selected?.eligible ? "Available for this campaign" : "Selected source"}</p></div>
    </div>
    <details className="provider-details">
      <summary>Show source-selection details</summary>
      <p className="provider-details__context">{binding.weightsRationale}</p>
      <ul>{binding.candidates.map((candidate) => <li key={candidate.adapterId}><strong>{readableProvider(candidate.adapterId, candidate.mode)}</strong><span>{candidate.adapterId === binding.chosen.adapterId ? "Selected" : candidate.eligible ? "Available, not selected" : "Unavailable"}</span><p>{candidate.reason}</p></li>)}</ul>
    </details>
  </section>;
}

function PlanView({ plan, replan, approvals, replay, campaignId, onApproved }: Readonly<{ plan: PlanData | null; replan: Projection["replan"]; approvals: Approval[]; replay: boolean; campaignId: string; onApproved: (approvalId: string) => void }>) {
  if (plan === null) return <div className="empty-workspace"><RefreshCw size={28} /><h2>The plan is taking shape</h2><p>Motion selection and provider ranking will appear here when the planner publishes them.</p></div>;
  const planApproval = approvals.find((approval) => approval.messageId === null);
  return <div className="plan-layout"><div className="plan-main"><section className="plan-intro"><span className="product-kicker">Campaign plan</span><h2>What MotionGrid will do next</h2><p>This is the route ready to run. Source-selection details remain available when you need to audit a decision.</p><div className="dual-budget"><div><CircleDollarSign size={18} /><span>Operating ceiling</span><strong>{formatUsd(plan.budget.operating.amountMinor)}</strong></div><div><span className="rupee-mark">₹</span><span>Commit ceiling</span><strong>{formatInr(plan.budget.commit.amountMinor)}</strong></div></div></section>{replan && <div className="replan-card"><RefreshCw size={19} /><div><span>Route amended · {replan.trigger.replace("_", " ")}</span><strong><s>outscraper</s> <ArrowRight size={15} /> market.geo</strong><p>{replan.reason}</p></div></div>}<div className="motion-plan-list">{plan.motions.map((motion) => <article className="motion-plan" key={motion.motionId}><header><div><span className="selected-marker"><Check size={13} /> Ready to run</span><h3>{readableMotion(motion.motionId)}</h3><MotionRationale rationale={motion.rationale} /></div><div className="motion-budget"><span>{formatUsd(motion.operatingBudgetCents)}</span><span>{formatInr(motion.commitBudgetCents)}</span></div></header>{motion.bindings.map((binding) => <ProviderChoice binding={binding} key={binding.capabilityId} />)}</article>)}</div><section className="declined-section"><div className="section-line-heading"><div><span className="product-kicker">Not ready yet</span><h2>Routes that need something first</h2></div><p>These are not failures. They are waiting on a missing source or capability.</p></div>{plan.declinedMotions.map((motion) => <article key={motion.motionId}><XCircle size={19} /><div><strong>{readableMotion(motion.motionId)}</strong><p>{readableDecline(motion.reason)}</p></div></article>)}</section></div><aside className="plan-side"><section><span className="product-kicker">Policies</span><h3>Guardrails on this route</h3>{plan.policies.map((policy) => <div className="policy-item" key={policy.kind}><ShieldCheck size={17} /><div><strong>{policy.kind.replace("_", " ")}</strong><p>{policy.description}</p></div></div>)}</section>{planApproval && <section className="approval-callout"><span>Needs your decision</span><h3>Approve this route to begin execution</h3><p>{planApproval.reason}</p><ApprovalButtons approval={planApproval} campaignId={campaignId} replay={replay} onDecided={onApproved} /></section>}</aside></div>;
}

function GridView({ projection, selectedTargetId, onSelect }: Readonly<{ projection: Projection; selectedTargetId: string | null; onSelect: (targetId: string) => void }>) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"recent" | "state">("recent");
  const visible = useMemo(() => [...projection.targets.filter((target) => filter === "all" || target.status === filter)].sort((left, right) => sort === "state" ? left.status.localeCompare(right.status) : right.createdAt.getTime() - left.createdAt.getTime()), [filter, projection.targets, sort]);
  return <div className="grid-layout"><div className="grid-main"><div className="grid-toolbar"><div className="filter-chips">{["all", "fit", "not_fit", "pending_approval", "engaged"].map((item) => <button className={filter === item ? "is-active" : ""} key={item} onClick={() => setFilter(item)} type="button">{item.replace("_", " ")}</button>)}</div><button className="sort-control" onClick={() => setSort((current) => current === "recent" ? "state" : "recent")} type="button"><SlidersHorizontal size={14} /> Sort: {sort}</button></div><div className="target-table-wrap"><table className="target-table"><thead><tr><th>Target</th><th>Motion</th><th>State</th><th>Why</th><th>Evidence</th></tr></thead><tbody>{visible.map((target) => { const warmEdge = projection.edges.find((edge) => edge.toTargetId === target.id && edge.kind === "mentions"); const evidenceCount = projection.signals.filter((signal) => signal.targetId === target.id).length; return <tr className={selectedTargetId === target.id ? "is-selected" : target.status === "not_fit" ? "is-muted" : ""} key={target.id} onClick={() => onSelect(target.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onSelect(target.id); }}><td><strong>{target.name}</strong><small>{target.kind === "organization" ? target.payload.locality : target.kind === "person" ? target.payload.handle : target.payload.description}</small></td><td>{target.motionId}</td><td><span className={`state-label state-label--${target.status}`}>{target.status.replace("_", " ")}</span></td><td><span className="reason-preview">{projection.reasons[target.id] ?? (target.status === "not_fit" ? "Rejected by qualification" : "Awaiting next receipt")}</span></td><td>{warmEdge ? <button className="warm-intro" type="button"><Link2 size={13} /> Warm intro</button> : <span>{evidenceCount} signals <ChevronRight size={13} /></span>}</td></tr>; })}</tbody></table></div></div><aside className="activity-rail"><header><div><span className="live-pulse" /> Live activity</div><small>Semantic receipts</small></header>{projection.activities.length === 0 ? <p className="quiet-empty">Verified work will appear here during the run.</p> : projection.activities.map((activity) => <div className="activity-receipt" key={activity.id}><i /><p>{activity.text}</p><time>{activity.at}</time></div>)}</aside></div>;
}

function ApprovalView({ approvals, campaignId, replay, onDecided }: Readonly<{ approvals: Approval[]; campaignId: string; replay: boolean; onDecided: (approvalId: string, status: "approved" | "rejected") => void }>) {
  if (approvals.length === 0) return <div className="empty-workspace"><CheckCircle2 size={28} /><h2>You’re all caught up</h2><p>New message decisions will stay here until you act.</p></div>;
  return <div className="approval-list"><header><span className="product-kicker">Human checkpoints</span><h2>{approvals.length} message {approvals.length === 1 ? "approval" : "approvals"} waiting</h2><p>Review the evidence and policy reason. Nothing is sent until you approve.</p></header>{approvals.map((approval) => <article key={approval.id}><div className="approval-icon"><MessageSquareText size={20} /></div><div className="approval-copy"><span>Message approval</span><h3>Send an evidence-linked message</h3><p>{approval.reason}</p><dl><div><dt>Decision</dt><dd>{approval.decision.replace("_", " ")}</dd></div><div><dt>Requested</dt><dd>{approval.requestedAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</dd></div><div><dt>Consequence</dt><dd>Message is delivered to the approved contact</dd></div></dl><ApprovalButtons approval={approval} campaignId={campaignId} replay={replay} onDecided={onDecided} /></div></article>)}</div>;
}

function ApprovalButtons({ approval, campaignId, replay, onDecided }: Readonly<{ approval: Approval; campaignId: string; replay: boolean; onDecided: (approvalId: string, status: "approved" | "rejected") => void }>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(approved: boolean) {
    if (replay) return;
    setBusy(true); setError("");
    try {
      const endpoint = approval.messageId === null ? `/api/campaigns/${campaignId}/approve` : `/api/messages/${approval.messageId}/approve`;
      const body = approval.messageId === null ? { approvalId: approval.id, approved, decidedBy: "demo-operator" } : { approved, decidedBy: "demo-operator" };
      await readContractJson(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
      onDecided(approval.id, approved ? "approved" : "rejected");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The decision could not be recorded."); }
    setBusy(false);
  }
  if (replay) return <div className="approval-actions"><button className="product-button product-button--quiet" disabled type="button">Recorded run</button></div>;
  return <div className="approval-actions"><button className="product-button product-button--primary" disabled={busy} onClick={() => void decide(true)} type="button"><Check size={16} /> {busy ? "Recording…" : "Approve"}</button><button className="product-button product-button--quiet" disabled={busy} onClick={() => void decide(false)} type="button"><X size={16} /> Reject</button>{error && <p role="alert">{error}</p>}</div>;
}

function EvidenceDrawer({ target, signals, edge, reason, droppedCount, onClose }: Readonly<{ target: Target; signals: Signal[]; edge: Edge | null; reason: string | undefined; droppedCount: number | undefined; onClose: () => void }>) {
  const titleId = useId();
  return <div className="drawer-scrim"><aside aria-labelledby={titleId} aria-modal="true" className="evidence-drawer" role="dialog"><header><div><span className="product-kicker">Proof graph</span><h2 id={titleId}>{target.name}</h2><p>{reason ?? "Evidence accumulated for this target."}</p></div><button aria-label="Close evidence" onClick={onClose} type="button"><X size={18} /></button></header>{edge && <div className="intro-path"><Link2 size={17} /><div><span>Warm introduction available</span><strong>Linked through a verified creator mention</strong></div></div>}<div className="proof-chain"><span>Signal</span><i /><span>Source</span><i /><span>Implication</span><i /><span>Action</span></div>{signals.length === 0 ? <div className="drawer-empty"><Sparkles size={23} /><h3>No evidence receipts yet</h3><p>The target is known, but its source-backed signals have not arrived on this stream.</p></div> : signals.map((signal) => <article className="evidence-card" key={signal.id}><div className="evidence-head"><span>{signal.evidenceKind}</span>{signal.evidenceKind === "documentary" && signal.payload.verified ? <b><CheckCircle2 size={13} /> Verified</b> : <b>{Math.round(signal.payload.strength * 100)}% strength</b>}</div>{signal.evidenceKind === "documentary" ? <><blockquote>“{signal.payload.excerpt}”</blockquote><a href={signal.payload.sourceRef} rel="noreferrer" target="_blank">{signal.payload.sourceRef}</a><p><strong>Implication</strong>{signal.payload.implication}</p></> : <><div className="stat-evidence"><strong>{signal.payload.value}</strong><span>{signal.payload.metric}<small>Baseline {signal.payload.baseline} · {signal.payload.window}</small></span></div><p><strong>Implication</strong>{signal.payload.implication}</p></>}</article>)}<div className="dropped-claims"><ShieldCheck size={16} /><span><strong>Verification filtering is active.</strong> {droppedCount === undefined ? "Waiting for the assessment receipt." : `${droppedCount} ${droppedCount === 1 ? "claim was" : "claims were"} excluded before assessment.`}</span></div></aside></div>;
}
