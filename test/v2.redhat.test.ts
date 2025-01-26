/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2017, Joyent, Inc.
 */

/*
 * Test v2 Registry API against <registry.access.redhat.com>.
 */


import {
    assert, assertEquals, assertThrowsHttp,
} from "./util.ts";

import { RegistryClientV2 } from "../lib/registry-client-v2.ts";
import { parseRepo, MEDIATYPE_MANIFEST_V2 } from "../lib/common.ts";

// --- globals

const REPO = 'registry.access.redhat.com/rhel';
const TAG = 'latest';

const repo = parseRepo(REPO);

// --- Tests

Deno.test('v2 registry.access.redhat.com / RegistryClientV2', () => {
    const client = new RegistryClientV2({ name: REPO });
    assert(client);
    assertEquals(client.version, 2);
});

Deno.test('v2 registry.access.redhat.com / supportsV2', async () => {
    const client = new RegistryClientV2({ name: REPO });
    const supportsV2 = await client.supportsV2();
    assert(supportsV2, 'supportsV2');
});

Deno.test('v2 registry.access.redhat.com / ping', async () => {
    const client = new RegistryClientV2({ name: REPO });
    const res = await client.ping();
    assert(res, 'have a response');
    assertEquals(res.status, 200);
    assertEquals(res.headers.get('docker-distribution-api-version'),
        'registry/2.0');
});

// Looks like this endpoint stopped redirecting.
// Deno.test('v2 registry.access.redhat.com / getManifest (no redirects)', async () => {
//     const client = new RegistryClientV2({ name: REPO });
//     const {resp} = await assertThrowsHttp(async () => {
//         await client.getManifest({ref: TAG, followRedirects: false});
//     });
//     assertEquals(resp.status, 302);
// });

Deno.test('v2 registry.access.redhat.com / getManifest (redirected)', async () => {
    const client = new RegistryClientV2({ name: REPO });
    const {manifest} = await client.getManifest({ref: TAG});
    assert(manifest, 'Got the manifest');
    assertEquals(manifest.schemaVersion, 2);
    assert(manifest.schemaVersion == 2);
    assertEquals(manifest.mediaType, MEDIATYPE_MANIFEST_V2);
    assert(manifest.mediaType === MEDIATYPE_MANIFEST_V2);
    assert(manifest.config.digest);
    assert(manifest.layers[0].digest);
});
