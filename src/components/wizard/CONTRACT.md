# Wizard UI contract

Applies to every wizard-like surface: Add/Edit/Duplicate System, Scope Review,
the control assessment walk, the evaluation panel, the Finding Editor, and
anything built on `WizardUI.tsx` later. Each rule below was paid for by a real
defect in this app; the parenthetical names it where useful.

## 1. Composition

**1.1 One kit.** `WizardUI.tsx` is the only source of wizard chrome — shell,
rail, steps, fields, buttons, status pills. A step file composes primitives; it
never styles chrome in place.

**1.2 Extend the kit, don't work around it.** If a primitive can't express what
a surface needs, add the capability to the primitive. (`RailItem` had no way to
show "active and already complete", so an activated finished step lost its green
check — fixed by adding `complete`, not by hand-rolling a rail row.)

**1.3 One assessment surface.** Scoring a control happens in
`ControlEvaluationPanel` only, whether reached by row click or by the walk. Never
add a parallel scoring or applicability UI.

**1.4 One findings editor.** Creating or editing a Finding/CAP uses the shared
Finding editor only, whether opened from SystemFindings or from the evaluation
panel. Never add a parallel findings form.

**1.5 Consistency is a cross-surface invariant.** A change to shared chrome,
action vocabulary, or save behaviour lands on every wizard surface in the same
change — a rule half-applied is worse than the inconsistency it replaced. A new
surface adopts the existing patterns; it does not add a variant.

The one exception is a *recorded migration*: a change too large to land
everywhere at once may ship on one surface first if it is written up under
"Migrations in progress" below, naming the pattern, the surface that has it, and
the surfaces still to adopt it. An unrecorded half-rollout is the drift 1.5
exists to prevent; a recorded one is a queue. Nothing new may be built on the
old pattern while a migration is open.

Deleted primitives must stay deleted. `StepHeader` and `WizardBanner` are gone;
do not reintroduce them.

## 2. Naming and language

**2.1 Name a step for what the user is doing, not what the system does.** The
final Add System step is "Add System", not "Launch assessment" — nothing is
being launched and no plan exists at that moment.

**2.2 One name per surface, end to end.** The step that promises a destination,
the modal header, the readiness card, and any other page that links there all
use the same words. A step promising "Control Review" that opens something
titled "Scope Determination" is a defect.

**2.3 The primary button states the outcome.** "Create System and Continue",
not "Submit" or "Finish".

**2.4 Use a precise term only where it is precise.** "Attestation" means a
specific engagement type (SOC 2); it is not a synonym for evidence. Prefer plain
words the user already owns — report, evidence, program.

