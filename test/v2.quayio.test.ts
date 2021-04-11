/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2017, Joyent, Inc.
 */

import { assertEquals, assert, assertThrowsAsync } from "https://deno.land/std@0.92.0/testing/asserts.ts";
import { createClient } from "../lib/registry-client-v2.ts";
import { parseRepo } from "../lib/common.ts";
import { ManifestV1 } from "../lib/types.ts";
import { dirname } from "https://deno.land/std@0.92.0/path/posix.ts";
import { Sha256 } from "https://deno.land/std@0.92.0/hash/sha256.ts";

// --- globals

const REPO = 'quay.io/coreos/etcd';
const repo = parseRepo(REPO);
// Note: Not using TAG='latest' as a workaround for
// <https://github.com/joyent/node-docker-registry-client/issues/12>.
const TAG = 'v2.0.0';

// --- Tests

Deno.test('v2 quay.io / createClient', () => {
    const client = createClient({ repo });
    assertEquals(client.version, 2);
});

Deno.test('v2 quay.io / supportsV2', async () => {
    const client = createClient({ repo });
    const supportsV2 = await client.supportsV2();
    assertEquals(supportsV2, true);
});

Deno.test('v2 quay.io / ping', async () => {
    const client = createClient({ repo });
    const res = await client.ping();
    assertEquals(res.status, 401);
    assert(res.headers.get('www-authenticate'));
    assertEquals(res.headers.get('docker-distribution-api-version'), 'registry/2.0');
});

/*
    * Example expected output:
    *  {
    *      "name": "library/alpine",
    *      "tags": [ "2.6", "2.7", "3.1", "3.2", "edge", "latest" ]
    *  }
    */
Deno.test('v2 quay.io / listTags', async () => {
    const client = createClient({ repo });
    const tags = await client.listTags();
    assertEquals(tags.name, repo.remoteName);
    assert(tags.tags.indexOf(TAG) !== -1,
        'tag "'+TAG+'" in listTags:' + JSON.stringify(tags));
});

/*
    *  {
    *      "name": <name>,
    *      "tag": <tag>,
    *      "fsLayers": [
    *         {
    *            "blobSum": <tarsum>
    *         },
    *         ...
    *      ],
    *      "history": <v1 images>,
    *      "signature": <JWS>
    *  }
    */
let _manifest: ManifestV1 | null;
let _manifestDigest: string | null;
Deno.test('v2 quay.io / getManifest', async () => {
    const client = createClient({ repo });
    const {manifest, resp} = await client.getManifest({ref: TAG});
    _manifestDigest = resp.headers.get('docker-content-digest');
    assert(manifest);
    assertEquals(manifest.schemaVersion, 1);
    assert(manifest.schemaVersion === 1);
    _manifest = manifest ?? null;
    assertEquals(manifest.name, repo.remoteName);
    assertEquals(manifest.tag, TAG);
    assert(manifest.architecture);
    assert(manifest.fsLayers);
    assert(manifest.history?.[0].v1Compatibility);
    assert(manifest.signatures?.[0].signature);
});

Deno.test('v2 quay.io / getManifest (by digest)', async () => {
    if (!_manifestDigest || !_manifest) throw new Error('cannot test');
    const client = createClient({ repo });
    const {manifest} = await client.getManifest({ref: _manifestDigest});
    assert(manifest);
    assertEquals(_manifest.schemaVersion, manifest.schemaVersion);
    assert(manifest.schemaVersion === 1);
    assertEquals(_manifest.name, manifest.name);
    assertEquals(_manifest.tag, manifest.tag);
    assertEquals(_manifest.architecture, manifest.architecture);
});

Deno.test('v2 quay.io / getManifest (unknown tag)', async () => {
    const client = createClient({ repo });
    await assertThrowsAsync(async () => {
        await client.getManifest({ref: 'unknowntag'});
    }, Error, ' 404 ');
});

Deno.test('v2 quay.io / getManifest (unknown repo)', async () => {
    const client = createClient({
        maxSchemaVersion: 2,
        name: dirname(REPO) + '/unknownreponame',
        // log: log
    });
    await assertThrowsAsync(async () => {
        await client.getManifest({ref: 'latest'});
    }, Error, 'Not Found');
});

