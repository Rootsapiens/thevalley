# Agent file check: C:\Users\nadee\.claude\agents\*.md

Date: 2026-10-18. Checks: frontmatter has name, description, model, effort, tools; name equals file stem; body has the headings Job, Inputs, Outputs, Rules. No agent files were edited.

| File | name = stem | Frontmatter fields (5/5) | Job | Inputs | Outputs | Rules | Result |
|---|---|---|---|---|---|---|---|
| cyrex.md | yes | yes | yes | yes | yes | yes | PASS |
| razan.md | yes | yes | yes | yes | yes | yes | PASS |
| zurub.md | yes | yes | yes | yes | yes | yes | PASS |
| imad.md | yes | yes | yes | yes | yes | yes | PASS |
| firas.md | yes | yes | yes | yes | yes | yes | PASS |
| subzero.md | yes | yes | yes | yes | yes | yes | PASS |
| noor.md | yes | yes | yes | yes | yes | yes | PASS |
| rajaie.md | yes | yes | yes | yes | yes | yes | PASS |
| aktham.md | yes | yes | yes | yes | yes | yes | PASS |
| tariq.md | yes | yes | yes | yes | yes | yes | PASS |
| khaled.md | yes | yes | yes | yes | yes | yes | PASS |
| issa.md | yes | yes | yes | yes | yes | yes | PASS |

Summary: 12 of 12 pass, 0 fail. No fixes needed.

Notes:
- khaled.md line 6 (tools) is very long because it lists MCP tool IDs. Grep displayed it as omitted, but a Read confirmed the line is present and complete.
- Strict checks only. Tool-list fit against each role, and body content, were not reviewed here.
