---
name: sprint-board
description: Use when a sprint starts and the user wants their sprint tickets planned (order, dependencies, asks), or when asked to refresh, update or check the sprint board / sprint artifact / sprint status page, to mark which asks were answered, or for "what I did today" on it. Trigger on "plan my sprint", "plan my tickets for this sprint", "refresh the sprint board", "update the artifact with the latest", "check Slack for updates on my tickets", "did they answer my asks", "status update for today".
---

# Sprint board

One private Artifact per sprint: the user's sprint tickets as cards in work order, grouped by phase, each card with status, why it sits there, next step, dependencies and **asks** (who owes what, asked when, answered or not). On top sits "What I did · <day>" with a Copy button. The page is built from `template.html`; only its two data blocks change between refreshes.

Jira goes through `jira-api` only. Slack and GitHub are read-only here: a Jira change (points, links, status) or a Slack post happens only after the user approves the exact text (`jira-api`, `slack-post`). No student, family or customer PII on the page (district names are fine).

## Files

| Path | What |
|---|---|
| `.claude/skills/sprint-board/template.html` | Page layout, styles, renderer, example data |
| `.claude/skills/sprint-board/scripts/check.js` | `node .claude/skills/sprint-board/scripts/check.js <page.html>`: syntax check + stub render; prints counts and the update text |
| `.claude/sprint-board/<sprint-slug>/page.html` | This sprint's page (durable; never keep it only in the scratchpad) |
| `.claude/sprint-board/<sprint-slug>/state.json` | `sprint`, `artifact_url`, `page`, `last_refresh` (ISO with offset), `user_tz`, `asks[]` (see below) |

Find the current board: newest `state.json` whose `sprint` matches the open sprint (Jira `sprint in openSprints()`, field `customfield_10020`).

## Data contract (between `DATA:START` / `DATA:END`)

`SPRINT`, `OWNER`, `ASOF`, `FOOTER`, then `phases[]`: `{id, name, note, blocked?, tickets[]}`. A ticket:

| Field | Meaning |
|---|---|
| `n`, `key`, `title`, `status`, `pts`, `sug?` | Order number, Jira key, plain-language title, exact Jira status, Story Points (`customfield_10058`), suggested points not yet applied |
| `due?` | A committed date (red pill) |
| `upd?` | What changed at the last refresh, with links (`PR(repo,n)`, `T(key)`) |
| `why`, `next` | Why it sits here; the very next step |
| `deps[]` | `[kind, tag, text]`, kind = `block` (can't start), `wait` (someone else), `inside` (another sprint ticket), `none` (nothing blocking) |
| `asks[]` | `{who, what, asked, hard?, src?, ans?}` or `[who, what, asked, hard, ans]`. `asked` = date asked or `""` (shows "not asked yet"); `who:"Me"` = the user's own to-do; `hard` = blocks the ticket; `src` = permalink where it was asked; `ans` = `"<date>: <one-line answer>"` (shows green "answered") |

Statuses the renderer knows are in `STATUS` (outside the data block). A new Jira status: add it there with a class and a `prog` (`done`, `close`, `review`, `doing`, `todo`).

`DID:START` / `DID:END` holds `DID_DAY` and `DID = [[heading, [items]]]` with headings "My sprint tickets", "Reviews for the team", "Other".

`state.json` `asks[]` mirrors every ask that has been sent: `{key, who, slack_id?, asked_at (ISO), src: {kind: "slack"|"jira"|"pr", channel?, thread_ts?, ts?, comment_id?, repo?, pr?}, ans?}`. This is how a refresh finds the reply.

## Mode 1: plan a new sprint

1. **Tickets.** JQL `assignee = currentUser() AND sprint in openSprints()`; for each, `node .claude/skills/jira-api/scripts/fetch-ticket.ts TAP-XXXX` (description, comments, links, linked PRs).
2. **Dependencies.** For each ticket, from the real sources, not guesses:
   - Jira links (`issuelinks`: blocks / is blocked by / relates) and other keys named in the description and comments; fetch each one's status, assignee and sprint.
   - The same code or flow as another sprint ticket (they go back to back, and merge order matters).
   - People: PO decisions still open, a reviewer outside the team, SRE or production runs, QA on UAT.
   - Specs and plans on `ezat-specs` draft PRs (`gh search prs --repo TransActComm/ezat-specs TAP-XXXX`).
   Mark inference as inference on the card ("I haven't checked the code yet").
3. **Points.** Check each estimate against `refine-ticket`'s estimation drivers and floors; put a differing number in `sug`. Change Jira only after the user approves.
4. **Order into phases.** In-flight and approved work first, then dated commitments, then clusters that share code (back to back, one local stack), then big work waiting on spec approval, and last a "Blocked · Propose moving out" phase (`blocked:true`). Each card's `why` says why it sits there.
5. **Asks.** Every open question or approval becomes an ask on its card. Search Slack (`from:me` + the key) and Jira comments to fill `asked` and `src`; an ask that wasn't sent is `asked:""`. Offer drafts for the unsent ones through `slack-post` (draft first, real mentions).
6. Show the order and the reasons in chat and get the user's OK. Then copy `template.html` to `.claude/sprint-board/<sprint-slug>/page.html`, change the `<title>` to `<Sprint name> Plan`, fill both data blocks, run `check.js`, and publish as a new artifact (the Artifact tool's new-page rules apply). Write `state.json` with the returned URL.

