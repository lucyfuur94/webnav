# Attention-Return Economics — Thesis & Design Note

**Date:** 2026-05-31
**Status:** Thesis (not yet built). Layers onto the future "sanctioned-doors" layer
(see the internet-graph spec). Captured so the economic model is settled before code.

> **The question that started this:** in the agent-web, why must an agent pay to
> visit a site a human visits free? And — what if the agent could bring the
> *attention* back, so the site no longer needs to charge?

## 1. Why the free web charges agents (the problem)

The "free" web was never free — it was a **barter: content for human attention.**
The human pays in eyeballs (ads), brand affinity, data, and purchase potential. The
page is bait; the human's attention is the catch.

An **agent breaks the barter**: it extracts the content (the expensive part) but pays
no attention (the part that funded the content) — no ad impressions that matter, no
brand loyalty, no retargeting — and can do so at machine scale on the site's servers.
So sites respond by **walling agents** (crude) or **charging them** (APIs, per-call
fees, agent tolls — the emerging model). The toll is the site re-pricing a visitor who
consumes value but carries no attention-currency.

## 2. The thesis: make agents attention-ALIVE, honestly

If the agent **returns qualified attention** to the user on the site's behalf — reads
the page's offers, remembers them, and (transparently, with consent) surfaces the
right one at a genuine intent moment later — the barter is restored. And it can be
*better than the human web*: a human ignores 99% of ads (wasted impressions); an agent
that knows the user's context can surface the *one relevant offer at the moment of real
intent* — **intent-qualified attention, which advertisers value far more than raw
impressions.**

If agents demonstrably return monetizable attention, the site's incentive flips from
"wall/toll the agent" to "welcome the agent that pays me in attention." **The toll
isn't inevitable; it's a response to agents being attention-dead.**

## 3. The trust problem, and the solve (verify the conversion, not the impression)

The site can't *see* the agent fulfilling the attention (it happens privately between
agent and user). So how does it trust it happened?

**Solve — Option A (the realistic one): verify the OUTCOME, not the impression.** The
agent doesn't prove it "showed the ad." When it surfaces a remembered offer and the
user acts, it routes that action through an **attributable link / referral token the
site issued.** The site sees a conversion arrive tagged "via agent X" — the exact
attribution it *already* trusts for affiliates. No new trust primitive required; it
piggybacks on existing affiliate/referral rails, and conversions (unlike impressions)
aren't gameable.

This reframes the model precisely: not a vague "attention barter" but **a performance/
affiliate model where the agent is an unusually high-quality referrer** — it surfaces
the offer only at genuine intent, so its referrals convert far better than a banner.
(Crypto-signed delivery receipts (Option B) and privacy-preserving aggregate signals
(Option C) exist for brand/awareness goals with no click, but A is the one that works
today.)

## 4. The incentive problem, and the solve (decouple pay from the recommendation)

The adware failure mode: if the agent earns per-conversion on offers it controls, it
has a standing incentive to **nudge** — and becomes an ad channel wearing an
assistant's clothes. The solve is structural — **break the link between the agent's
pay and any individual recommendation:**

1. **The agent is funded by, and accountable to, its PRINCIPAL** — and the principal
   must have a genuine stake in the beneficiary being well-served.
2. **Attention revenue is POOLED and decoupled, not per-recommendation.** Attribution
   flows to a pool that offsets cost *in aggregate, blind to which specific offer
   converted.* The agent can't increase its take by pushing offer Y over Z — it's
   indifferent to *which* offer, caring only *that the user is well-served* (so they
   keep using it).
3. **The beneficiary is the auditor.** Every surfaced offer is labeled, logged,
   reviewable, and per-category opt-out. A nudgy agent loses its users — and since the
   principal's livelihood depends on retention, restraint is self-enforcing.

Under this structure, **user-first and attention-return stop being in tension**:
returning attention is just "served the user well at a moment that also happened to
convert," and the agent has no lever to abuse because its money isn't per-recommendation.

