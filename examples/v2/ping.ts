#!/usr/bin/env -S deno run --allow-net

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2015, Joyent, Inc.
 */

import { mainline } from "../mainline.ts";
import { ping } from "../../lib/registry-client-v2.ts";

// Shared mainline with examples/foo.js to get CLI opts.
const {opts, args} = mainline({cmd: 'ping'});
if (opts.help) {
    console.error('usage: node examples/v2/%s.js [INDEX]');
    Deno.exit(0);
}

// `docker login` defaults to this URL. Let's do the same.
var indexName = args[0] || 'https://index.docker.io/v1/';

// The interesting stuff starts here.
const res = await ping({
    indexName: indexName,
    // log: log,
    // username: opts.username,
    // password: opts.password,
    insecure: opts.insecure
});
console.log('HTTP status: %s', res.status);
console.log('Headers:');
console.table(Array.from(res.headers));
// if (res.status === 200) {
    console.log('Body: ', JSON.stringify(await res.dockerJson(), null, 4));
// }
