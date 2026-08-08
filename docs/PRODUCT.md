Product context and long-term intent. **`docs/PLAN.md` is authoritative for what is being
built.** Where they disagree, PLAN.md wins.

# MotionGrid

> One goal. The right agents. Every GTM motion.

MotionGrid is an AI go-to-market engine that accepts a business objective, selects the appropriate domain agent, chooses the necessary capabilities and integrations, produces an auditable campaign plan, and executes approved work.

## Product scope

MotionGrid supports three GTM motions:

1. **Creator Motion** — creator partnerships, sponsorships, affiliate campaigns, UGC, and content distribution.
2. **Business Motion** — online and local B2B discovery, qualification, outreach, and pipeline generation.
3. **Consumer Motion** — B2C acquisition, conversion, lifecycle marketing, retention, and win-back.

These are the only user-facing domain agents. Smaller operations such as enrichment, contact discovery, scoring, and sending are capabilities used by those agents, not additional agents presented to the user.

## Core product experience

The user describes an outcome in plain language:

> Find independent gyms in Bangalore without online booking and get qualified demos.

MotionGrid should:

1. Understand the objective, target, constraints, geography, budget, and success metric.
2. Select Business Motion in local-discovery mode.
3. Construct a campaign plan.
4. Select the best connected providers for each required capability.
5. Estimate data volume, provider cost, and external actions.
6. Show assumptions and request approval where required.
7. Execute the campaign as a durable workflow.
8. Store evidence, interactions, and outcomes.
9. Recommend improvements based on measured results.

Users can override a decision, but they should not have to manually select agents or integrations for ordinary campaigns.

## Architecture

MotionGrid uses a hierarchical agents-as-tools architecture:

```text
User / API
    |
    v
GTM Orchestrator
    |-- Creator Agent
    |-- B2B Agent
    `-- B2C Agent
            |
            v
    Capability Registry
            |
            v
    Integration Adapters
            |
            v
    External Providers
