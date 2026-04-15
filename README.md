# umbra-cli

Privacy-preserving token transfers on Solana, from your terminal.

> Community-built CLI for the [Umbra protocol](https://umbraprivacy.com). Not an official Umbra product.
>
> **[Documentation](https://umbra.0xcreator.dev)**

![umbra-cli demo](demo.gif)

---

## Install

```bash
npm install --global umbraprivacy-cli
```

Requires [Bun](https://bun.sh) >= 1.0 and a Solana keypair on disk. If you don't have one:

```bash
solana-keygen new
```

---

## Quickstart

```bash
# 1. Link your keypair and set your network
umbra init

# 2. Create your on-chain Umbra identity (one-time)
umbra register

# 3. Shield tokens into an encrypted balance
umbra eta deposit EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 100000000

# 4. Check your encrypted balance
umbra eta balance EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

> Amounts are in base units — for a 6-decimal token, `1000000` = 1 token.

---

## Commands

| Command | Description |
|---|---|
| `umbra init` | Link your keypair and configure the CLI |
| `umbra register` | Publish your on-chain Umbra user account |
| `umbra eta deposit <mint> <amount>` | Move tokens into your encrypted balance |
| `umbra eta balance <mint...>` | Decrypt and display your encrypted balances |
| `umbra eta withdraw <mint> <amount>` | Move tokens from your encrypted balance back to your wallet |
| `umbra utxo create <mint> <amount>` | Create an anonymous stealth UTXO in the mixer |
| `umbra utxo scan` | Scan the chain for UTXOs belonging to you |
| `umbra utxo claim` | Scan and claim all found UTXOs *(currently unavailable)* |

For full option details, see the **[docs](https://umbra.0xcreator.dev)**.

Run any command with `--help` for a quick reference inline.

---

## Docs

Docs are built with [Mintlify](https://mintlify.com) and hosted at [umbra.0xcreator.dev](https://umbra.0xcreator.dev). Source files live in the [`docs/`](docs/) folder as `.mdx` files.

To preview changes locally:

```bash
cd docs
npx mintlify dev
```

This starts a local dev server at `http://localhost:3000`. Navigation is configured in [`docs/docs.json`](docs/docs.json).

---

## Dev setup

```bash
bun install
bun run build   # tsc + chmod dist/cli.js
bun run dev     # tsc --watch
bun test tests/ # prettier + xo + bun test
```

---

## Project structure

The CLI is built with [Oclif](https://oclif.io) for command routing and [Ink](https://github.com/vadimdemedes/ink) (React for the terminal) for rendering. Each command file exports an Ink component (the UI) and an Oclif `Command` class (the routing and flag parsing). Commands are explicitly registered in `source/commands.ts`.

```
source/
├── cli.tsx                  # Entry point — bootstraps Oclif
├── commands.ts              # Explicit command registry (maps IDs to Command classes)
├── help.ts                  # Custom Help class — renders the ASCII logo on `umbra`
├── commands/
│   ├── init.tsx             # umbra init
│   ├── register.tsx         # umbra register
│   ├── eta/
│   │   ├── deposit.tsx      # umbra eta deposit
│   │   ├── balance.tsx      # umbra eta balance
│   │   └── withdraw.tsx     # umbra eta withdraw
│   └── utxo/
│       ├── create.tsx       # umbra utxo create
│       ├── scan.tsx         # umbra utxo scan
│       └── claim.tsx        # umbra utxo claim
├── components/
│   └── index.tsx            # Shared Ink components (Spinner, ErrorMessage, Row, UtxoGroup)
└── lib/
    ├── config.ts            # Read/write ~/.umbra-cli/config.json
    ├── errors.ts            # Error formatting per command
    ├── flags.ts             # Custom Oclif flag/arg factories (bigintFlag, bigintArg)
    ├── format.ts            # Display helpers
    ├── paths.ts             # File path constants
    ├── constants.ts         # Network defaults and RPC endpoints
    └── umbra/               # Thin wrappers around @umbra-privacy/sdk
        ├── client.ts        # IUmbraClient creation and storage
        ├── signer.ts        # IUmbraSigner from a keypair file
        ├── scanner.ts       # UTXO scanning helpers
        └── seed-storage.ts  # File-based master seed persistence

tests/
└── commands/                # Bun tests mirroring the commands/ structure
                             # ⚠️ Current tests are AI-generated — proper test coverage is in progress
```

To add a new command:
1. Create a `.tsx` file in the appropriate `source/commands/` subfolder with a default-exported Ink component and a named-exported `Command` class.
2. Register it in `source/commands.ts` with its command ID (e.g. `'eta:mycommand'`).

---

## License

[MIT](LICENSE)
