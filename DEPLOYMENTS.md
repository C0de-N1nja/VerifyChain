# VerifyChain zkSync Sepolia Deployments

## Deployed Contracts

| Contract | Address | Status |
|---|---|---|
| GovernanceBoard | 0x833C48E232174F849201fc58642bfdb41265D51e | Verified |
| CredentialRegistry | 0x92fF1cB6177c6543E3ED358dcceBD7F7E9cBcBef | Verified |

## Deprecated Contracts

| Contract | Address | Status | Reason |
|---|---|---|---|
| CredentialRegistry (v1) | 0xE60373C5C9cd26175829015Bd5E441Bf8a830bf6 | Deprecated (July 17, 2026) | Access-control gap in `revokeCredential(bytes32)` — only checked that the caller was *an* activated issuer, not the specific issuer who registered the batch, allowing any activated issuer to revoke another issuer's credentials (violated SRS SEC.2). Superseded by v2, which adds a `_merkleRoot` parameter and a `CredentialRegistry__NotBatchOwner` check. No longer referenced by the backend. |

## Board Members (2-of-3 multisig)

- Member 1: 0x19992c2DE1Da16b33bE1Aef78C0f99674A839E70
- Member 2: 0x606fFC43aF4a455D00599682f76912632c1C2a10
- Member 3: 0x3Bfec1d4Ff5F4cdB0d5995E94ba61bd4Cff8e366

## Deployment Transactions

- GovernanceBoard: 0xf025d9b523a777df73da8a687ec3458954a83398417dcbfe20124a7b719d56c0
- CredentialRegistry (v1, deprecated): 0xae325c8f27bca1b55c44ae0caf90dd840aa58ae314f4ca09969895226670daae
- CredentialRegistry (v2): 0x38386c202ea2650f0bab0814b21afb9ce3fb96d8cebd040948de1c1360c4cc3a

## Network

- Network: zkSync Sepolia Testnet
- RPC: https://sepolia.era.zksync.dev
- Explorer: https://sepolia.explorer.zksync.io