## 5. Who is the PRINCIPAL? (generalized — both deployment shapes)

The agent calling webnav may be the **end-user's own agent** (user pays, user is
principal) OR a **company's agent acting on behalf of its users** (company pays,
company is principal, users are beneficiaries) — e.g. a travel site's assistant, a
bank's concierge, a SaaS embedding webnav.

The alignment rule is **principal-agnostic**:

> The agent must be funded by, and accountable to, a principal who has a **genuine
> stake in the beneficiary being well-served**. The end-user's interest is protected
> by transparency + the operator's retention incentive (+ eventually regulation).

- **User's own agent:** principal = user; alignment via user payment + user can drop it.
- **Company-on-behalf-of-users:** principal = company; alignment via the company's
  user-retention / competitive pressure (a concierge that pushes bad options for
  commission loses customers to a rival). Market discipline moves up a level.
- **Failure mode (the line):** a payer whose interest is *opposed* to the beneficiary's
  (e.g. agent funded purely by advertisers with no retention stake) → adware. Not built.

Company-scale deployment actually **strengthens** the model: attention/conversions
aggregate into real volume sites will negotiate B2B terms for, and pooled attribution
becomes a business agreement rather than per-individual micro-settlement.

## 6. webnav's role: the honest, principal-AGNOSTIC substrate

webnav does NOT become an ad-broker, payment rail, or the thing that decides to show
you an offer. It stays the judgment-free map (#5a). Its only NEW responsibilities,
layered onto the doors model:

1. **Record offers as evidence** — "on this site I saw these offers," labeled, in the
   evidence bundle (offers are just more declared content to extract).
2. **Carry per-node access/attention TERMS** in the doors/graph layer:
   `open | api-key | cash | attention-loop` — *this node welcomes agents that
   participate in attribution.* Routing prefers the cheapest sanctioned door.
3. **Emit attribution tokens on CONSENTED actions** — when the calling agent (with the
   beneficiary's consent) acts on an offer, navigate via the site's referral token
   (Option-A verification — just "navigate to a tagged URL," which webnav already does).

What webnav must NEVER do: decide to surface an offer (the calling agent + its
principal's settings do that), manufacture access the principal doesn't have, or evade
a wall/toll. The fiduciary/transparency logic lives in the calling agent and its
operator — exactly where #5a puts all judgment.

## 7. Would you still need to pay? (the honest answer)

Not necessarily — the toll can become a **currency, not a fee**:
- **Attention-for-access:** agents that return verified, qualified attention → site
  drops the toll. The original web deal, restored and arguably improved.
- **Hybrid:** participating agents pay less/nothing; pure extractors pay the toll. The
  toll becomes the *default for non-participating agents*, waived for participating ones.
- **Cash anyway** for sites whose model isn't ad-based (paywalled journalism, SaaS) —
  there, money is cleaner than attention.

So: for ad-supported sites, the toll's justification largely dissolves once agents are
made honestly attention-alive. For others, the doors layer still routes to the cheapest
sanctioned door (which may be a paid API).

## 8. Hard problems still open (not hand-waved)

- **Attribution plumbing** beyond affiliate links (who pays whom, revenue share, the
  pool mechanics) — needs a settlement layer; affiliate rails are the bootstrap.
- **Standardizing "attention-terms"** so sites can declare them (an `llms.txt`-like
  field) — doesn't exist yet.
- **Verifying the pool stays decoupled** (that an operator doesn't quietly re-link pay
  to recommendations) — needs auditability, maybe third-party.
- **Regulatory** treatment of agent-mediated advertising / disclosure — nascent.

## 9. Relationship to the build

This depends on the **sanctioned-doors layer** (per-node access terms on the graph),
which is the agreed next architectural increment. The attention-return model extends
that layer's terms vocabulary (`+ attention-loop`) and adds webnav's three honest
responsibilities (§6). It is NOT a near-term coding task — it's the economic north-star
that the doors layer should be designed to *not preclude*. Build doors first; keep the
attention-terms field in the schema from the start so this can land later without rework.
