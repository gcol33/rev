# docrev

[![npm](https://img.shields.io/npm/v/docrev)](https://www.npmjs.com/package/docrev)

**Write your papers in plain text. Generate Word documents when you need them.**

## The Problem

You're writing a scientific paper. Your supervisor reviews it in Word, adding comments and track changes. You address the feedback, send it back. Another round of reviews. Then journal submission. Then reviewer comments. More Word documents flying back and forth.

Sound familiar?

- Word files get corrupted
- "Which version is the latest?" confusion
- Track changes become unreadable after multiple rounds
- Equations break when copy-pasting
- Figures get embedded at wrong resolutions
- Collaborating means emailing files back and forth

## The Solution

**docrev** lets you write in plain text (Markdown) and generate Word/PDF whenever you need to share. Your collaborators keep using Word — they don't need to change anything. You get:

- **Version control** — See exactly what changed, when, and why
- **No corruption** — Plain text files never break
- **Equations that work** — Write LaTeX, get perfect equations in Word
- **Figures stay separate** — Reference images, don't embed them
- **Automated formatting** — Citations, cross-references, all handled

## How It Works

```
Your text files  ───►  docrev  ───►  Word/PDF for collaborators
      │                                      │
      │                                      ▼
      │                              They add comments
      │                                      │
      │                                      ▼
      └──────────────  docrev  ◄────  They send it back
                    (imports their feedback)
```

You always work in plain text. Word is just the delivery format.

---

## Quick Start

### Install

```bash
npm install -g docrev
brew install pandoc    # Required for Word/PDF generation
```

### Start a New Paper

```bash
rev new my-paper
cd my-paper
```

This creates:
```
my-paper/
├── introduction.md    ← Write your intro here
├── methods.md         ← Your methods
├── results.md         ← Your results
├── discussion.md      ← Your discussion
├── references.bib     ← Your citations
└── rev.yaml           ← Paper title, authors
```

### Or Import from Existing Word Document

```bash
rev import my-manuscript.docx
```

docrev extracts:
- Text → Markdown files
- Comments → Preserved with author names
- Equations → Converted to LaTeX
- Images → Saved to figures/

---

## Writing in Markdown

Markdown is just text with simple formatting. If you can write an email, you can write Markdown.

### Basic Formatting

```markdown
# This is a Heading

This is a paragraph. **Bold text** and *italic text*.

- Bullet point
- Another bullet

1. Numbered list
2. Second item
```

### Citations

In your `.bib` file:
```bibtex
@article{Smith2020,
  author = {Smith, Jane},
  title = {My Paper Title},
  journal = {Nature},
  year = {2020}
}
```

In your text:
```markdown
Previous studies have shown this effect [@Smith2020].
Multiple citations work too [@Smith2020; @Jones2021].
```

→ Becomes: "Previous studies have shown this effect (Smith 2020)."

### Equations

Inline: `$E = mc^2$` → E = mc²

Display equation:
```markdown
$$
\hat{p} = \frac{\sum_d w_d p_d}{\sum_d w_d}
$$
```

### Figures

```markdown
![Map of study sites across Europe](figures/map.png){#fig:map}

As shown in @fig:map, our study sites span 12 countries.
```

→ In Word: "As shown in Figure 1, our study sites..."

The figure number updates automatically if you reorder figures.

---

## Build Your Document

```bash
rev build docx    # Generate Word document
rev build pdf     # Generate PDF
rev build --dual  # Both clean + with-comments versions
```

### Preview While Writing

```bash
rev watch docx    # Auto-rebuilds when you save
```

---

## Handle Reviewer Feedback

### 1. Receive Reviewed Document

Your supervisor sends back `manuscript_reviewed.docx` with comments and track changes.

```bash
rev sections manuscript_reviewed.docx
```

This imports their changes into your Markdown files.

### 2. See Their Comments

```bash
rev comments methods.md
```

Output:
```
#1 [Dr. Smith] line 45
   "Please clarify the sampling methodology"

#2 [Dr. Smith] line 78
   "Add a citation here"
```

### 3. Reply to Comments

```bash
rev config user "Your Name"    # Set your name (once)
rev reply methods.md -n 1 -m "Added detail about random sampling in paragraph 2"
```

### 4. Rebuild and Send Back

```bash
rev build --dual
```

Creates:
- `paper.docx` — Clean version
- `paper_comments.docx` — With threaded comment conversations

Your reply appears under their comment, just like a conversation in Word.

---

## Why Separate Files?

Instead of one giant document, docrev uses separate files for each section:

| File | Content |
|------|---------|
| `introduction.md` | Background, aims, hypotheses |
| `methods.md` | Study design, analysis |
| `results.md` | Findings |
| `discussion.md` | Interpretation |

**Benefits:**
- Easier to navigate
- Work on one section without scrolling
- Git shows changes per section
- Collaborators can review specific parts

---

## Commands Reference

| What you want to do | Command |
|---------------------|---------|
| Create new paper | `rev new my-paper` |
| Import from Word | `rev import manuscript.docx` |
| Build Word doc | `rev build docx` |
| Build PDF | `rev build pdf` |
| Import reviewer feedback | `rev sections reviewed.docx` |
| See all comments | `rev comments methods.md` |
| Reply to comment #1 | `rev reply methods.md -n 1 -m "Fixed"` |
| Check word count | `rev word-count` |
| Validate DOIs | `rev doi check` |
| Check before submission | `rev check` |

See [full documentation](docs/commands.md) for all commands.

---

## Requirements

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Pandoc** — Converts Markdown to Word/PDF

```bash
# macOS
brew install pandoc

# Windows
winget install JohnMacFarlane.Pandoc

# Linux
sudo apt install pandoc
```

---

## FAQ

**Q: Do my collaborators need to install docrev?**
No. They keep using Word normally. You handle the conversion.

**Q: Can I use my existing Word document?**
Yes. `rev import manuscript.docx` converts it to Markdown.

**Q: What about my bibliography?**
Use a `.bib` file (export from Zotero/Mendeley/EndNote). Citations are handled automatically.

**Q: Will equations look right in Word?**
Yes. LaTeX equations are converted to native Word equations.

**Q: What if I make a mistake?**
Plain text + Git means you can always go back. Run `rev backup` before big changes.

---

## License

MIT
