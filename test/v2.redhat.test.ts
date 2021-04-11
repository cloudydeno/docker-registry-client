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

import { assertEquals, assert } from "https://deno.land/std@0.92.0/testing/asserts.ts";
import { createClient } from "../lib/registry-client-v2.ts";
import { parseRepo } from "../lib/common.ts";
import { assertThrowsHttp } from "./util.ts";

// --- globals

const REPO = 'registry.access.redhat.com/rhel';
const TAG = 'latest';

const repo = parseRepo(REPO);
const clientOpts = {
    maxSchemaVersion: 1,
    name: REPO,
};

// --- Tests

Deno.test('v2 registry.access.redhat.com / createClient', () => {
    const client = createClient(clientOpts);
    assert(client);
    assertEquals(client.version, 2);
});

Deno.test('v2 registry.access.redhat.com / supportsV2', async () => {
    const client = createClient(clientOpts);
    const supportsV2 = await client.supportsV2();
    assert(supportsV2, 'supportsV2');
});

Deno.test('v2 registry.access.redhat.com / ping', async () => {
    const client = createClient(clientOpts);
    const res = await client.ping();
    assert(res, 'have a response');
    assertEquals(res.status, 200);
    assertEquals(res.headers.get('docker-distribution-api-version'),
        'registry/2.0');
});

Deno.test('v2 registry.access.redhat.com / getManifest (no redirects)', async () => {
    const client = createClient(clientOpts);
    const {resp} = await assertThrowsHttp(async () => {
        await client.getManifest({ref: TAG, followRedirects: false});
    });
    assertEquals(resp.status, 302);
});

Deno.test('v2 registry.access.redhat.com / getManifest (redirected)', async () => {
    const client = createClient(clientOpts);
    const {manifest} = await client.getManifest({ref: TAG});
    assert(manifest, 'Got the manifest');
    assertEquals(manifest.schemaVersion, 1);
    assert(manifest.schemaVersion == 1);
    assertEquals(manifest.name, repo.remoteName);
    assertEquals(manifest.tag, TAG);
    assert(manifest.architecture);
    assert(manifest.fsLayers);
    assert(manifest.history![0].v1Compatibility);
    assert(manifest.signatures![0].signature);
});
