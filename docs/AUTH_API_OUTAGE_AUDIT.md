# Login API outage audit - 31 October 2026

The screenshot shows refresh and health failing together. No process was listening on local ports 5000, 5173 or 5174 during inspection; the historical runtime failure cannot be attributed to a particular startup/DNS/database error without the corresponding server log. No production database was started or seeded for this audit.

- Vite's unavailable backend proxy previously emitted an empty 500. It now returns JSON 503 with a retry header, bounded upstream timeout and actionable message. Both GET health and POST refresh were tested against a deliberately unavailable upstream.
- Session restoration previously sent three requests during an outage. It now makes a single shared attempt and retains the session hint on infrastructure failures.
- Refresh no longer clears a valid cookie on database/network exceptions. Definitive expired/revoked/inactive sessions still return 401 and clear cookies. Database connection errors map to retryable 503.
- The interceptor's refresh has a timeout; queued failed requests are marked retried to prevent a further refresh cycle.
- Connection checks use the configured API base URL, bounded requests and the readiness endpoint; HTML fallbacks and 4xx responses are no longer interpreted as a healthy API.
- Login displays the actual service-unavailable response rather than misclassifying every 503 as a database issue.

Validation: production build, four isolated controller/readiness tests, four desktop/mobile outage browser tests, and two real Vite unavailable-upstream checks. Existing database regression suite also rerun. No environment secrets or live customer records changed.
Final result: all 73 backend integration tests passed, all 4 browser scenarios passed, frontend type-check and whitespace checks passed.
