/// <reference types="bun-types" />
import React from 'react';
import chalk from 'chalk';
import {expect, test} from 'bun:test';
import {render} from 'ink-testing-library';
import Index from './source/commands/index.js';

test('greet user', () => {
	const {lastFrame} = render(<Index options={{name: 'Jane'}} />);

	expect(lastFrame()).toBe(`Hello, ${chalk.green('Jane')}`);
});
