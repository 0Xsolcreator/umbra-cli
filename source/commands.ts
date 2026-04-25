import {type Command} from '@oclif/core';

import {PluginAddCommand} from './commands/plugin/add.js';
import {PluginListCommand} from './commands/plugin/list.js';
import {PluginRemoveCommand} from './commands/plugin/remove.js';
import {PluginUseCommand} from './commands/plugin/use.js';
import {UserAddCommand} from './commands/user/add.js';
import {UserListCommand} from './commands/user/list.js';
import {UserUseCommand} from './commands/user/use.js';
import {UserRemoveCommand} from './commands/user/remove.js';
import {ConfigSetCommand} from './commands/config/set.js';
import {ConfigGetCommand} from './commands/config/get.js';
import {RegisterCommand} from './commands/register.js';
import {DepositCommand} from './commands/eta/deposit.js';
import {BalanceCommand} from './commands/eta/balance.js';
import {WithdrawCommand} from './commands/eta/withdraw.js';
import {CreateCommand} from './commands/utxo/create.js';
import {ScanCommand} from './commands/utxo/scan.js';
import {ClaimCommand} from './commands/utxo/claim.js';

const commands: Record<string, Command.Class> = {
	'plugin:add': PluginAddCommand,
	'plugin:list': PluginListCommand,
	'plugin:remove': PluginRemoveCommand,
	'plugin:use': PluginUseCommand,
	'user:add': UserAddCommand,
	'user:list': UserListCommand,
	'user:use': UserUseCommand,
	'user:remove': UserRemoveCommand,
	'config:set': ConfigSetCommand,
	'config:get': ConfigGetCommand,
	register: RegisterCommand,
	'eta:deposit': DepositCommand,
	'eta:balance': BalanceCommand,
	'eta:withdraw': WithdrawCommand,
	'utxo:create': CreateCommand,
	'utxo:scan': ScanCommand,
	'utxo:claim': ClaimCommand,
};

export default commands;
