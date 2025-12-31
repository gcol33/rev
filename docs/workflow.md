# Complete Workflow Guide

The Word ↔ Markdown round-trip workflow for academic papers.

## The Big Picture

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Word Doc ──────► Markdown ──────► Word/PDF                    │
│      │               │                 │                        │
│      │          (you work here)        │                        │
│      │               │                 ▼                        │
│      │               │            Send to reviewers             │
│      │               │                 │                        │
│      │               │                 ▼                        │
│      │               │            Receive feedback              │
│      └───────────────┴─────────────────┘                        │
│                      │                                          │
│                   (repeat)                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key insight:** You always work in Markdown. Word is just for delivery and collecting feedback.

---

## Phase 1: Start Your Project

### Option A: Import from existing Word doc

```bash
rev import manuscript.docx
```

This creates:
```
my-paper/
├── rev.yaml           # Project config
├── introduction.md    # Section files (auto-detected)
├── methods.md
├── results.md
├── discussion.md
├── references.bib     # If citations found
└── figures/           # Extracted images
```

### Option B: Start fresh

```bash
rev new my-paper
cd my-paper
```

Edit the generated section files.

---

## Phase 2: Work in Markdown

Edit your section files using any text editor. The Markdown supports:

**Citations:**
```markdown
Previous studies [@Smith2020; @Jones2021] have shown...
```

**Figures with cross-refs:**
```markdown
![Caption text](figures/heatmap.png){#fig:heatmap}

See @fig:heatmap for the results.
```

**Equations:**
```markdown
The model is defined as $y = mx + b$ where...

$$
\hat{p} = \frac{\sum_d w_d p_d}{\sum_d w_d}
$$
```

---

## Phase 3: Build & Deliver

### Build for collaborators

```bash
rev build docx           # Standard Word doc
rev build --dual         # Clean + comments versions
rev build pdf            # PDF for submission
```

**Dual output creates:**
- `paper.docx` - Clean document for reading
- `paper_comments.docx` - With threaded Word comments for discussion

### Preview while writing

```bash
rev preview docx         # Build and open
rev watch docx           # Auto-rebuild on save
```

---

## Phase 4: Receive Reviewer Feedback

When reviewers return a Word doc with track changes and comments:

### Import to section files

```bash
rev sections reviewed.docx
```

This:
- Extracts track changes → CriticMarkup annotations
- Extracts comments with author names
- Converts equations (OMML → LaTeX)
- Extracts images to `media/`

### Review track changes

Interactive TUI:
```bash
rev review methods.md
```

Controls: `a` accept, `r` reject, `s` skip, `q` quit

### See all comments

```bash
rev comments methods.md
```

Output:
```
#1 [Guy Colling] line 45
   "explain what you mean here"
   Context: ...This classification obscured substantial heterogeneity...

#2 [Guy Colling] line 67
   "add citation needed"
```

---

## Phase 5: Reply to Comments

### Set your name (once)

```bash
rev config user "Your Name"
```

### Reply to specific comment

```bash
rev reply methods.md -n 1 -m "Clarified in revised text."
```

### Interactive replies

```bash
rev reply methods.md
```

**Result in markdown:**
```markdown
{>>Guy Colling: explain what you mean here<<} {>>Your Name: Clarified in revised text.<<}
```

---

## Phase 6: Rebuild & Send Back

### Rebuild with threaded comments

```bash
rev build --dual
```

The `paper_comments.docx` will have your replies threaded under the original comments - just like a conversation in Word.

### Generate response letter

```bash
rev response > response-to-reviewers.md
```

Creates a point-by-point response document.

---

## Phase 7: Repeat

The cycle continues:
1. Receive more feedback → `rev sections reviewed_v2.docx`
2. Review and reply
3. Rebuild → `rev build --dual`
4. Send back

**Your markdown files remain the source of truth.** Word is just the exchange format.

---

## Quick Reference

| Task | Command |
|------|---------|
| Start from Word | `rev import manuscript.docx` |
| Start fresh | `rev new my-paper` |
| Build Word | `rev build docx` |
| Build with comments | `rev build --dual` |
| Build PDF | `rev build pdf` |
| Import feedback | `rev sections reviewed.docx` |
| Review changes | `rev review methods.md` |
| See comments | `rev comments methods.md` |
| Reply to comment | `rev reply methods.md -n 1 -m "..."` |
| Response letter | `rev response` |
| Pre-submit check | `rev check` |

---

## Tips

### Backup before major changes
```bash
rev backup --name "before-revision-2"
```

### Validate before submission
```bash
rev check                    # Full check
rev doi check               # Validate DOIs
rev validate -j nature      # Journal requirements
```

### Export comments for tracking
```bash
rev comments methods.md --export comments.csv
```
