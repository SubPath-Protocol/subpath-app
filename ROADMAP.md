# SubPath Application Roadmap

This roadmap outlines the milestones and prospective areas of contribution for the SubPath monorepo applications, SDK, and infrastructure.

## Current Milestone (v0.1.0 - Testnet Release)

* Full-stack monorepo featuring web dashboard, SDK, indexer, and executor daemons.
* Hosted checkout pages for merchant subscription plans.
* Multi-wallet connection kit supporting mobile and zero-install environments.
* Production Vercel deployment and Neon PostgreSQL integration.
* Containerized worker deployment assets (Dockerfiles, Docker Compose, Render Blueprint) for 24/7 cloud operation.

## Near-Term Maintenance

* Real-time WebSocket subscriptions for frontend event updates.
* Enhanced error messaging for insufficient token allowances on checkout.
* Multi-network switcher in the web UI (Testnet, Futurenet, Local).

## Post-Approval Contribution Areas

* **Webhook & Notification System**: Outbound webhooks notifying merchants of subscription renewals, failures, and cancellations.
* **Customer Portal**: Self-service subscriber management portal for reviewing billing history and receipts.
* **Kubernetes & Helm Packages**: Helm charts and production Kubernetes manifests for large-scale multi-region daemon deployment.
* **Automated Allowance Health Monitoring**: Pre-billing notifications alerting subscribers when token allowance or balance is low.
