# docrev Improvements

## High Value

- [ ] Refactor bin/rev.js into smaller command modules (deferred - requires careful export matching)
- [x] Add JSON schema validation for rev.yaml config (lib/schema.js)
- [x] Add --dry-run flag to all destructive operations (resolve, reply commands added)
- [x] Add progress indicators for long operations (lib/format.js - progressBar function)

## Medium Value

- [x] Add interactive comment review mode (lib/review.js - interactiveCommentReview, `rev comments -i`)
- [x] Create troubleshooting documentation (docs/troubleshooting.md)
- [x] Add fallback strategies when Pandoc/LaTeX missing (lib/build.js - hasLatex, checkDependencies, getInstallInstructions)
- [x] Implement DOI lookup caching (lib/doi.js - 7-day cache with clearDoiCache, getDoiCacheStats)
- [x] Improve error messages with actionable suggestions (lib/errors.js - formatError, requireFile, etc.)

## Nice to Have

- [x] Plugin system for custom journal profiles (lib/plugins.js, `rev profiles` command)
- [x] TUI mode for visual comment review (lib/tui.js, `rev comments -t`)
- [x] In-session undo stack for comment operations (lib/undo.js, integrated in TUI mode)
- [x] Batch operations for multiple documents (`rev batch` command)
