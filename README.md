# Crypto Trading Bot

Automated trading bot that executes trades based on webhook notifications. Supports multiple chains including Ethereum, BSC, Solana, Tron, and Aptos.

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

## Development

Start the development server:

```bash
npm run dev
```

## Deployment

Deploy to production:

```bash
npm run deploy
```

## Webhook API

### POST /webhook

Endpoint for receiving trading signals.

```json
{
  "tokens": [
    {
      "address": "0x...",  // Optional if name is provided
      "chain": "ethereum", // Required: "ethereum", "bsc", "solana", "tron", "aptos"
      "name": "PEPE"      // Optional if address is provided
    }
  ]
}
```

#### Headers
```
X-API-KEY: your-api-key
Content-Type: application/json
```

#### Response
```json
{
  "status": "success",
  "message": "Processed 1 tokens",
  "time": "2024-03-21T12:00:00.000Z"
}
```

## Environment Variables

Create a `.env` file:

```env
# Required
API_KEY=your-webhook-api-key
PRIVATE_KEY=your-wallet-private-key
TRON_PRIVATE_KEY=your-tron-private-key
APTOS_PRIVATE_KEY=your-aptos-private-key

# Optional
PORT=3000
MAX_SLIPPAGE=1
```

## Supported Chains

- Ethereum
- BSC (Binance Smart Chain)
- Solana
- Tron
- Aptos
- Other EVM-compatible chains

## Chain-Specific Notes

### Tron
- Uses TRC20 token standard
- Requires Tron-specific address format (T...)
- Supports TronLink wallet integration

### Aptos
- Uses Move-based smart contracts
- Requires Aptos-specific address format
- Supports Petra wallet integration

## Error Handling

The API returns appropriate HTTP status codes:
- 401: Unauthorized (Invalid API key)
- 400: Bad Request (Missing/invalid parameters)
- 500: Internal Server Error

## Security

- Webhook authentication via API key
- Private key encryption
- Slippage protection
- Chain-specific security measures

## License

MIT
```
