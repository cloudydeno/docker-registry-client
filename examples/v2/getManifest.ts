#!/usr/bin/env -S deno run --allow-net

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2016 Joyent, Inc.
 */

import { mainline } from "../mainline.ts";
import { parseRepoAndRef } from "@cloudydeno/docker-registry-client/common";
import { RegistryClientV2 } from "@cloudydeno/docker-registry-client/registry-client-v2";

// Shared mainline with examples/foo.js to get CLI opts.
const cmd = 'getManifest';
const {opts, args} = mainline({
    cmd,
    options: [{
        names: ['accept-list'],
        type: 'bool',
        help: 'Accept manifest lists (multiarch support) from the registry',
    }, {
        names: ['accept-oci'],
        type: 'bool',
        help: 'Accept OCI manifests (helm charts, etc) from the registry',
    }],
});
const name = args[0];
if (!name) {
    console.error('usage: examples/v2/%s.ts REPO[:TAG|@DIGEST]\n', cmd);
    Deno.exit(2);
}


// The interesting stuff starts here.
const rar = parseRepoAndRef(name);
const client = new RegistryClientV2({
    repo: rar,
    // log: log,
    insecure: opts.insecure,
    username: opts.username,
    password: opts.password,
    acceptOCIManifests: opts['accept-oci'],
});
const tagOrDigest = rar.tag || rar.digest || '';
const {resp, manifest} = await client.getManifest({
    ref: tagOrDigest,
    acceptManifestLists: opts['accept-list'],
});

console.error('# response headers');
console.table(Array.from(resp.headers));
console.error('# manifest');
console.log(manifest);
