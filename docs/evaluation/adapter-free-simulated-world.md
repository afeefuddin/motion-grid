# Adapter-free simulated-world evaluation

`src/evaluation/simulated-world.ts` defines a side-effect-free relevance harness for the committed simulated world. It reads `simWorld` directly; it does not import an adapter, initialize the database, send a message, or create a model client.

The harness deliberately separates two things:

- **Input sent to an evaluator:** a business's website plus every observation declared for the requested motion; or the creator snapshot persisted at discovery.
- **Private evaluation labels:** expected fit decision, score band, permitted rubric criteria, and citation/source requirements.

This separation is important: simulated-world tiers and labels are useful for judging an answer, but must never become data the evaluated model can see.

## Matrix

| Motion | Cases | Direct fixture data | Expected outcome |
| --- | ---: | --- | --- |
| `business.local` | 7 | Website HTML plus the six lowest-rated reviews | Four concrete booking/conversion-gap positives; three live-booking negative controls. Positives must cite two distinct sources. |
| `business.online` | 2 | Website HTML plus the six lowest-rated reviews | One positive requiring both a conversion gap and customer booking pain, plus one live-widget negative control. Positives must cite two distinct sources. |
| `creator` | 3 | Persisted audience, content, reach, and rate-card snapshot | One Bengaluru beauty creator within the INR 20,000 reel budget; one non-beauty and one over-budget control. |
| `consumer.ads` | 1 | None | Expected decline: no first-party customer source / warehouse. |
| `consumer.email` | 1 | None | Expected decline: no customer base or consent/lifecycle truth. |

The consumer cases are not counted as relevance passes. They document the safe expected behavior while no consented first-party simulation exists.

## How to use it

Provide an `EvaluationExecutor` whose `evaluate(input)` returns only:

- `isFit` and a 0–1 score;
- the rubric criterion IDs it claims are supported;
- for organization motions, verbatim `{ sourceRef, excerpt }` citations.

`evaluateSimulatedWorld(executor)` then checks the evaluator output against private expectations and reports:

- decision accuracy, fit precision/recall/F1;
- score-band checks;
- supported-criterion checks;
- citation grounding against direct fixture source text;
- minimum distinct source coverage; and
- the two consumer expected declines.

The module is intentionally dependency-injected. A caller may use a deterministic fixture evaluator in unit coverage or a separately authorized model evaluator, but the harness itself never makes a live call. Do not put a credential in source control or pass one through a command line.

## Pass criteria

For a model-evaluation run, gate on all of the following:

- Every case passes its decision, score, criterion, citation, and source-coverage checks.
- Documentary citation grounding is 100%.
- Fit precision and recall are each at least 0.80 on a balanced release set.
- Positive results cite at least two source types whenever the motion has both website and review observations.
- No consumer motion is reported as evaluated until a consented synthetic customer dataset supplies explicit opt-in and lifecycle ground truth.

The small committed-fixture matrix is a smoke suite. It must not be used as a generalization claim: quality tiers are correlated with business categories in the current world. For example, salon and skin-clinic records are only bad-site positives, while pet-clinic and café records are only good-site negatives. A release-grade evaluation needs a separate, balanced counterfactual set: for each category/locality pair, create both a positive and a negative artifact package while keeping the non-evidence metadata comparable.

## Known evaluation boundaries

- Creator evaluation uses the persisted profile snapshot returned at discovery. The adapter-free matrix exposes only those persisted fields, not unrelated bio, posts, collaborations, or reachability data.
- The production workflow requires persistence and adapter-backed discovery/observation. This harness tests simulated-world relevance only; it is not a substitute for a full workflow E2E test once adapters are available.
