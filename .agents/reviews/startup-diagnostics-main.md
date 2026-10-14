# Startup diagnostics coordinator review

Reviewer/implementer: /root. Roles principal-engineer, backend-engineer and platform-engineer; sequential, not independent. Scope: boot error visibility, failed startup cleanup and developer runbook. No business, identity authorization, UI, dependency or infrastructure mapping change.

User reports the API's generic startup error on macOS; supplied logs previously proved PostgreSQL5432 and API3000 occupied. Original local root cause after port changes is still unknown. Before editing, a real Node --import tsx createApplication/listen on free33381 using only synthetic .env.example succeeded and shut down. No local PostgreSQL success or user's machine inspection is claimed.

Implemented validated stage/listener diagnostics, allowlisted network codes/config field names, nonzero failure exit, Nest abortOnError:false and bounded cleanup after partial HTTP init/listen failure. Independent architecture feedback identified unknown-error getters and unbounded cleanup; formatter now fails safely, cleanup is deadline-limited and targeted regressions cover those cases. Ten helper tests pass, including secret redaction, throwing getters, hung/failed cleanup and timer release. Final broader checks and specialist reviews are recorded in the task record.

The complete raw error is deliberately not logged. An unknown initialization error can still require a deeper scoped diagnostic after identifying its stage. Native tsx watch CLI and user's macOS services are not certified by this executor's Node loader probe.
