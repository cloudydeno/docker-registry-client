/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2017, Joyent, Inc.
 */

import {
    assert, assertEquals, assertThrowsHttp,
    getFirstLayerDigestFromManifest,
    hashAndCount,
} from "./util.ts";

import { digestFromManifestStr, RegistryClientV2 } from "../lib/registry-client-v2.ts";
import { parseRepo, MEDIATYPE_OCI_MANIFEST_INDEX_V1 } from "../lib/common.ts";
import { ManifestOCIIndex } from "../lib/types.ts";

// --- globals

const REPO = 'busybox';
const TAG = 'latest';

// --- Tests

const repo = parseRepo(REPO);

Deno.test('v2 docker.io / RegistryClientV2', async () => {
    const client = new RegistryClientV2({ repo });
    assert(client);
    assertEquals(client.version, 2);
});

Deno.test('v2 docker.io / ping', async () => {
    const client = new RegistryClientV2({ repo });
    const res = await client.ping();
    assert(res, 'have a response');
    assertEquals(res.status, 401);
    assert(res.headers.get('www-authenticate'));
});

/*
    * Example expected output:
    *  {
    *      "name": "library/alpine",
    *      "tags": [ "2.6", "2.7", "3.1", "3.2", "edge", "latest" ]
    *  }
    */
