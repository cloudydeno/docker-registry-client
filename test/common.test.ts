/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2015, Joyent, Inc.
 */

import { assertEquals, assertThrows } from "https://deno.land/std@0.92.0/testing/asserts.ts";
import { parseIndex, parseRepo, parseRepoAndRef, parseRepoAndTag } from "../lib/common.ts";

// --- Tests

Deno.test('parseRepoAndRef', () => {

    assertEquals(parseRepoAndRef('busybox'), {
        'index': {
            'name': 'docker.io',
            'official': true
        },
        'official': true,
        'remoteName': 'library/busybox',
        'localName': 'busybox',
        'canonicalName': 'docker.io/busybox',
        'tag': 'latest'
    });
    assertEquals(parseRepoAndRef('google/python'), {
        'index': {
            'name': 'docker.io',
            'official': true
        },
        'official': false,
        'remoteName': 'google/python',
        'localName': 'google/python',
        'canonicalName': 'docker.io/google/python',
        'tag': 'latest'
    });
    assertEquals(parseRepoAndRef('docker.io/ubuntu'), {
        'index': {
            'name': 'docker.io',
            'official': true
        },
        'official': true,
        'remoteName': 'library/ubuntu',
        'localName': 'ubuntu',
        'canonicalName': 'docker.io/ubuntu',
        'tag': 'latest'
    });
    assertEquals(parseRepoAndRef('localhost:5000/blarg'), {
        'index': {
            'name': 'localhost:5000',
            'official': false
        },
        'official': false,
        'remoteName': 'blarg',
        'localName': 'localhost:5000/blarg',
        'canonicalName': 'localhost:5000/blarg',
        'tag': 'latest'
    });

    assertEquals(parseRepoAndRef('localhost:5000/blarg:latest'), {
        'index': {
            'name': 'localhost:5000',
            'official': false
        },
        'official': false,
        'remoteName': 'blarg',
        'localName': 'localhost:5000/blarg',
        'canonicalName': 'localhost:5000/blarg',
        'tag': 'latest'
    });
    assertEquals(parseRepoAndRef('localhost:5000/blarg:mytag'), {
        'index': {
            'name': 'localhost:5000',
            'official': false
        },
        'official': false,
        'remoteName': 'blarg',
        'localName': 'localhost:5000/blarg',
        'canonicalName': 'localhost:5000/blarg',
        'tag': 'mytag'
    });
    assertEquals(parseRepoAndRef('localhost:5000/blarg@sha256:cafebabe'), {
        'index': {
            'name': 'localhost:5000',
            'official': false
        },
        'official': false,
        'remoteName': 'blarg',
        'localName': 'localhost:5000/blarg',
        'canonicalName': 'localhost:5000/blarg',
        'digest': 'sha256:cafebabe'
    });

    // With alternate default index.
    assertEquals(parseRepoAndRef('foo/bar', 'docker.io'), {
        'index': {
            'name': 'docker.io',
            'official': true
        },
        'official': false,
        'remoteName': 'foo/bar',
        'localName': 'foo/bar',
        'canonicalName': 'docker.io/foo/bar',
        'tag': 'latest'
    });

    const defaultIndexStr = 'https://myreg.example.com:1234';
    assertEquals(parseRepoAndRef('foo/bar', defaultIndexStr), {
        'index': {
            'scheme': 'https',
            'name': 'myreg.example.com:1234',
            'official': false
        },
        'official': false,
        'remoteName': 'foo/bar',
        'localName': 'myreg.example.com:1234/foo/bar',
        'canonicalName': 'myreg.example.com:1234/foo/bar',
        'tag': 'latest'
    });

    const defaultIndex = {
        'scheme': 'https',
        'name': 'myreg.example.com:1234',
        'official': false
    };
    assertEquals(parseRepoAndRef('foo/bar', defaultIndex), {
        'index': {
            'scheme': 'https',
            'name': 'myreg.example.com:1234',
            'official': false
        },
        'official': false,
        'remoteName': 'foo/bar',
        'localName': 'myreg.example.com:1234/foo/bar',
        'canonicalName': 'myreg.example.com:1234/foo/bar',
        'tag': 'latest'
    });
});


