<div align="center">

<h1>⛓️ VerifyChain</h1>

<p><strong>A Multi-Sig Governed, Merkle-Proof Universal Credential Verification System</strong></p>

<p>Built on zkSync Layer-2 · Powered by Solidity & Foundry</p>

![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge)
![Foundry](https://img.shields.io/badge/Foundry-FFDB1C?style=for-the-badge)
![zkSync](https://img.shields.io/badge/zkSync-Sepolia-1E69FF?style=for-the-badge)
![UCP](https://img.shields.io/badge/UCP-FYP_2026-22c55e?style=for-the-badge)

</div>

## 🔍 The Problem

Fake degree fraud is a serious and growing problem in Pakistan:

- **HEC DAS** takes 15–60 days per verification, costs money, and only covers HEC-recognized universities
- **Private institutes, bootcamps, and training centers** have zero credential verification infrastructure
- **Employers** have no fast, reliable, and free way to verify certificates from non-HEC institutions
- **Students with genuine degrees** suffer when their credentials are doubted

## ✅ The Solution

VerifyChain lets authorized institutions issue **tamper-proof credentials** using Merkle-proof batch issuance stored on zkSync blockchain.

- Employers verify any credential in **seconds** by scanning a QR code
- **No wallet. No account. No fees.** for verifiers
- Credentials are mathematically impossible to forge
- Works for universities, bootcamps, and any institution

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   THREE PORTALS                      │
├─────────────────┬──────────────────┬────────────────┤
│  Issuer Portal  │ Verifier Portal  │  Governance    │
│  (MetaMask)     │ (Public/No Auth) │  Dashboard     │
└────────┬────────┴────────┬─────────┴───────┬────────┘
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────┐
│              Node.js Backend (Express)               │
│   merkletreejs · pdf-lib · Nodemailer · Ethers.js   │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│              zkSync Sepolia (Layer-2)                │
│                                                     │
│   ┌──────────────────┐   ┌───────────────────────┐  │
│   │ GovernanceBoard  │   │  CredentialRegistry   │  │
│   │     .sol         │◄──│        .sol           │  │
│   │  2-of-3 MultiSig │   │  Merkle Batch + Verify│  │
│   └──────────────────┘   └───────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## ⚙️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| Smart Contracts | Solidity 0.8.20 | Contract logic |
| Dev & Testing | Foundry | Compile, test, deploy |
| Blockchain | zkSync Sepolia | Layer-2 deployment |
| Backend | Node.js, Express.js | API server |
| Merkle Trees | merkletreejs | Batch credential hashing |
| PDF Generation | pdf-lib | Print-ready A4 certificates |
| Email Delivery | Nodemailer | Certificate delivery to recipients |
| Frontend | React.js, Tailwind CSS | User interfaces |
| Blockchain Client | Ethers.js v6 | Frontend-contract connection |

## 🖥️ Portals

### 📤 Issuer Portal
- MetaMask wallet login, only activated issuers can access
- **Single issuance**, fill form, generate certificate, send via email
- **Bulk issuance**, upload CSV, batch process, Merkle root stored on-chain
- View batch history and issued credentials
- Revoke credentials when needed

### 🔍 Verifier Portal
- **Completely public**, no wallet, no account, no fees
- Scan QR code from any VerifyChain certificate
- Instant result, one of four states:
  - ✅ **Valid**, issuer, recipient, issue date shown
  - ❌ **Revoked**, credential was revoked
  - ⏰ **Expired**, Tier 2 certification past expiry date
  - ❓ **Not Found**, not on blockchain
- Fully mobile responsive

### 🏛️ Governance Dashboard
- Restricted to 3 board member wallets only
- Submit proposals to onboard new institutions
- Vote on pending proposals, auto-activates at 2/3 quorum
- View and manage active issuers

## 📜 Smart Contracts

### GovernanceBoard.sol
Manages the 2-of-3 multi-sig governance board that controls which institutions can issue credentials.

| Function | Description |
| :--- | :--- |
| `submitProposal(address, uint8)` | Board member proposes a new issuer with tier |
| `approveProposal(uint256)` | Board member votes, auto-activates at 2 votes |
| `isGovernanceMember(address)` | Check if address is a board member |
| `getIssuerTier(address)` | Returns issuer tier (0 = not an issuer) |

### CredentialRegistry.sol
Handles Merkle-proof batch issuance and on-chain verification.

| Function | Description |
| :--- | :--- |
| `registerBatch(bytes32, uint256)` | Store Merkle root + expiry for a batch |
| `revokeCredential(bytes32)` | Revoke a specific credential leaf hash |
| `verify(bytes32, bytes32, bytes32[])` | Verify credential against stored Merkle root |

### Events

```solidity
event BatchRegistered(bytes32 indexed merkleRoot, address indexed issuer);
event CredentialRevoked(bytes32 indexed leafHash, address indexed revokedBy);
event ProposalSubmitted(uint256 indexed proposalId, address indexed institution);
event IssuerActivated(address indexed institution, uint8 tier);
```

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- [Foundry](https://getfoundry.sh) installed
- MetaMask browser extension
- Git

### Clone & Install

```bash
git clone https://github.com/C0de-N1nja/VerifyChain
cd VerifyChain

# Contracts
cd contracts
forge install
forge build

# Backend
cd ../backend
npm install

# Frontend
cd ../frontend
npm install
```

### Environment Variables

Create `.env` in `/backend`:

```env
PRIVATE_KEY=your_wallet_private_key
ZKSYNC_RPC_URL=https://sepolia.era.zksync.dev
CONTRACT_ADDRESS=your_deployed_contract_address
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
```

> ⚠️ Never commit `.env` to GitHub. It is already in `.gitignore`.

### Run Tests

```bash
cd contracts
forge test
forge coverage
```

### Deploy to zkSync Sepolia

```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url $ZKSYNC_RPC_URL \
  --broadcast \
  --zksync
```

## 🌿 Branch Strategy

| Branch | Purpose |
| :--- | :--- |
| `main` | Production only, merged via PR |
| `dev` | Integration branch, both team members merge here |
| `feature/smart-contracts` | Smart contract development |
| `feature/frontend` | React frontend development |

## 👥 Team

| Name | Role | Student ID |
| :--- | :--- | :--- |
| Muhammad Rehan Rashid | Smart Contracts + Backend | G1F22UBSCS095 |
| Muhammad Huzaifa | React Frontend | G1F22UBSCS120 |

**Supervisor:** Prof. Hassan Rauf  
**University:** University of Central Punjab (UCP), PGC Campus Gujranwala  
**Group ID:** G1F22FYPCS025  
**Session:** 2022–2026

## 📄 License

This project is licensed under the [MIT License](LICENSE).

<div align="center">
<p>Built with ❤️ at University of Central Punjab · 2026</p>
</div>