Deno.test('v2 quay.io / getManifest (bad username/password)', async () => {
    const client = createClient({
        maxSchemaVersion: 2,
        repo,
        username: 'fredNoExistHere',
        password: 'fredForgot',
        // log: log
    });
    await assertThrowsAsync(async () => {
        await client.getManifest({ref: 'latest'});
    }, Error, ' 401 ');
});

Deno.test('v2 quay.io / headBlob', async () => {
    if (!_manifest) throw new Error('cannot test');
    const client = createClient({ repo });
    var digest = _manifest.fsLayers[0].blobSum;
    const ress = await client.headBlob({digest: digest});
    assert(ress);
    assert(Array.isArray(ress));
    var first = ress[0];
    assert(first.status === 200 || first.status === 307);
    assertEquals(first.headers.get('docker-content-digest'), digest);

    // Docker-Distribution-Api-Version header:
    // docker.io includes this header here, quay.io does not.
    // assertEquals(first.headers.get('docker-distribution-api-version'),
    //    'registry/2.0');

    var last = ress[ress.length - 1];
    assert(last);
    assertEquals(last.status, 200);

    // Content-Type:
    // - docker.io gives 'application/octet-stream', which is what
    //   I'd expect for the GET response at least.
    // - quay.io current v2 support gives: 'text/html; charset=utf-8'
    // if (!SKIP_QUAY_IO_BUGLETS) {
        assertEquals(last.headers.get('content-type'),
            'application/octet-stream');
    // }

    assert(last.headers.get('content-length'));
});

Deno.test('v2 quay.io / headBlob (unknown digest)', async () => {
    const client = createClient({ repo });

    await assertThrowsAsync(async () => {
        await client.headBlob({digest: 'cafebabe'});
    }, Error, ' 405 ');
    // - docker.io gives 404, which is what I'd expect
    // - quay.io gives 405 (Method Not Allowed). Hrm.
    // The spec doesn't specify:
    // https://docs.docker.com/registry/spec/api/#existing-layers

    // docker.io includes this header here, quay.io does not.
    // assertEquals(res.headers['docker-distribution-api-version'],
    //    'registry/2.0');
});

Deno.test('v2 quay.io / createBlobReadStream', async () => {
    if (!_manifestDigest || !_manifest) throw new Error('cannot test');
    const client = createClient({ repo });
    const digest = _manifest.fsLayers[0].blobSum;
    const {ress, stream} = await client.createBlobReadStream({digest: digest});
    assert(ress, 'got responses');
    assert(Array.isArray(ress), 'ress is an array');

    const first = ress[0];
    assert(first.status === 200 || first.status === 307 || first.status === 302,
        `createBlobReadStream first res statusCode is 200 or 307, was ${first.status}`);
    if (first.headers.get('docker-content-digest')) {
        assertEquals(first.headers.get('docker-content-digest'), digest);
    }
    // assertEquals(first.headers.get('docker-distribution-api-version'), 'registry/2.0');

    const last = ress.slice(-1)[0];
    assert(last, 'got a stream');
    assertEquals(last.status, 200);
    // Quay.io gives `Content-Type: binary/octet-stream` which has to
    // be a bug. AFAIK that isn't a real MIME type. Should be application/octet-stream
    assertEquals(last.headers.get('content-type'), 'binary/octet-stream');
    assert(last.headers.get('content-length') !== undefined,
        'got a "content-length" header');

    var numBytes = 0;
    const hash = new Sha256();
    for await (const chunk of stream) {
        hash.update(chunk);
        numBytes += chunk.length;
    }
    assertEquals(hash.hex(), digest.split(':')[1]);
    assertEquals(numBytes, Number(last.headers.get('content-length')));
});

Deno.test('v2 quay.io / createBlobReadStream (unknown digest)', async () => {
    const client = createClient({ repo });
    await assertThrowsAsync(async () => {
        await client.createBlobReadStream({digest: 'cafebabe'})
    }, Error, ' 405 '); // Not too sure why this is a 405 instead of a 404

    // Docker-Distribution-Api-Version header:
    // docker.io includes this header here, quay.io does not.
    // assertEquals(res.headers['docker-distribution-api-version'],
    //    'registry/2.0');
});
