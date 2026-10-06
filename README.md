# 🌊 SubPath Application

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)
![Drips Wave](https://img.shields.io/badge/Drips-Wave-blueviolet)

SubPath is a decentralized recurring billing protocol. This repository contains the application layer, comprising a stunning Next.js frontend and a shared TypeScript SDK for interacting with the core Soroban smart contracts.

## 🏗 Architecture Overview
This is a `pnpm` monorepo containing:
*   `packages/sdk`: Pure TypeScript wrappers for type-safe interactions with Soroban. Includes `SubPathClient` with all `Reads` and `Writes`.
*   `apps/web`: The Next.js 14 App Router UI, containing merchant dashboard and subscriber flows with `@stellar/freighter-api`.
*   `apps/executor`: A reference Node.js executor service for triggering billing cycles.

## 🚀 Quick Start

### Prerequisites
* Node.js v20+
* pnpm v9+

### Setup
```bash
# Install dependencies
pnpm install

# Setup environment variables
cp apps/web/.env.example apps/web/.env.local
```

### Development
```bash
pnpm run dev
```

## 🤝 Contributing
Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and PR process.

## 🛡 Security
Review our [SECURITY.md](SECURITY.md) for responsible disclosure.

## ✨ Contributors
Made with [contrib.rocks](https://contrib.rocks).
<a href="https://github.com/SubPath-Protocol/subpath-app/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=SubPath-Protocol/subpath-app" />
</a>