**2.5 One instruction, at the top, in the imperative.** A decision page opens by
telling the reader what to do here ("Review the out-of-scope controls for
accuracy"). Metric tiles and posture breakdowns belong on summary surfaces, not
on a page where someone is deciding something.

**2.6 Actions come from a shared vocabulary; don't mint labels per surface.**

| Act | Label |
| --- | --- |
| Advance a step | `Continue`, or `Continue to {step}` — never "Next" or "Proceed", and never "Save & Continue" for an action that only navigates |
| Commit *and* advance | Names both, with `continue` as the advance word (`Save and continue`, `Save and finish` on the last item) |
| Go back | `Back` |
| Skip a skippable step | `Skip`, `Skip for now` |
| Abandon | `Cancel`, `Close`, `Discard` (discard only where edits were staged) |
| Confirm a group | `Confirm {thing}` — one label for the act, whatever its basis |
| Final commit | Names the outcome (`Create System and Continue`, `Save changes`, `Create finding`, `Save finding`); one such label per surface, used consistently |

Varying a label to describe the *basis* of a decision splinters one action into
several ("Accept report" vs "Confirm program coverage" on the same button); the
basis belongs in the row's supporting line and the recorded note.

**2.7 Status text uses one vocabulary, defined once.** In Scope / Not In Scope /
Inherited / Assessed / Unassessed and the PRISMA level names appear in the UI
exactly as `controlMeta.ts` (or the single shared constant) spells them. A
surface that paraphrases a status invents a second vocabulary for the same fact.

The label and the engine's key are allowed to differ, and one of them does: the
bucket is `not-applicable` in facts, validators and review records, while the UI
says **Not In Scope** everywhere. That is a rename of the word, not of the
status, and it is why the definition lives in one constant — renaming a status
is never a per-surface decision. Any surface hard-coding the word instead of
reading the label has already broken this rule, whether or not it currently
agrees.

The same words in a standard's own voice are not this vocabulary: an ISO 27001
Statement of Applicability says "applicable / not applicable" because ISO does,
and the exported report keeps saying so.

**2.8 Findings vocabulary is fixed.** Finding = the gap record. CAP = the
remediation plan + owner + due + status on that finding. Remediation = residual
open posture. Do not invent parallel terms ("issue", "ticket", "deficiency
record") in chrome unless they map 1:1 to these and are used everywhere.

## 3. What to ask a human

**3.1 Never ask a person to ratify a deterministic derivation item by item.**
Confirming 74 identical derived calls produces rubber stamps with extra steps,
not review. Present the derived result; ask only where judgment actually changes
the outcome.

**3.2 Review the exceptions, not the rule.** Controls in scope need no ceremony
— assessment is their confirmation. The short list going *out* is what a person
reads and signs.

**3.3 The review unit is the unit of judgment.** Group by the claim a person can
honestly evaluate — "does this provider report cover this boundary", "does this
program reach this system" — and let the per-record fan-out be bookkeeping the
confirm writes. Never make the user the fan-out loop.

**3.4 Different questions get different sections.** External inheritance (an
outsider runs it; you can only accept their report) and internal inheritance
(you run it; the question is whether the program reaches this boundary) are not
the same question and must not share a bucket.

**3.5 Identify a group by what is claimed, never by its paperwork.** A row is
(who covers it, what is covered). Evidence is an attribute of the row; its
absence changes the claim's strength, not its identity, and is shown as a
warning — never by renaming the row.

## 4. Navigation and state

**4.1 Steps have one fixed order, declared once.** "Continue" means the next
step in that order — never "the next step that still has work", which silently
skips completed steps and contradicts the rail the user is looking at.

**4.2 Auto-advance follows the same order as the button.** Both read the same
declared list, so they cannot disagree.

**4.3 Gate a phase on every prerequisite, and say what unblocks it.** The
technical review opens only when all scope sections are settled; until then its
rail entry reads "After scope review", not a bare disabled row.

**4.4 Done stays done.** Selecting a completed step must not make it look
unfinished. Completion and focus are independent states.

**4.5 Re-opening resumes.** A wizard re-opened lands on the earliest section
still holding work, never back at step one.

**4.6 Counts agree across surfaces.** If the rail counts claims, the button
counting the same thing counts claims — never controls.

A rail's subtext is not one of those counts. It states how big the step is —
its population, in controls, the same unit on every row — so four rail entries
can be compared at a glance. Progress is carried by the row's own done/active
state, the header's counter and the footer, and each of those stays in the unit
of the act it describes. What 4.6 forbids is an action and its own count
disagreeing, not a population and a progress reading sitting in one rail.

**4.7 One footer pattern.** Every surface closes with the pinned `WizardFooter`:
status on the left — what is unsaved on a staged surface, where you are on one
whose header does not already say (4.11) — actions on the right, exactly one
primary action and it is last. The action cluster is `WizardFooter`'s own named
slots, rendered in one fixed order — `close`, `back`, `skip`, `discard`,
`primary` — so abandoning sits furthest from the action that commits and Discard
sits beside it (5.7). The slots are not children: passing free children is a
type error, because when it was allowed two surfaces drifted to a trailing
`Close` after the primary. A blocked primary states its reason in the footer's
hint; never a silently disabled button.

**4.8 The primary action lives in the footer, nowhere else.** Not in the header,
not mid-page. Row-level buttons act on their row; they never double as the
step's primary action. Offer Skip only on a step that is genuinely skippable.

Exception for *immediate* surfaces (5.6): when the work *is* the row/group
confirmations, those controls may use the primary visual weight because they are
the act, and the footer's Continue appears only once the step is settled so the
two never compete on screen. They must all share one visual treatment; none are
`danger` for routine scope decisions backed by reason and reviewer.

**4.9 One progress indicator, always visible.** A surface shows its position
through the shared rail or `ProgressBar` — always present, never swapped for a
bespoke indicator on one step or hidden once work begins. A terminal completion
screen is the one exception: the run is over, so the footer's position slot
carries the final count and the rail stands down.

A rail may be *summarised* by a flush `ProgressBar` on the masthead's bottom
edge. That is the one permitted pairing, and it holds only because the bar reads
as the block's underline rather than as a control of its own: both read the same
declared step order (4.1), so they cannot disagree. Anything that would need its
own row is a second indicator and is not allowed.

A walk that works one item at a time has two things it could count — the steps
inside the item in hand, and the items across the whole run. It counts the one
its header is titled after (4.11), once. Two readings of the same run, one band
apart, is forbidden.

**4.10 One chrome stack, in one order.** Every wizard screen — including
completion screens and the holds between items — is a masthead, optionally one
`WizardStrip`, then the body, then `WizardFooter`. A screen that drops the
masthead for a floating close button, or centres its content in a div of its
own, is not a different kind of screen; it is the same wizard mid-flow and
reads as one.

There is one masthead form only: the **unified masthead**.

- One `WizardHeader`, split on the body's own column line (`WIZARD_COLS`,
  declared once beside `WizardBody`, never restated in a caller).
- Left cell: `WizardRailSummary` over the rail — the flow's mark and name.
- Right cell: the step (or subject) in hand, flush with the pane.
- Run position rides the bottom edge as a flush `ProgressBar` when the surface
  has a multi-step run.
- One block, one background, no banner above it.

Rail-less surfaces (single form, no steps) omit the left cell. The flow name
rides the header eyebrow instead. Do not invent a rail or a fake "1 of 1" count
to force symmetry.

**4.11 The left cell names the flow; the right cell owns whatever changes.**
The rail summary answers "which wizard is this" over the column that lists the
run, and stops there. The header beside it, over the column that holds the work,
carries the position (`Step 3 of 8 · 38%`) in its eyebrow and then the thing the
reader has to keep track of. Which thing that is depends on the wizard:

- **The subject is constant** — one system, one scope. The header titles the
  *step*, and its supporting line is the one instruction for the work in that
  pane. Add System and Scope Review.
- **The subject changes mid-run** — one control, then the next. The header
  titles the *subject*, its supporting line places that subject
  (`CFG-02 · Configuration Management`), and the step name folds into the
  eyebrow beside the position: `Control 12 of 42 · 29% · Control Scoring`.
  The control assessment walk and the evaluation panel.
- **Single-record editor, no run** — Finding Editor, or evaluation panel opened
  on one control from a row click. Eyebrow states the flow name (and optional
  record id); title states the act or record (`New finding`, control name). No
  invented "1 of 1".

The test is which fact goes stale while the reader looks away. Pinned chrome is
the only place that can promise never to scroll, and it must spend that promise
on the thing that changes.

Position reads with the step it counts, not across a column boundary from it —
and the title stays the only title-scale thing on a wizard screen.

The position word names what is being counted, and the counter counts whatever
the header is titled after. Where the header titles a step that word is
**Step** — "Step 2 of 3 · 67%" — on every such wizard. Where the header titles a
subject, it is the subject's own word: "Control 12 of 42". A counter that counts
one thing while the title names another leaves the reader deciding which of the
two the percentage belongs to.

A step is titled with the same words its rail entry uses and the engine defines
(2.2, 2.7), and its supporting line is the one imperative instruction for the
work in that pane (2.5). That instruction is chrome.

A terminal completion screen is not a step (4.9): the summary, the eyebrow and
the bar all read complete, rather than reporting whichever rail entry the
screen happens to render on.

A step's header takes no icon square. The square anchors a header whose subject
is a specific record — a control, a finding — and a step is already named by
the eyebrow directly above it.

**4.12 Reference prose is a Section like any other.** What a control asks, what
a finding claims — the text a step keeps in view because every step is answering
it — is an ordinary `Section` with a `clamp`, not a card of its own design. The
control it belongs to is named in the header above (4.11), so the block has no
identity to carry and no reason to look different from the work beside it.
`clamp` measures rather than assumes: a body that fits renders in full with no
disclosure at all, and only one that overruns clamps, fades and gains a toggle.

Status is not identity either. The pills saying how a control is graded, who
runs it and what it scores belong to the step that is about those facts, not
beside its name.

**4.13 Step identity is chrome, not body.** The step title and its position stay
pinned in the header; they do not scroll. A heading rendered as the first thing
inside the scrolling pane leaves the reader, two fields down, with no answer to
"which step is this" — and it pushes the fields themselves below the fold on
arrival. The kit offers no in-pane step heading; a step body starts with its
first `Section`.

## 5. Writes and saving

**5.1 Every decision is signed.** Reviewer of record plus date on the record
itself, not just on screen.

**5.2 A batch writes the same records as one-at-a-time.** Confirming a group
produces exactly the records the individual action would, carrying the derived
reason as the note, in one commit. The audit trail must not reveal which button
was used.

**5.3 The note states the basis, including a weak one.** "Accepted AWS SOC 2
Type II…" and "…no report on file" are both legitimate records; hiding the
second is not.

One rationale may sign every record a single act writes. Grading a control
writes the assessment and one override per lane moved off its derived rating —
that is one decision, not several. Ask once, write it to all of them. A second
box is only earned when it asks a genuinely different question.

**5.4 Dry-run, then commit.** Mutate a `RuntimeFacts` copy through the helpers
in `engine/runtimeMutations.ts` — never hand-assemble fact records in a
component — validate with `buildLiveEngine`, and persist only on a clean
result. Validator problems are shown in the UI and block the commit; never
write past them.

**5.5 An override never loses to the derivation it overrides.** A human's
explicit call wins over a rule match in both directions, and stays visible as an
override.

**5.6 Two save models, and the choice is not a matter of taste.**

- *Immediate* — the act is a single click carrying its own complete meaning, and
  is reversible by the opposite click. It commits on press; there is no Save
  button, no Discard, and no unsaved state. (Scope Review's confirmations.)
- *Staged* — the act is assembled from several fields, or spans several steps,
  so it is incomplete until the user says it is done. Edits accumulate in a
  `RuntimeFacts` draft and commit on one explicit action. (Add System; the
  evaluation panel's evidence, grade, and findings; Finding Editor.)

Pick by asking whether a half-finished version of the act is meaningful. Never
mix the models inside one surface. In a staged surface, intermediate steps hold
local state only — nothing reaches the runtime before the single committing
action.

**5.7 A staged surface says what is unsaved; an immediate one offers nothing to
save.** Staged surfaces report pending changes in the footer's status slot and
provide Discard beside the primary. Immediate surfaces must not display a Save
control, which would imply work is being held that isn't.

**5.8 A signature is taken, never typed.** Every record names the signed-in user
(`src/auth`) — assessor, reviewer, creator, whoever completed the step. A surface
must not offer a box to type it in: a name a person can edit is not a signature,
and every such box was also a fake gate, disabling Save until *something* was
entered rather than until the right person was there. Facts *about* a person that
are not the signature — who collected evidence at source, who is assigned as
assessor of record — stay fields, and pick from a known list rather than free
text.

**5.9 A refused write is hidden or explained, never merely greyed.** Permission
comes from `src/auth/gates.ts` and nowhere else; a surface never decides policy
locally. How the refusal reads depends on which kind it is:

- **The role can never do this** — hide the control. An auditor facing forty
  greyed-out Assess buttons learns nothing from thirty-nine of them.
- **The role could, but this record stops you** — render it, disable it, and
  state the reason. Separation of duties is the case this exists for: an
  assessor who owns the system expects to grade it, so the refusal is the
  informative part. The reason belongs in the footer's hint (4.7), and on a
  surface with a form to fill in, also at the top of the pane — being refused
  *after* filling one in is the failure this prevents.

On a staged surface (5.6) the gate belongs on the one committing action, since
that is the only thing that persists; it does not need repeating on each of the
twenty controls that stage into the draft.

## 6. Motion and validation

**6.1 One motion vocabulary, or none.** Enter/exit transitions are shared across
surfaces or absent entirely. A single wizard animating its own way is worse than
a wizard that doesn't animate.

**6.2 A step change never remounts the shell.** Only the step body swaps —
chrome, rail, and footer persist, so focus, scroll position, and staged state
survive navigation.

**6.3 Errors appear twice: at the field and at the top.** Field-level problems
render on their `Field`; anything blocking the step also appears as a summary
`Callout` / `SaveErrorCallout` above the body, so a reader never has to hunt for
what is wrong.

**6.4 Failing validation blocks the primary and says why.** Required fields
gate the committing action, with the reason in the footer hint (4.7).

## Auditing a surface

Walk these and each must match every other wizard:

1. Footer pattern (4.7–4.9)
2. Action labels (2.3, 2.6)
3. Save model and its signalling (5.6, 5.7)
4. Step order and hand-offs (4.1–4.2)
5. Terminology (2.2, 2.4, 2.7, 2.8)
6. Error handling (6.3–6.4)
7. Masthead form (4.10–4.13) — unified only; no banner

A deviation is either a defect to fix or a rule to amend here — never an
undocumented local exception.

### Migrations in progress

None open. The unified masthead (4.10–4.13) has landed on every wizard surface.
`StepHeader` and `WizardBanner` are deleted and must not return.

### Known open deviations

- **Add System has no `discard` slot; `Cancel` serves both roles.** Its staged
  draft is coextensive with the modal — there is no "throw the edits away but
  stay here" state to offer, the way the evaluation panel has one. If the
  wizard ever gains a resumable draft, it gains a real Discard.
- **"System Control Editor" is not named "… Wizard".** It is the direct-edit
  mode of the evaluation panel — one control, reached by a row click, with no
  run to walk. The same component in walk mode is the Control Assessment
  Wizard.
- **The evaluation panel's inline Finding editors repeat the panel's own
  blocker.** 5.9 says a staged surface gates its one committing action, and the
  panel does; the editors also carry it so a form nested inside a blocked panel
  never looks savable. Belt and braces, not a second policy.
- **Scope Review paints its decision controls with primary visual weight** while
  4.8 places the primary in the footer. Accepted under the immediate-surface
  exception in 4.8: those buttons *are* the work; footer's Continue appears only
  once the step is settled. All decision controls share one treatment; none use
  `danger` for routine out-of-scope calls backed by reason and reviewer.