```

The architecture follows three rules:

- **Agents reason.** They interpret objectives and produce structured plans.
- **Integrations execute.** Provider adapters perform searches, enrichment, CRM updates, and campaign actions.
- **Policies control.** Deterministic rules govern permissions, budgets, consent, approvals, and external side effects.

### GTM Orchestrator

The orchestrator is the single user-facing control layer. It:

- Understands the request.
- Selects one or more domain agents.
- Supplies workspace and campaign context.
- Combines plans when a campaign requires multiple motions.
- Identifies missing integrations.
- Estimates costs and expected volume.
- Inserts approval gates.
- Starts and monitors workflows.
- Explains progress, failures, and results.

The three domain agents are exposed to the orchestrator as typed tools:

```text
plan_creator_campaign(...)
plan_b2b_campaign(...)
plan_b2c_campaign(...)
```

Domain agents do not call one another directly. If Consumer Motion needs creator distribution, it recommends a creator sub-campaign. The orchestrator then calls Creator Motion and combines both plans into one execution graph.

### Structured campaign plan

Every domain agent returns a structured plan containing:

- Selected motion and operating mode.
- Assumptions and missing information.
- Ordered or parallel workflow steps.
- Required capabilities.
- Required and missing integrations.
- Estimated provider cost.
- Expected target volume.
- Approval points.
- Success metrics.
- Risks and constraints.
- Complementary human-led actions that the operator can carry out outside available integrations.

The plan is stored before execution and becomes the auditable specification for the campaign.

## Domain agents

### Creator Agent

The Creator Agent handles creator-led distribution and partnerships.

Responsibilities:

- Discover creators by subject, audience, platform, geography, and content.
- Analyze recent content and existing sponsorships.
- Estimate audience and brand alignment.
- Find verified business contact routes.
- Rank creators using evidence and confidence.
- Recommend sponsorship, affiliate, seeding, or UGC arrangements.
- Draft personalized partnership outreach.
- Track replies, negotiation, deliverables, publication, and performance.
- Apply campaign approval and disclosure requirements.

Primary metric: profitable creator partnerships and attributable results, not creators contacted.

Initial capabilities:

```text
search_creators
analyze_creator_content
score_creator_fit
find_creator_contact
design_partnership
draft_creator_outreach
track_creator_campaign
```

### B2B Agent

The B2B Agent handles both online companies and physical/local businesses. Discovery differs, but qualification, outreach, and pipeline management are shared.

#### Local mode

Local mode initially uses Outscraper to find physical businesses and retrieve structured business information. It can then:

- Remove duplicates, closed businesses, irrelevant results, and excluded chains.
- Group multiple locations belonging to one organization.
- Inspect websites and online capabilities.
- Analyze ratings and reviews for actionable pain signals.
- Identify owners, managers, and other decision-makers.
- Rank opportunities and explain why they qualify.

#### Online mode

Online mode discovers companies using company data, websites, job listings, funding announcements, technology signals, directories, and connected CRM data.

Shared responsibilities:

- Define and apply an ICP.
- Discover and enrich accounts.
- Detect timing and buying signals.
- Map relevant decision-makers.
- Exclude customers, open opportunities, suppressed contacts, and duplicates.
- Score fit, intent, value, contactability, and uncertainty.
- Recommend a sales play.
- Prepare outreach with approval.
- Qualify replies, arrange meetings, and update the CRM.

Primary metric: qualified pipeline and revenue.

Initial capabilities:

```text
search_local_businesses
search_online_companies
analyze_business_website
analyze_business_reviews
find_decision_makers
score_b2b_opportunity
draft_sales_outreach
qualify_b2b_reply
```

### B2C Agent

The B2C Agent operates on audience segments and first-party customer data. It must not be designed as a consumer contact scraper or B2B-style cold-outreach system.

Responsibilities:

- Build audiences from consented customer and behavioral data.
- Identify acquisition, conversion, retention, expansion, and win-back opportunities.
- Analyze product, commerce, and campaign behavior.
- Recommend offers and channel combinations.
- Generate campaign copy and creative briefs.
- Activate through connected advertising and owned channels.
- Measure acquisition cost, conversion, retention, and lifetime value.
- Recommend and evaluate experiments.

Primary metrics: customer acquisition cost, conversion, retention, and lifetime value.

Initial capabilities:

```text
build_audience
analyze_customer_behavior
design_offer
generate_creative
plan_channel_mix
launch_lifecycle_campaign
measure_consumer_conversion
```

## Capability and integration layers

Agents request vendor-neutral capabilities rather than specific providers. For example, the B2B Agent requests `search_local_businesses`; a capability router selects Outscraper or another configured provider.

This separates business reasoning from vendor implementation and makes providers replaceable.

### Capability registry

Each capability records:

- Typed input and output schemas.
- Providers that implement it.
- Authentication and connection status.
- Cost model and estimated cost.
- Rate and volume limits.
- Geographic or platform coverage.
- Data freshness and expected confidence.
- Read versus write behavior.
- Risk level.
- Approval requirements.

### Integration adapters

Each provider is implemented behind a standardized adapter with operations to:

- Validate its connection.
- Advertise supported capabilities.
- Estimate cost before execution.
- Execute a typed request.
- Normalize results into MotionGrid entities.
- Return provenance, confidence, and provider errors.

Initial integration categories:

| Category | Examples of use |
| --- | --- |
| Local-business data | Outscraper discovery, business details, contacts, and reviews |
| Company and contact data | Online-company discovery, decision-makers, and verification |
| Creator data | Creator discovery, content, audience, and contact routes |
| CRM | Existing relationship checks, records, ownership, and pipeline |
| Outreach | Email preparation, sending, follow-up, and reply ingestion |
| Consumer data | Commerce, product behavior, customer segments, and events |
| Activation | Advertising, email, SMS, push, and creator campaigns |
| Analytics | Attribution, funnel performance, campaign cost, and outcomes |

## Planning and execution

Campaigns use two phases.

### Phase 1: Plan

The system can perform low-risk, read-only work needed to understand feasibility and create a plan. It presents:

- Selected motion and reasoning.
- Proposed workflow.
- Integrations that will be used.
- Sample output when useful.
- Estimated records, cost, and duration.
- External actions and approval points.
- Suggested field actions, clearly separated from work the system can execute.

### Phase 2: Execute

A durable workflow executor performs the approved plan. It, rather than the model conversation, manages:

- Parallel work.
- Long-running jobs.
- Retries and timeouts.
- Provider rate limits.
- Schedules and webhooks.
- Idempotency and duplicate prevention.
- Partial failures.
- Approval pauses and resumptions.
- Cancellation.

The model produces or revises the workflow plan; it does not hold workflow state in chat memory.

## Shared data model

All three motions operate on one entity graph:

```text
Workspace
Campaign
Organization
Location
Creator
Person
ConsumerSegment
Signal
Opportunity
Play
Interaction
Workflow
Action
Outcome
IntegrationConnection
Approval
```

Important relationships include:

- An organization can have multiple locations and people.
- A creator can be a person or an organization.
- Entities can have many signals and interactions.
- A campaign targets many entities or audience segments.
- An opportunity connects a campaign to a qualified entity.
- Outcomes belong to campaigns, plays, or interactions.

Every inferred value should include confidence, evidence, source, and generation time. This allows MotionGrid to explain qualification decisions and distinguish facts from model judgments.

## Memory

MotionGrid stores three kinds of memory:

1. **Workspace memory** — product information, positioning, approved claims, exclusions, tone, policies, and ideal customers.
2. **Entity memory** — known facts, signals, history, and evidence for a creator, company, location, person, or consumer segment.
3. **Campaign memory** — plan versions, targets, messages, approvals, experiments, interactions, and outcomes.

Structured records in the database are the source of truth. Chat history is context, not durable business memory.

## Guardrails

All integration actions pass through a deterministic authorization and policy layer. It validates:

- Workspace and user permissions.
- Connected integration permissions.
- Campaign and provider budgets.
- Consent, unsubscribe, and suppression state.
- Contact frequency and duplicate outreach.
- Existing customers and active opportunities.
- Geographic and channel restrictions.
- Data retention and usage rules.
- Whether the action changes external data.
- Whether a human must approve the action.

The first release should require approval before external messages, advertising spend, large paid-data requests, destructive CRM changes, or other consequential actions.

Every plan, tool call, provider response, cost, approval, mutation, and failure must be logged and traceable.

## MVP

The MVP should prove one complete outcome rather than expose every possible integration.

### First supported motion: local B2B

Initial promise:

> Describe the businesses you want to reach. MotionGrid finds the right locations, explains why they qualify, identifies the decision-makers, and prepares an approved outreach campaign.

Initial workflow:

```text
Campaign objective
    -> B2B Agent selects local mode
    -> Outscraper discovers businesses
    -> records are normalized and deduplicated
    -> websites and reviews are analyzed
    -> opportunities are scored with evidence
    -> decision-makers and contact routes are found
    -> existing relationships and suppressions are checked
    -> outreach is drafted
    -> user approves
    -> campaign is sent through a connected provider
    -> replies and outcomes are recorded
