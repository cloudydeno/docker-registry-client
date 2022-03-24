/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { assertEquals } from "https://deno.land/std@0.130.0/testing/asserts.ts";
import { digestFromManifestStr } from "../lib/registry-client-v2.ts";

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

// --- Tests

Deno.test('digestFromManifestStr', () => {
    var v2Manifest = {
        'schemaVersion': 2,
        'mediaType': 'application/vnd.docker.distribution.manifest.v2+json',
        'config': {
            'mediaType': 'application/vnd.docker.container.image.v1+json',
            'size': 2372,
            'digest': 'sha256:ea880aeae3c3e357bbb7bb715f0f63f086038c7d279736d7f32960064951c00a'
        },
        'layers': [
            {
                'mediaType': 'application/vnd.docker.image.rootfs.diff.tar',
                'size': 10240,
                'digest': 'sha256:84ff92691f909a05b224e1c56abb4864f01b4f8e3c854e4bb4c7baf1d3f6d652'
            },
            {
                'mediaType': 'application/vnd.docker.image.rootfs.diff.tar',
                'size': 3573760,
                'digest': 'sha256:483a41b4dbd5bb9bf388f24139441aa9b90735992ed8f31ec2092eb024d99130'
            },
            {
                'mediaType': 'application/vnd.docker.image.rootfs.diff.tar',
                'size': 10240,
                'digest': 'sha256:84ff92691f909a05b224e1c56abb4864f01b4f8e3c854e4bb4c7baf1d3f6d652'
            },
            {
                'mediaType': 'application/vnd.docker.image.rootfs.diff.tar',
                'size': 10240,
                'digest': 'sha256:208e4cb1d5e8c6fdfadc4329baf4002821fe5e5359626336f64f0005737af272'
            }
        ]
    };
    var v2ManifestStr = JSON.stringify(v2Manifest);
    var v2Digest = digestFromManifestStr(v2ManifestStr);
    assertEquals(v2Digest, 'sha256:28a63cc341ad4ad7ba7de0af4061ca8068e425ecca4e2c4c326dd8d07442ab71');
});
