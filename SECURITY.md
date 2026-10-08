# Security Policy

## Scope & Deployment Status

* **Status**: Prototype MVP (`v0.1.0`).
* **Environment**: Stellar Testnet.
* **Audit Status**: Unaudited. No third-party professional security audit has been conducted.
* **Mainnet Caution**: The application and protocol contracts are not audited for Mainnet financial deployments.

## Non-Custodial Security & Key Management

* **No Secret Storage**: The web application never receives, stores, or accesses subscriber private keys. All signing occurs inside client wallets (Freighter, Albedo, xBull, Lobstr).
* **Executor Boundary**: The executor daemon uses a dedicated operator keypair solely to fund transaction network fees for `execute_billing`. The executor cannot transfer funds outside pre-authorized contract limits.
* **Database Isolation**: The PostgreSQL database stores public indexer logs and subscription metadata; it holds no private keys or custody credentials.

## Reporting a Vulnerability

Please report security issues responsibly:

* **Email**: `security@subpath-protocol.com`
* **Do Not File Public Issues**: Do not disclose vulnerabilities in public GitHub issues or discussions.
* **Response Commitment**: We acknowledge reports within 48 hours and work with reporters on validation and remediation.