```

### MVP capabilities

1. Workspace and product context.
2. Plain-language campaign creation.
3. Automatic agent and local/online mode selection.
4. Structured campaign plan with cost estimates.
5. Outscraper local-business discovery.
6. Entity normalization and deduplication.
7. Website and review analysis.
8. Evidence-backed opportunity scoring.
9. Contact discovery and verification.
10. CRM exclusion checks and write-back.
11. Outreach drafting and approval.
12. Durable workflow execution.
13. Basic reply and outcome tracking.
14. Audit log, cost log, and failure visibility.

### Expansion order

1. Prove local B2B end to end.
2. Add Creator Motion by reusing campaign, entity, scoring, outreach, approval, and outcome infrastructure.
3. Add online discovery to Business Motion with additional company, signal, and contact providers.
4. Add B2C Motion after first-party customer data and activation integrations are available.
5. Add continuous signal monitoring and automated experiment recommendations after enough campaign outcome data exists.

## Product boundaries

MotionGrid is not:

- A collection of dozens of visible micro-agents.
- A generic chatbot with unrestricted access to external tools.
- An autonomous cold-email sender.
- A database vendor or an Outscraper wrapper.
- A consumer contact-scraping product.
- A workflow whose state exists only inside an LLM conversation.

MotionGrid is one GTM interface backed by three specialized domain agents, a vendor-neutral capability layer, controlled integrations, durable workflows, shared business memory, and human approval for consequential actions.