Deno.test('parseRepoAndTag', () => {

    assertEquals(parseRepoAndTag('busybox'), {
        'index': {
            'name': 'docker.io',
            'official': true
        },
        'official': true,
        'remoteName': 'library/busybox',
        'localName': 'busybox',
        'canonicalName': 'docker.io/busybox',
        'tag': 'latest'
    });
    assertEquals(parseRepoAndTag('google/python'), {
        'index': {
            'name': 'docker.io',
            'official': true
        },
        'official': false,
        'remoteName': 'google/python',
        'localName': 'google/python',
        'canonicalName': 'docker.io/google/python',
        'tag': 'latest'
    });
    assertEquals(parseRepoAndTag('docker.io/ubuntu'), {
        'index': {
            'name': 'docker.io',
            'official': true
        },
        'official': true,
        'remoteName': 'library/ubuntu',
        'localName': 'ubuntu',
        'canonicalName': 'docker.io/ubuntu',
        'tag': 'latest'
    });
    assertEquals(parseRepoAndTag('localhost:5000/blarg'), {
        'index': {
            'name': 'localhost:5000',
            'official': false
        },
        'official': false,
        'remoteName': 'blarg',
        'localName': 'localhost:5000/blarg',
        'canonicalName': 'localhost:5000/blarg',
        'tag': 'latest'
    });

    assertEquals(parseRepoAndTag('localhost:5000/blarg:latest'), {
        'index': {
            'name': 'localhost:5000',
            'official': false
        },
        'official': false,
        'remoteName': 'blarg',
        'localName': 'localhost:5000/blarg',
        'canonicalName': 'localhost:5000/blarg',
        'tag': 'latest'
    });
    assertEquals(parseRepoAndTag('localhost:5000/blarg:mytag'), {
        'index': {
            'name': 'localhost:5000',
            'official': false
        },
        'official': false,
        'remoteName': 'blarg',
        'localName': 'localhost:5000/blarg',
        'canonicalName': 'localhost:5000/blarg',
        'tag': 'mytag'
    });
    assertEquals(parseRepoAndTag('localhost:5000/blarg@sha256:cafebabe'), {
        'index': {
            'name': 'localhost:5000',
            'official': false
        },
        'official': false,
        'remoteName': 'blarg',
        'localName': 'localhost:5000/blarg',
        'canonicalName': 'localhost:5000/blarg',
        'digest': 'sha256:cafebabe'
    });

    // With alternate default index.
    assertEquals(parseRepoAndTag('foo/bar', 'docker.io'), {
        'index': {
            'name': 'docker.io',
            'official': true
        },
        'official': false,
        'remoteName': 'foo/bar',
        'localName': 'foo/bar',
        'canonicalName': 'docker.io/foo/bar',
        'tag': 'latest'
    });

    const defaultIndexStr = 'https://myreg.example.com:1234';
    assertEquals(parseRepoAndTag('foo/bar', defaultIndexStr), {
        'index': {
            'scheme': 'https',
            'name': 'myreg.example.com:1234',
            'official': false
        },
        'official': false,
        'remoteName': 'foo/bar',
        'localName': 'myreg.example.com:1234/foo/bar',
        'canonicalName': 'myreg.example.com:1234/foo/bar',
        'tag': 'latest'
    });

    const defaultIndex = {
        'scheme': 'https',
        'name': 'myreg.example.com:1234',
        'official': false
    };
    assertEquals(parseRepoAndTag('foo/bar', defaultIndex), {
        'index': {
            'scheme': 'https',
            'name': 'myreg.example.com:1234',
            'official': false
        },
        'official': false,
        'remoteName': 'foo/bar',
        'localName': 'myreg.example.com:1234/foo/bar',
        'canonicalName': 'myreg.example.com:1234/foo/bar',
        'tag': 'latest'
    });
});


