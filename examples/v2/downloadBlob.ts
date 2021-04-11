#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2016 Joyent, Inc.
 */

import { mainline } from "../mainline.ts";
import { parseRepoAndRef } from "../../lib/common.ts";
import { createClient } from "../../lib/registry-client-v2.ts";

// Shared mainline with examples/foo.js to get CLI opts.
const {opts, args} = mainline({ cmd: 'downloadBlob' });
if (!args[0] || (args[0].indexOf(':') === -1 && !args[1])) {
    console.error('usage: ./examples/v2/%s.ts REPO@DIGEST');
    Deno.exit(2);
}

// The interesting stuff starts here.
var rar = parseRepoAndRef(args[0]);
if (!rar.digest) throw new Error('must specify a @DIGEST');
console.log('Repo:', rar.canonicalName);

var client = createClient({
    repo: rar,
    insecure: opts.insecure,
    username: opts.username,
    password: opts.password
});

const {ress, stream} = await client.createBlobReadStream({digest: rar.digest});

var filename = rar.digest.split(':')[1].slice(0, 12) + '.blob';
console.log('Downloading blob to "%s".', filename);
console.log('Response headers:');
console.table(Array.from(ress[0].headers));
if (ress.length > 1) {
    console.log('Response headers (after redirects):');
    console.table(Array.from(ress[ress.length - 1].headers));
}

const file = await Deno.create(new URL(filename, import.meta.url));
for await (const buf of stream) {
    await Deno.writeAll(file, buf);
}
file.close();

console.log('Done downloading', filename);
