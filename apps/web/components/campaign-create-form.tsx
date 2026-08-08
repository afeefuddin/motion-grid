"use client";

import { ArrowLeft, ArrowUp, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreateCampaignResponseSchema } from "../../../src/contracts/api";
import { BrandMark } from "./brand-mark";
import { readContractJson } from "./http";

const workspaceId = "10000000-0000-4000-8000-000000000001";

const suggestions = [
  "Find Bengaluru salons with weak online booking and build a qualified demo pipeline.",
  "Identify creator partners for our launch in Chennai and prepare evidence-backed outreach.",
  "Find high-fit local businesses showing recent demand and introduce us to decision makers.",
];

export function CampaignCreateForm() {
  const router = useRouter();
  const [objective, setObjective] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = objective.trim();
    if (message.length === 0) return;
    setState("submitting");
    setError("");
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          objective: message,
        }),
      });
      const created = CreateCampaignResponseSchema.parse(await readContractJson(response));
      router.push(`/campaigns/${created.campaign.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Campaign planning could not start.");
      setState("error");
    }
  }

  return (
    <section className="campaign-chat-page">
      <header className="chat-header">
        <Link className="back-link" href="/campaigns"><ArrowLeft size={15} /> Campaigns</Link>
        <span>New campaign</span>
        <i />
      </header>

      <div className="campaign-chat-thread">
        <div className="chat-welcome">
          <span className="chat-spark"><Sparkles size={18} /></span>
          <h1>What do you want to accomplish?</h1>
          <p>Describe the outcome in your own words. MotionGrid will choose the motions, providers, policies, and route for you to review.</p>
        </div>

        <div className="assistant-message">
          <span className="assistant-mark"><BrandMark /></span>
          <div>
            <strong>MotionGrid</strong>
            <p>Tell me who you want to reach, where they are, and what outcome you want. Add any important constraints directly in your message.</p>
          </div>
        </div>

        <fieldset className="prompt-suggestions">
          <legend className="sr-only">Example campaign objectives</legend>
          {suggestions.map((suggestion) => (
            <button key={suggestion} onClick={() => setObjective(suggestion)} type="button">{suggestion}</button>
          ))}
        </fieldset>

        {state === "submitting" && (
          <div className="user-message"><p>{objective}</p></div>
        )}
        {state === "submitting" && (
          <div className="assistant-message assistant-message--thinking">
            <span className="assistant-mark"><BrandMark /></span>
            <div><strong>MotionGrid</strong><p>Turning that objective into a reviewable campaign route…</p><span className="thinking-dots"><i /><i /><i /></span></div>
          </div>
        )}
      </div>

      <div className="chat-composer-wrap">
        <form className="chat-composer" onSubmit={submit}>
          <textarea
            aria-label="Campaign objective"
            disabled={state === "submitting"}
            onChange={(event) => setObjective(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Describe the campaign you want to run…"
            rows={3}
            value={objective}
          />
          <div className="composer-footer">
            <span>Enter to send · Shift + Enter for a new line</span>
            <button aria-label="Create campaign" disabled={state === "submitting" || objective.trim().length === 0} type="submit"><ArrowUp size={18} /></button>
          </div>
        </form>
        {error && <p className="chat-error" role="alert">{error}</p>}
        <p className="chat-assurance">Nothing is sent without your approval.</p>
      </div>
    </section>
  );
}
