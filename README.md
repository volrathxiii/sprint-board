# sprint-board

A Claude Code skill that keeps one private Artifact page per sprint: your sprint tickets in work order, grouped by phase. Each card shows the status, why the ticket sits there, the next step, its dependencies and its **asks** (who owes what, when you asked, and whether they answered). A "What I did today" box at the top has a Copy button.

## Install

Clone it into your project's skills folder:

```bash
git clone https://github.com/volrathxiii/sprint-board.git .claude/skills/sprint-board
```

It relies on the `jira-api` and `slack-post` skills and on the `gh` CLI, so those need to work in your setup first.

## Use

- "plan my sprint": reads your open-sprint tickets, Jira links, PRs and Slack, proposes an order, and publishes the page once you OK it
- "refresh the sprint board": updates the statuses and marks which asks were answered
- "what I did today": fills the update box

The skill only reads Jira, GitHub and Slack. A Jira change or a Slack post happens only after you approve the exact text.

## Files

| Path | What |
|---|---|
| `SKILL.md` | The skill instructions |
| `template.html` | Page layout, styles, renderer and example data |
| `scripts/check.js` | `node scripts/check.js <page.html>`: syntax check and stub render before publishing |
