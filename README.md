# Crypto Trading Bot

Automated trading bot that executes trades based on webhook notifications. Supports multiple chains including Ethereum, BSC, Solana, Tron, and Aptos.

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Chain-Specific Documentation](#chain-specific-documentation)
- [Development](#development)
- [Security](#security)
- [License](#license)

## Features
- 🔄 Automatic trading execution via webhooks
- ⛓️ Multi-chain support (EVM chains, Solana, Tron & Aptos)
- 🔍 Token address resolution by symbol
- 🔒 Webhook authentication
- 🚫 Slippage protection

## Installation
```bash
npm install
```

## Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
# General Settings
API_KEY=your-webhook-api-key
PORT=3000
MAX_SLIPPAGE=1

# Chain-specific Private Keys
PRIVATE_KEY=your-wallet-private-key
TRON_PRIVATE_KEY=your-tron-private-key
APTOS_PRIVATE_KEY=your-aptos-private-key

# Solana Configuration
SOLANA_PRIVATE_KEY=your-solana-wallet-private-key
SOLANA_RPC_URL=your-solana-rpc-url
FEE_ADDRESS=fee-wallet-address
JITO_ENABLED=true
TIP_AMOUNT=0.0005
```

## Usage

### Basic Example
```typescript
import SolanaSwapService from "./src/solana";

const swapService = new SolanaSwapService();
const result = await swapService.handleSwap({
  inputMint: "So11111111111111111111111111111111111111112", // SOL
  outputMint: "targetTokenMint",
  amount: 0.001,
  amountDecimal: 9,
  maxAutoSlippageBps: 100,
});
```

## API Reference

### Webhook Endpoint

#### POST /webhook
```json
{
  "tokens": [
    {
      "address": "0x...",
      "chain": "ethereum",
      "name": "PEPE"
    }
  ]
}
```

Required Headers:
```
X-API-KEY: your-api-key
Content-Type: application/json
```

## Chain-Specific Documentation

### Solana
Solana implementation includes advanced features for optimal trading:

#### Features
- ⚡ Jupiter DEX integration
- 🚀 Jito MEV protection
- 💰 Automatic fee handling
- 🔄 Versioned transactions
- 📊 Slippage protection

#### Example
```typescript
import SolanaSwapService from "./src/solana";

const swapService = new SolanaSwapService();
const swapResult = await swapService.handleSwap({
  inputMint: "So11111111111111111111111111111111111111112", // SOL
  outputMint: "9PR7nCP9DpcUotnDPVLUBUZKu5WAYkwrCUx9wDnSpump", // Target token
  amount: 0.001,
  amountDecimal: 9,
  maxAutoSlippageBps: 100,
});
```

### Other Supported Chains
- **Ethereum**: Standard ERC20 token support
- **BSC**: BEP20 token standard
- **Tron**: TRC20 token standard, TronLink integration
- **Aptos**: Move-based contracts, Petra wallet support

## Development

Start the development server:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

## Security
- Webhook authentication via API key
- Private key encryption
- Slippage protection
- Chain-specific security measures

## License
MIT
