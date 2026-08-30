# Vault Ledger production runbook

## Deployment prerequisites

- Node.js 20 LTS or newer.
- MongoDB 7+ replica set (Atlas is supported). Transactions used by payments, allocations, closures, imports and tariff revisions do not work on a standalone MongoDB server.
- One explicit HTTPS frontend origin in `CLIENT_URL`.
- Independent, randomly generated `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values stored in the hosting secret manager.
- A non-default initial administrator password. Production validation rejects repository defaults.

Run `npm ci`, `npm test`, and `npm run build` in `backend`; run `npm ci` and `npm run build` in `frontend`. Deploy immutable artifacts from that CI run.

## Health and rollout

- Liveness: `GET /api/health/live` confirms the process can serve requests.
- Readiness: `GET /api/health/ready` confirms MongoDB is available. Route traffic only while this returns 200.
- Use rolling deployment with at least 30 seconds termination grace. The API handles `SIGTERM`, closes HTTP and MongoDB, and has a 10-second force-close guard.
- After rollout, verify login, a read-only report, a manual test payment, receipt rendering, and audit-log creation.

## Backup and restore

Use Atlas continuous backups where available. Otherwise run authenticated `mongodump --uri "$MONGODB_URI" --archive=<dated-file> --gzip` from a restricted operations host. Encrypt archives and retain daily/weekly/monthly generations according to policy.

Restore into a new database first with `mongorestore --uri <restore-uri> --archive=<file> --gzip`. Validate counts, unique indexes, report totals, payment-to-invoice balances, deposit ledgers and samples of customer/KYC records before switching traffic. Never test restoration over the live database.

Perform and record a restore drill at least quarterly. A backup without a successful restore drill is not verified.

## Security and compliance operations

- Grant least-privilege roles and review users, overrides and inactive accounts monthly.
- Review audit logs and failed authentication events weekly; include audit records in retention and backups.
- KYC documents are authenticated resources. Do not expose their upload directory through a public static host.
- Photos remain public-compatible for the existing UI. Never put identity documents in photo fields.
- Manual payments require method-specific references. Reconcile cash, UPI, transfer and cheque totals against the exported daily report before close of business.
- Apply legally approved retention periods to KYC data and backups through an authorized process.

## Incident response

1. Remove the affected instance from traffic and preserve logs/request IDs.
2. Revoke compromised sessions/users and rotate relevant secrets.
3. Identify affected customers, payments, documents and audit events.
4. Restore only after integrity checks; never edit financial history directly in MongoDB.
5. Record timeline, corrective action and required notifications.

## Monitoring alerts

Alert on readiness failures, repeated 5xx responses, sustained authentication rate limits, MongoDB replication lag/storage pressure, failed backups, and unusual cancellation/refund volume. Logs are structured JSON with request IDs; downstream tooling must also redact credentials and KYC identifiers.
