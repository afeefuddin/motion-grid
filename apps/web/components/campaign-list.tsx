"use client";

import { ArrowRight, CircleDollarSign, MessageCircle, Plus, Route, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { z } from "zod";
import { DeleteCampaignResponseSchema, ListCampaignsResponseSchema } from "../../../src/contracts/api";
import { readContractJson } from "./http";

type CampaignSummary = z.infer<typeof ListCampaignsResponseSchema>["campaigns"][number];
const workspaceId = "10000000-0000-4000-8000-000000000001";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function CampaignList() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignSummary | null>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/campaigns?workspaceId=${workspaceId}`);
        const parsed = ListCampaignsResponseSchema.parse(await readContractJson(response));
        setCampaigns(parsed.campaigns);
        setState("ready");
      } catch {
        setState("error");
      }
    }
    void load();
  }, []);

  return (
    <section className="campaigns-page">
      <header className="page-heading">
        <div><span className="product-kicker">Campaign control</span><h1>Your routes to market</h1><p>Plan, approve, and supervise every consequential GTM action.</p></div>
        <Link className="product-button product-button--primary" href="/campaigns/new"><Plus size={17} /> New campaign</Link>
      </header>
      {state === "loading" && <output className="campaign-skeleton" aria-label="Loading campaigns"><i /><i /><i /></output>}
      {state === "error" && (
        <div className="empty-workspace"><Route size={28} /><h2>The live workspace is not connected</h2><p>You can still inspect the complete recorded campaign while the database is unavailable.</p><Link className="product-button product-button--primary" href="/campaigns/10000000-0000-4000-8000-000000000002?replay=1">Open recorded run <ArrowRight size={16} /></Link></div>
      )}
      {state === "ready" && campaigns.length === 0 && <div className="empty-workspace"><Route size={28} /><h2>No routes planned yet</h2><p>Give MotionGrid one objective. It will return an auditable plan before work begins.</p><Link className="product-button product-button--primary" href="/campaigns/new">Plan the first campaign</Link></div>}
      {campaigns.length > 0 && (
        <div className="campaign-table-wrap"><table className="campaign-table"><thead><tr><th>Campaign</th><th>Motions</th><th>Status</th><th>Spend</th><th>Replies</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id}><td><strong>{campaign.name}</strong><small>{campaign.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small></td><td><div className="motion-labels">{campaign.motions.length > 0 ? campaign.motions.map((motion) => <span key={motion}>{motion}</span>) : <em>Planning</em>}</div></td><td><span className={`state-label state-label--${campaign.status}`}>{campaign.status.replace("_", " ")}</span></td><td><span className="money-line"><CircleDollarSign size={14} /> {usd.format(campaign.operatingSpentCents / 100)}</span><small>{inr.format(campaign.commitSpentCents / 100)} committed</small></td><td><span className="money-line"><MessageCircle size={14} /> {campaign.replyCount}</span></td><td><div className="campaign-row-actions"><button className="row-delete" type="button" aria-label={`Delete ${campaign.name}`} onClick={(event) => { deleteTrigger.current = event.currentTarget; setCampaignToDelete(campaign); }}><Trash2 size={15} /></button><Link className="row-link" href={`/campaigns/${campaign.id}`} aria-label={`Open ${campaign.name}`}><ArrowRight size={17} /></Link></div></td></tr>)}</tbody></table></div>
      )}
      {campaignToDelete && <DeleteCampaignDialog campaign={campaignToDelete} onClose={() => { setCampaignToDelete(null); window.requestAnimationFrame(() => deleteTrigger.current?.focus()); }} onDeleted={(campaignId) => { setCampaigns((current) => current.filter((campaign) => campaign.id !== campaignId)); setCampaignToDelete(null); window.requestAnimationFrame(() => deleteTrigger.current?.focus()); }} />}
    </section>
  );
}

function DeleteCampaignDialog({ campaign, onClose, onDeleted }: Readonly<{ campaign: CampaignSummary; onClose: () => void; onDeleted: (campaignId: string) => void }>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancelButton = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    cancelButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
      const result = DeleteCampaignResponseSchema.parse(await readContractJson(response));
      onDeleted(result.campaignId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The campaign could not be deleted.");
      setBusy(false);
    }
  }

  function keepFocusInside(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const controls = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    if (controls === undefined || controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return <div className="delete-dialog-scrim"><section aria-describedby={descriptionId} aria-labelledby={titleId} aria-modal="true" className="delete-dialog" onKeyDown={keepFocusInside} ref={dialog} role="dialog"><button aria-label="Close delete campaign dialog" className="delete-dialog-close" disabled={busy} onClick={onClose} type="button"><X size={17} /></button><div className="delete-dialog-icon"><Trash2 size={21} /></div><span className="product-kicker">Permanent action</span><h2 id={titleId}>Delete {campaign.name}?</h2><p id={descriptionId}>MotionGrid will stop every active agent in this campaign before permanently deleting its plan, targets, evidence, approvals, and history.</p>{error && <p className="delete-dialog-error" role="alert">{error}</p>}<div className="delete-dialog-actions"><button className="product-button product-button--quiet" disabled={busy} onClick={onClose} ref={cancelButton} type="button">Keep campaign</button><button className="product-button product-button--danger" disabled={busy} onClick={() => void remove()} type="button"><Trash2 size={15} /> {busy ? "Stopping agents…" : "Stop agents and delete"}</button></div></section></div>;
}
