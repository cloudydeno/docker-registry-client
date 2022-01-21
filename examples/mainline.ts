/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2015, Joyent, Inc.
 */

/*
 * Shared code for some of the examples in this dir to get CLI options.
 */

// var assert = require('assert-plus');
// var bunyan = require('bunyan');
// var dashdash = require('dashdash');
// var format = require('util').format;
// var read = require('read');

import { parse } from "https://deno.land/std@0.120.0/flags/mod.ts";

export interface CliOption {
    names: string[];
    type: 'bool' | 'number' | 'string';
    help?: string;
}

var optionsNoAuth: CliOption[] = [
    {
        names: ['help', 'h'],
        type: 'bool',
        help: 'Print this help and exit.'
    },
    {
        names: ['verbose', 'v'],
        type: 'bool',
        help: 'Verbose logging.'
    },
    {
        names: ['insecure', 'k'],
        type: 'bool',
        help: 'Allow insecure SSL connections (i.e. do not enforce SSL certs)'
    },
    {
        names: ['schema', 's'],
        type: 'number',
        help: 'Maximum schema version to request (1 or 2, defaults to 1)'
    }
];

var options: CliOption[] = [
    ...optionsNoAuth,
    {
        names: ['username', 'u'],
        type: 'string',
        help: 'Basic auth username'
    },
    {
        names: ['password', 'p'],
        type: 'string',
        help: 'Basic auth password'
    },
];


export function fail(cmd: string, err: Error, opts: {
    verbose?: boolean;
} = {}) {
    var errToShow = opts.verbose ? err.stack || err : err.message || err;
    console.error('%s: error: %s', cmd, errToShow);
    Deno.exit(2);
}


export function mainline(config: {
    cmd: string;
    excludeAuth?: boolean;
    options?: CliOption[];
}) {
    var dashOpts = (config.excludeAuth ? optionsNoAuth : options);
    if (config.options) {
        // Add to existing options.
        dashOpts = dashOpts.concat(config.options);
    }

    const parseArgs = {
        string: new Array<string>(),
        boolean: new Array<string>(),
        alias: Object.create(null) as Record<string, string[]>,
    };
    for (const opt of dashOpts) {
        if (opt.names.length > 1) {
            parseArgs.alias[opt.names[0]] = opt.names.slice(1);
        }
        if (opt.type === 'string') {
            parseArgs.string.push(opt.names[0]);
        }
        if (opt.type === 'bool') {
            parseArgs.boolean.push(opt.names[0]);
        }
    }

    const opts = parse(Deno.args, parseArgs);

    // var logLevel = 'warn';
    // if (opts.verbose) {
    //     logLevel = 'trace';
    // }
    // var log = bunyan.createLogger({
    //     name: config.cmd,
    //     level: logLevel
    // });

    // Handle password prompt, if necessary.
    if (opts.username && !opts.password) {
        // var readOpts = {
        //     prompt: format('Password for %s: ', opts.username),
        //     silent: true
        // };
        opts.password = prompt(`Password for ${opts.username}`)?.trim();
    }
    // cb(log, parser, opts, opts._args);
    return {opts, args: opts._.map(x => x.toString())};
}
