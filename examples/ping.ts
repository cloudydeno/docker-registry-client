#!/usr/bin/env -S deno run --no-check --allow-net=localhost

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { createClient } from "../lib/index.ts";
import { mainline } from "./mainline.ts";

/*
 * Copyright (c) 2015, Joyent, Inc.
 */

// Shared mainline with examples/foo.js to get CLI opts.
var cmd = 'ping';
const {opts, args} = mainline({cmd: cmd, excludeAuth: true});
var name = args[0];
if (!name) {
    console.error('usage: node examples/v1/%s.js REPO');
        // '\n' +
        // 'options:\n' +
        // '%s', cmd, parser.help().trimRight());
    Deno.exit(2);
}

// The interesting stuff starts here.
const reg = await createClient({
    name: name,
    // insecure: opts.insecure,
    // log: log
});
console.log('API version:', reg.version);

const res = await reg.ping();
console.log('status:', await res.dockerJson());
console.log('HTTP status:', res.status);
