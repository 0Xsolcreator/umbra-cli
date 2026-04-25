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
# 1. Add a signer user (links your keypair to the CLI)
umbra user add alice --backend local

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
| `umbra user add <name> --backend <backend>` | Add a signer user (local keypair or managed wallet) |
| `umbra user list` | List configured users |
| `umbra user use <name>` | Set the active user for all commands |
| `umbra user remove <name>` | Remove a user and its stored credentials |
| `umbra config set <key> <value>` | Set a CLI-wide config value |
| `umbra config get [key]` | Print one or all config values |
| `umbra register` | Publish your on-chain Umbra user account |
| `umbra eta deposit <mint> <amount>` | Move tokens into your encrypted balance |
| `umbra eta balance <mint...>` | Decrypt and display your encrypted balances |
| `umbra eta withdraw <mint> <amount>` | Move tokens from your encrypted balance back to your wallet |
| `umbra utxo create <mint> <amount>` | Create an anonymous stealth UTXO in the mixer |
| `umbra utxo scan` | Scan the chain for UTXOs belonging to you |
| `umbra utxo claim` | Scan and claim all found UTXOs |
| `umbra plugin add <name>` | Install a plugin from npm |
| `umbra plugin list` | List installed plugins |
| `umbra plugin remove <name>` | Uninstall a plugin |
| `umbra plugin use <plugin> <name>` | Set the active user for a specific plugin |

For full option details, see the **[docs](https://umbra.0xcreator.dev)**.

Run any command with `--help` for a quick reference inline.

---

## Plugins

The CLI supports plugins — npm packages that add new commands to `umbra`. Install any compatible plugin from npm:

```bash
umbra plugin add jup-earn
umbra plugin add @myorg/umbra-plugin-defi
```

Each plugin can be pinned to a different wallet without changing your global active user:

```bash
umbra plugin use jup-earn alice
```

**For plugin authors:** the CLI exposes its internals at the `umbra-cli/lib` entry point. Import helpers like `resolvePluginUser`, `getPluginRpc`, and config utilities directly rather than reimplementing them:

```ts
import { resolvePluginUser, getPluginRpc } from 'umbra-cli/lib';

const user = await resolvePluginUser('my-plugin');
const { rpc } = await getPluginRpc();
```

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

To add a new command:
1. Create a `.tsx` file in the appropriate `source/commands/` subfolder with a default-exported Ink component and a named-exported `Command` class.
2. Register it in `source/commands.ts` with its command ID (e.g. `'eta:mycommand'`).

---

## License

[MIT](LICENSE)
