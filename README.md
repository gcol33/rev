# docrev

[![npm](https://img.shields.io/npm/v/docrev)](https://www.npmjs.com/package/docrev)
[![npm downloads](https://img.shields.io/npm/dm/docrev)](https://www.npmjs.com/package/docrev)
[![node](https://img.shields.io/node/v/docrev)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/gcol33/docrev/actions/workflows/ci.yml/badge.svg)](https://github.com/gcol33/docrev/actions/workflows/ci.yml)

A CLI for writing scientific papers in Markdown while collaborating with Word users.

You write in Markdown under version control. Your collaborators use Word. docrev converts between the two, preserving track changes, comments, equations, and cross-references.

## Install

```bash
npm install -g docrev
brew install pandoc
```

Pandoc is required for document conversion. On Windows use `winget install JohnMacFarlane.Pandoc`, on Linux use `apt install pandoc`.

## Getting Started

### Starting from a Word Document

If you have an existing manuscript in Word:

```bash
rev import manuscript.docx
```

This converts your document to markdown, splitting it into sections:

```
my-paper/
├── introduction.md
├── methods.md
├── results.md
├── discussion.md
├── references.bib
└── rev.yaml
```

Track changes and comments from the Word document are preserved as annotations in the markdown files (see below).

### Starting from Scratch

To start a new paper in markdown:

```bash
rev new my-paper
cd my-paper
```

This creates the same project structure with empty section files. Write your paper in the markdown files, then build Word documents to share with collaborators.

## The Revision Cycle

### 1. Build and Share

Generate a Word document from your markdown:

```bash
rev build docx
```

Send this to your collaborators. They review it in Word, adding comments and track changes as usual.

### 2. Import Feedback

When collaborators return the reviewed document, import their feedback:

```bash
rev sections reviewed.docx
```

This updates your markdown files with their comments and track changes, converted to inline annotations.

### 3. Review Track Changes

Track changes appear as inline annotations in your markdown:

```markdown
The sample size was {--100--}{++150++} individuals.
We collected data {~~monthly~>weekly~~} from each site.
```

- `{++text++}` — inserted text
- `{--text--}` — deleted text
- `{~~old~>new~~}` — substitution

To accept a change, keep the new text and delete the markup. To reject it, keep the old text. When you're done, the file is clean markdown.

### 4. Respond to Comments

Comments appear inline in your markdown:

```markdown
We used a random sampling approach.
{>>Reviewer 2: Please clarify the sampling method.<<}
```

List all comments in a file:

```bash
rev comments methods.md
```

Reply from the command line:

```bash
rev config user "Your Name"    # one-time setup
rev reply methods.md -n 1 -m "Added clarification in paragraph 2"
```

Your reply threads beneath the original:

```markdown
We used a random sampling approach.
{>>Reviewer 2: Please clarify the sampling method.<<}
{>>Your Name: Added clarification in paragraph 2.<<}
```

Mark comments as resolved:

```bash
rev resolve methods.md -n 1
```

### 5. Rebuild with Comment Threads

Generate both a clean version and one showing the comment threads:

```bash
rev build --dual
```

This produces:
- `paper.docx` — clean, for submission
- `paper_comments.docx` — includes comment threads as Word comments

Your collaborators see the full conversation in the comments pane.

### 6. Repeat

Send the updated Word document. Import new feedback with `rev sections`. Continue until done.

## Before Submission

### Validate Your Bibliography

Check that DOIs in your bibliography resolve correctly:

```bash
rev doi check references.bib
```

Find DOIs for entries missing them:

```bash
rev doi lookup references.bib
```

Add a citation directly from a DOI:

```bash
rev doi add 10.1038/s41586-020-2649-2
```

### Run Pre-Submission Checks

Check for broken references, missing citations, and common issues:

```bash
rev check
```

## Writing in Markdown

### Citations

Add references to `references.bib`:

```bibtex
@article{Smith2020,
  author = {Smith, Jane},
  title = {Paper Title},
  journal = {Nature},
  year = {2020},
  doi = {10.1038/example}
}
```

Cite in text:

```markdown
Previous work [@Smith2020] established this relationship.
Multiple sources support this [@Smith2020; @Jones2021].
```

### Equations

Inline equations use single dollar signs: `$E = mc^2$`

Display equations use double dollar signs:

```markdown
$$
\bar{x} = \frac{1}{n} \sum_{i=1}^{n} x_i
$$
```

### Figures and Cross-References

```markdown
![Study site locations](figures/map.png){#fig:map}

Results are shown in @fig:map.
```

The reference `@fig:map` becomes "Figure 1" in the output. Numbers update automatically when figures are reordered.

Tables and equations work the same way with `@tbl:label` and `@eq:label`.

## Useful Commands

| Task | Command |
|------|---------|
| Start new project | `rev new my-paper` |
| Import Word document | `rev import manuscript.docx` |
| Import feedback | `rev sections reviewed.docx` |
| List comments | `rev comments methods.md` |
| Reply to comment | `rev reply methods.md -n 1 -m "response"` |
| Build Word | `rev build docx` |
| Build PDF | `rev build pdf` |
| Build both clean and annotated | `rev build --dual` |
| Check DOIs | `rev doi check references.bib` |
| Find missing DOIs | `rev doi lookup references.bib` |
| Word count | `rev word-count` |
| Pre-submission check | `rev check` |
| Watch for changes | `rev watch docx` |

Full command reference: [docs/commands.md](docs/commands.md)

## Requirements

- Node.js 18+
- Pandoc 2.11+

## License

MIT
