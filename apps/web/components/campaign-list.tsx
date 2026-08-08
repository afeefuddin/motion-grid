"use client";

import { ArrowRight, CircleDollarSign, MessageCircle, Plus, Route } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { z } from "zod";
import { ListCampaignsResponseSchema } from "../../../src/contracts/api";
import { readContractJson } from "./http";

type CampaignSummary = z.infer<typeof ListCampaignsResponseSchema>["campaigns"][number];
const workspaceId = "10000000-0000-4000-8000-000000000001";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function CampaignList() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

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
        <div className="campaign-table-wrap"><table className="campaign-table"><thead><tr><th>Campaign</th><th>Motions</th><th>Status</th><th>Spend</th><th>Replies</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id}><td><strong>{campaign.name}</strong><small>{campaign.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small></td><td><div className="motion-labels">{campaign.motions.length > 0 ? campaign.motions.map((motion) => <span key={motion}>{motion}</span>) : <em>Planning</em>}</div></td><td><span className={`state-label state-label--${campaign.status}`}>{campaign.status.replace("_", " ")}</span></td><td><span className="money-line"><CircleDollarSign size={14} /> {usd.format(campaign.operatingSpentCents / 100)}</span><small>{inr.format(campaign.commitSpentCents / 100)} committed</small></td><td><span className="money-line"><MessageCircle size={14} /> {campaign.replyCount}</span></td><td><Link className="row-link" href={`/campaigns/${campaign.id}`} aria-label={`Open ${campaign.name}`}><ArrowRight size={17} /></Link></td></tr>)}</tbody></table></div>
      )}
    </section>
  );
}
