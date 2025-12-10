#!/usr/bin/env -S deno run --allow-net

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { mainline } from "../mainline.ts";
import { RegistryClientV2 } from "@cloudydeno/docker-registry-client/registry-client-v2";

/*
 * Copyright (c) 2015, Joyent, Inc.
 */

// Shared mainline with examples/foo.js to get CLI opts.
const cmd = 'listTags';
const {opts, args} = mainline({ cmd });
const name = args[0];
if (!name) {
    console.error('usage: examples/v2/%s.ts REPO', cmd);
    Deno.exit(2);
}


// The interesting stuff starts here.
const client = new RegistryClientV2({
    name: name,
    insecure: opts.insecure,
    username: opts.username,
    password: opts.password
});
const tags = await client.listTags();
console.log(JSON.stringify(tags, null, 4));