Deno.test('v2 docker.io / listTags', async () => {
    const client = new RegistryClientV2({ repo });
    const tags = await client.listTags();
    assert(tags);
    assertEquals(tags.name, repo.remoteName);
    assert(tags.tags.indexOf(TAG) !== -1, 'no "'+TAG+'" tag');
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
Deno.test('v2 docker.io / getManifest (v2.1)', async () => {
    const client = new RegistryClientV2({ repo });
    const {manifest} = await client.getManifest({ref: TAG});
    assert(manifest);
    assertEquals(manifest.schemaVersion, 2);
    assert(manifest.schemaVersion === 2);
    assertEquals(manifest.mediaType, MEDIATYPE_OCI_MANIFEST_INDEX_V1);
    assert(manifest.mediaType === MEDIATYPE_OCI_MANIFEST_INDEX_V1);
    assert(manifest.manifests[0].digest);
});

let _manifest: ManifestOCIIndex | null;
let _manifestDigest: string | null;

/*
    * {
    *   "schemaVersion": 2,
    *   "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
    *   "config": {
    *     "mediaType": "application/octet-stream",
    *     "size": 1459,
    *     "digest": "sha256:2b8fd9751c4c0f5dd266fc...01"
    *   },
    *   "layers": [
    *     {
    *       "mediaType": "application/vnd.docker.image.rootfs.diff.tar.gzip",
    *       "size": 667590,
    *       "digest": "sha256:8ddc19f16526912237dd8af...a9"
    *     }
    *   ]
    * }
    */
Deno.test('v2 docker.io / getManifest (v2.2)', async () => {
    const client = new RegistryClientV2({ repo });
    const {manifest, resp} = await client.getManifest({ ref: TAG });
    assert(manifest);
    assertEquals(manifest.schemaVersion, 2);
    assert(manifest.schemaVersion === 2);
    assert(manifest.mediaType === MEDIATYPE_OCI_MANIFEST_INDEX_V1);
    _manifest = manifest;
    _manifestDigest = resp.headers.get('docker-content-digest');
    assert(manifest.mediaType);
    assert(manifest.manifests);
    assert(manifest.manifests.length > 0);

    const manifestStr = new TextDecoder().decode(await resp.dockerBody());
    const computedDigest = await digestFromManifestStr(manifestStr);
    assertEquals(computedDigest, _manifestDigest);
});

/*
    * Note this test requires that the manifest be pulled in the v2.2 format,
    * otherwise you will get a manifest not found error.
    */
Deno.test('v2 docker.io / getManifest (by digest)', async () => {
    if (!_manifestDigest || !_manifest) throw new Error('cannot test');
    const client = new RegistryClientV2({ repo });
    const {manifest} = await client.getManifest({ ref: _manifestDigest });
    assert(manifest, 'Got the manifest object');
    assertEquals(_manifest!.schemaVersion, manifest.schemaVersion);
    assert(manifest.schemaVersion === 2);
    assert(manifest.mediaType === MEDIATYPE_OCI_MANIFEST_INDEX_V1);
    assertEquals(_manifest!.manifests, manifest.manifests);
});

Deno.test('v2 docker.io / getManifest (unknown tag)', async () => {
    const client = new RegistryClientV2({ repo });
    await assertThrowsHttp(async () => {
        await client.getManifest({ref: 'unknowntag'});
    }, 404);
});

Deno.test('v2 docker.io / getManifest (unknown repo)', async () => {
    const client = new RegistryClientV2({
        name: 'unknownreponame',
    });
    await assertThrowsHttp(async () => {
        await client.getManifest({ref: 'latest'});
    }, 401);
});

Deno.test('v2 docker.io / getManifest (bad username/password)', async () => {
    const client = new RegistryClientV2({
        repo,
        username: 'fredNoExistHere',
        password: 'fredForgot',
    });
    await assertThrowsHttp(async () => {
        await client.getManifest({ref: 'latest'});
    }, 401);
});

Deno.test('v2 docker.io / headBlob', async () => {
    if (!_manifestDigest || !_manifest) throw new Error('cannot test');
    const client = new RegistryClientV2({ repo });

    const firstImageManifest = await client.getManifest({
        ref: _manifest.manifests[0].digest,
    }).then(x => x.manifest);
    const digest = getFirstLayerDigestFromManifest(firstImageManifest);

    const ress = await client.headBlob({digest: digest});
    assert(ress, 'got a "ress"');
    assert(Array.isArray(ress), '"ress" is an array');
    const first = ress[0];
    assert(first.status === 200 || first.status === 307,
        'first response statusCode is 200 or 307');
    if (first.headers.get('docker-content-digest')) {
        assertEquals(first.headers.get('docker-content-digest'), digest,
            '"docker-content-digest" header from first response is '
            + 'the queried digest');
    }
    assertEquals(first.headers.get('docker-distribution-api-version'),
        'registry/2.0',
        '"docker-distribution-api-version" header is "registry/2.0"');
    const last = ress[ress.length - 1];
    assertEquals(last.status, 200, 'last response statusCode is 200');
    const contentType = last.headers.get('content-type');
    assert(['application/octet-stream', 'application/x-gzip']
        .indexOf(contentType ?? '') !== -1,
        'content-type is as expected, got ' + contentType);
    assert(last.headers.get('content-length'));
});

Deno.test('v2 docker.io / headBlob (unknown digest)', async () => {
    const client = new RegistryClientV2({ repo });
    const {resp} = await assertThrowsHttp(async () => {
        await client.headBlob({digest: 'cafebabe'});
    }, 404);
    assertEquals(resp.headers.get('docker-distribution-api-version'),
        'registry/2.0');
});

Deno.test('v2 docker.io / createBlobReadStream', async () => {
    if (!_manifestDigest || !_manifest) throw new Error('cannot test');
    const client = new RegistryClientV2({ repo });

    const firstImageManifest = await client.getManifest({
        ref: _manifest.manifests[0].digest,
    }).then(x => x.manifest);
    const digest = getFirstLayerDigestFromManifest(firstImageManifest);

    const {ress, stream} = await client.createBlobReadStream({digest: digest});
    assert(ress, 'got responses');
    assert(Array.isArray(ress), 'ress is an array');

    const first = ress[0];
    assert(first.status === 200 || first.status === 307,
        'createBlobReadStream first res statusCode is 200 or 307');
    if (first.headers.get('docker-content-digest')) {
        assertEquals(first.headers.get('docker-content-digest'), digest,
            '"docker-content-digest" header from first response is '
            + 'the queried digest');
    }
    assertEquals(first.headers.get('docker-distribution-api-version'),
        'registry/2.0',
        '"docker-distribution-api-version" header is "registry/2.0"');

    const last = ress.slice(-1)[0];
    assert(last, 'got a stream');
    assertEquals(last.status, 200, 'stream statusCode is 200');
    assertEquals(last.headers.get('content-type'), 'application/octet-stream');
    assert(last.headers.get('content-length') !== undefined,
        'got a "content-length" header');

    const {hashHex, numBytes} = await hashAndCount(digest.split(':')[0], stream);
    assertEquals(hashHex, digest.split(':')[1]);
    assertEquals(numBytes, Number(last.headers.get('content-length')));
});

Deno.test('v2 docker.io / createBlobReadStream (unknown digest)', async () => {
    const client = new RegistryClientV2({ repo });
    const {resp} = await assertThrowsHttp(async () => {
        await client.createBlobReadStream({digest: 'cafebabe'})
    }, 404);
    assertEquals(resp.headers.get('docker-distribution-api-version'),
        'registry/2.0');
});