Deno.test('parseRepo', () => {
    assertEquals(parseRepo('busybox'), {
        'index': {
            'name': 'docker.io',
            'official': true
        },
        'official': true,
        'remoteName': 'library/busybox',
        'localName': 'busybox',
        'canonicalName': 'docker.io/busybox'
    });
    assertEquals(parseRepo('google/python'), {
        'index': {
            'name': 'docker.io',
            'official': true
        },
        'official': false,
        'remoteName': 'google/python',
        'localName': 'google/python',
        'canonicalName': 'docker.io/google/python'
    });
    assertEquals(parseRepo('docker.io/ubuntu'), {
        'index': {
            'name': 'docker.io',
            'official': true
        },
        'official': true,
        'remoteName': 'library/ubuntu',
        'localName': 'ubuntu',
        'canonicalName': 'docker.io/ubuntu'
    });
    assertEquals(parseRepo('localhost:5000/blarg'), {
        'index': {
            'name': 'localhost:5000',
            'official': false
        },
        'official': false,
        'remoteName': 'blarg',
        'localName': 'localhost:5000/blarg',
        'canonicalName': 'localhost:5000/blarg'
    });

    // With alternate default index.
    assertEquals(parseRepo('foo/bar', 'docker.io'), {
        'index': {
            'name': 'docker.io',
            'official': true
        },
        'official': false,
        'remoteName': 'foo/bar',
        'localName': 'foo/bar',
        'canonicalName': 'docker.io/foo/bar'
    });

    const defaultIndexStr = 'https://myreg.example.com:1234';
    assertEquals(parseRepo('foo/bar', defaultIndexStr), {
        'index': {
            'scheme': 'https',
            'name': 'myreg.example.com:1234',
            'official': false
        },
        'official': false,
        'remoteName': 'foo/bar',
        'localName': 'myreg.example.com:1234/foo/bar',
        'canonicalName': 'myreg.example.com:1234/foo/bar'
    });

    const defaultIndex = {
        'scheme': 'https',
        'name': 'myreg.example.com:1234',
        'official': false
    };
    assertEquals(parseRepo('foo/bar', defaultIndex), {
        'index': {
            'scheme': 'https',
            'name': 'myreg.example.com:1234',
            'official': false
        },
        'official': false,
        'remoteName': 'foo/bar',
        'localName': 'myreg.example.com:1234/foo/bar',
        'canonicalName': 'myreg.example.com:1234/foo/bar'
    });

    assertThrows(() => {
        parseRepo('registry.gitlab.com/user@name/repo-a/repo-b');
    }, Error, 'invalid repository namespace');

    assertEquals(parseRepo('registry.gitlab.com/user.name/repo-a/repo-b'), {
        'index': {
            'name': 'registry.gitlab.com',
            'official': false
        },
        'official': false,
        'remoteName': 'user.name/repo-a/repo-b',
        'localName': 'registry.gitlab.com/user.name/repo-a/repo-b',
        'canonicalName': 'registry.gitlab.com/user.name/repo-a/repo-b'
    });
});


Deno.test('parseIndex', () => {
    assertEquals(parseIndex('docker.io'), {
        'name': 'docker.io',
        'official': true
    });
    assertEquals(parseIndex('index.docker.io'), {
        'name': 'docker.io',
        'official': true
    });
    assertEquals(parseIndex('https://docker.io'), {
        'name': 'docker.io',
        'official': true,
        'scheme': 'https'
    });
    assertThrows(() => {
        parseIndex('http://docker.io');
    }, Error, 'disallowed');
    assertEquals(parseIndex('index.docker.io'), {
        'name': 'docker.io',
        'official': true
    });
    assertEquals(parseIndex('quay.io'), {
        'name': 'quay.io',
        'official': false
    });
    assertEquals(parseIndex('https://quay.io'), {
        'name': 'quay.io',
        'official': false,
        'scheme': 'https'
    });
    assertEquals(parseIndex('http://quay.io'), {
        'name': 'quay.io',
        'official': false,
        'scheme': 'http'
    });
    assertEquals(parseIndex('localhost:5000'), {
        'name': 'localhost:5000',
        'official': false
    });

    assertThrows(() => {
        parseIndex('https://');
    }, Error, 'empty');
    assertThrows(() => {
        parseIndex('https://foo');
    }, Error, 'look');
    assertThrows(() => {
        parseIndex('foo');
    }, Error, 'look');

    assertEquals(parseIndex('docker.io/'), {
        'name': 'docker.io',
        'official': true
    });
    assertThrows(() => {
        parseIndex('docker.io/foo');
    }, Error, 'invalid');

    // Test special casing for this URL passed from 'docker login' by default.
    assertEquals(parseIndex('https://index.docker.io/v1/'), {
        'name': 'docker.io',
        'official': true
    });
});