## Mode 2: refresh

Window = `last_refresh` to now. Gather all three sources in parallel:

1. **Jira:** status and points for every sprint ticket (the JQL above, so tickets added to or removed from the sprint show up); changelog and comments in the window (skip `description`, `Rank` and `Attachment` diffs, which are huge).
2. **GitHub:** every PR on a card (`gh pr view N -R TransActComm/<repo> --json state,isDraft,reviewDecision,mergedAt,reviews,statusCheckRollup`), plus new PRs by the user (`gh search prs --author @me --created ">=<window start>"`).
3. **Slack:** for each open ask with a Slack `src`, `slack_read_thread` on its thread and look for replies after `asked_at`; then `slack_search_public_and_private` for each ticket key `after:<window start - 1 day>`, and `from:me` in the window (to catch asks the user sent).

An ask with `asked` set but no `src` in `state.json`: find where it was sent (`from:me` + the key, or the person's name) and store the `src` before checking it.

**Is an ask answered?** It is answered when the person asked (or someone answering for them) replied in the ask's thread or Jira comments after `asked_at`, approved the PR, or made the change requested (a status move, a link, a merged PR). Set `ans` to `"<date>: <what they said, one line>"` and keep the ask on the card, so the user sees it answered. If the reply leaves something open, keep the ask open and add the follow-up as a new ask. Not sure? Leave it open and name it in the report.

Then update the cards: `status`, `pts`, `upd` (only what's new), `next`, `deps`, `asks`. Move a ticket to another phase only when a dependency or a date changed, and say so in the report. Remove nothing the user added by hand without asking. Update `ASOF`, `FOOTER`, `state.json` (`last_refresh`, `asks[]`), run `check.js`, and republish to the same URL (same file path in this conversation; otherwise pass `url` after an Artifact `read`).

**Report:** what changed per ticket, the asks answered (who, what they said), the asks still open, and the asks not sent yet. Offer the drafts; post nothing.

## Mode 3: what I did today

"Today" is the user's own day in `user_tz`. List their own activity in that window: Jira status and points changes and comments by them, PRs they opened, merged or reviewed (`gh pr view … --json reviews`, filter `author.login` = the user and `submittedAt` in the window), and their Slack posts (`from:me`). Group as "My sprint tickets" (one line per ticket: what moved), "Reviews for the team" (ticket, author, PRs, verdict), "Other". Replace the DID block, set `DID_DAY`, run `check.js`, republish. Ask the user to check the list before they send it.

## Gotchas

- Jira returns times at `-0600`; compare windows in UTC or the same offset, or a filter silently matches nothing.
- Save `curl` output to a file and run `jq` on the file. zsh `echo "$R"` expands `\n` inside JSON and breaks `jq`.
- `gh pr view --jq` takes no `--arg`; build the filter string in the shell.
- Slack search shows the user's local time labelled "CST"; the `ts` is the truth.
- A Python `re.sub` replacement turns `\n` into a real newline, which breaks a JS string. Use a function replacement (`lambda m: text`) when you put JS into the page.
- After any edit, run `check.js` before publishing. A broken data block renders a blank page.
