# Contributor Backlog (Post-MVP)

Now that SubPath core v0.1 has been successfully delivered and verified end-to-end on testnet, we are opening up the repository for broader contributions. The following items represent roadmap goals that are approved for future implementation:

## Webhooks
* **Merchant Webhooks**: Allow merchants to register endpoints to receive real-time notifications for `subscription_created`, `subscription_billed`, and `subscription_canceled` events via the Indexer.

## Resiliency and Scaling
* **Executor Decentralization**: Extend the executor architecture to support multiple distributed executor node operators securely.
* **Database Migrations Engine**: Formalize Prisma migration pipelines for seamless database schema upgrades.
* **Rate Limiting**: Implement strict rate limits for the API endpoints.
* **Cache Strategy**: Introduce Redis or similar caching layers for popular merchant plan read requests.

## Protocol Extensions
* **Dunning Flows**: Automated retry schedules for failed recurring payments before a subscription is permanently suspended.
* **Subscription Pause/Resume**: Further frontend integration for pausing and resuming subscriptions (contract logic exists).
* **Grace Periods**: Configurable grace periods for expired allowances before canceling.
* **Usage-based Extensions**: Support for metered billing.

## User Experience
* **Additional Wallet Support**: Expand StellarWalletsKit with specific bespoke connectors.
* **Accessibility Audit**: Comprehensive ARIA attribute review and keyboard navigation testing.
* **SDK Conveniences**: Add higher-level React Hooks (e.g. `usePlan`, `useSubscription`) to the SDK package.
