# rev

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-orange.svg)
![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)

CLI tool for Word ↔ Markdown round-trips. Handle reviewer feedback on academic papers: import track changes, review interactively, manage comments, and auto-convert figure/table references.

## Features

- **Import from Word** - Diff Word docs against your Markdown, generating CriticMarkup annotations
- **Section-aware import** - Import directly to modular section files (intro.md, methods.md, etc.)
- **Interactive review** - Accept/reject track changes with a TUI
- **Comment management** - List and filter reviewer comments
- **Cross-reference conversion** - Auto-convert hardcoded "Figure 1" to dynamic `@fig:label` syntax

## Install

```bash
# Clone and install dependencies
git clone https://github.com/gcol33/rev.git
cd rev
npm install

# Add alias to ~/.zshrc or ~/.bashrc
alias rev='node "/path/to/rev/bin/rev.js"'
```

## Quick Start

```bash
# Import reviewer's Word doc to section files
rev sections reviewed.docx

# Review track changes interactively
rev review methods.md

# See remaining comments
rev comments methods.md

# Rebuild
./build.sh docx
```

## Commands

### Import & Export

| Command | Description |
|---------|-------------|
| `rev sections <docx>` | Import Word doc directly to section files |
| `rev import <docx> <md>` | Import changes from Word by diffing against your MD |
| `rev extract <docx>` | Extract plain text from Word |

### Review & Edit

| Command | Description |
|---------|-------------|
| `rev review <file>` | Interactive accept/reject TUI for track changes |
| `rev status <file>` | Show annotation counts |
| `rev comments <file>` | List all comments with context |
| `rev strip <file>` | Output clean Markdown (annotations applied) |

### Cross-References

| Command | Description |
|---------|-------------|
| `rev refs [file]` | Show figure/table registry and reference status |
| `rev migrate <file>` | Convert hardcoded refs (Fig. 1) to dynamic (@fig:label) |

### Configuration

| Command | Description |
|---------|-------------|
| `rev init` | Generate sections.yaml from existing .md files |
| `rev split <file>` | Split annotated paper.md back to section files |
| `rev help [topic]` | Show help (topics: workflow, syntax, commands) |

## Annotation Syntax (CriticMarkup)

```markdown
{++inserted text++}      # Insertions
{--deleted text--}       # Deletions
{~~old~>new~~}           # Substitutions
{>>Author: comment<<}    # Comments
```

## Section-Aware Workflow

For modular papers with multiple .md files:

```bash
# 1. Generate config from your .md files
rev init

# 2. Edit sections.yaml to add header aliases
#    (e.g., "Methods" → methods.md, "Methodology" → methods.md)

# 3. Import Word doc directly to sections
rev sections reviewed.docx

# 4. Review each section
rev review introduction.md
rev review methods.md
# ...
```

## Cross-Reference System

Use dynamic references in your source:

```markdown
![Caption](figures/img.png){#fig:heatmap}

See @fig:heatmap for the results.
```

When importing from Word, hardcoded refs are auto-converted:
- `Figure 1` → `@fig:heatmap`
- `Fig. 2` → `@fig:model`
- `Figs. 1-3` → `@fig:heatmap; @fig:model; @fig:hierarchy`

Requires [pandoc-crossref](https://github.com/lierdakil/pandoc-crossref) in your build pipeline.

## Build Integration

The workflow integrates with Pandoc build scripts:

- **PDF build:** Strips all annotations (clean output)
- **DOCX build:** Keeps comments visible, converts `@fig:` to "Figure 1"

## Dependencies

- Node.js 18+
- [mammoth](https://github.com/mwilliamson/mammoth.js) - Word document parsing
- [diff](https://github.com/kpdecker/jsdiff) - Text diffing
- [commander](https://github.com/tj/commander.js) - CLI framework
- [chalk](https://github.com/chalk/chalk) - Terminal styling
- [js-yaml](https://github.com/nodeca/js-yaml) - YAML parsing

## License

MIT
