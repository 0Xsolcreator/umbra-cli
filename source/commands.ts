import {type Command} from '@oclif/core';

import {InitCommand} from './commands/init.js';
import {RegisterCommand} from './commands/register.js';
import {DepositCommand} from './commands/eta/deposit.js';
import {BalanceCommand} from './commands/eta/balance.js';
import {WithdrawCommand} from './commands/eta/withdraw.js';
import {CreateCommand} from './commands/utxo/create.js';
import {ScanCommand} from './commands/utxo/scan.js';
import {ClaimCommand} from './commands/utxo/claim.js';

const commands: Record<string, Command.Class> = {
	init: InitCommand,
	register: RegisterCommand,
	'eta:deposit': DepositCommand,
	'eta:balance': BalanceCommand,
	'eta:withdraw': WithdrawCommand,
	'utxo:create': CreateCommand,
	'utxo:scan': ScanCommand,
	'utxo:claim': ClaimCommand,
};

export default commands;
