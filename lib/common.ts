/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { RegistryImage, RegistryIndex } from "./types.ts";

/*
 * Copyright 2016 Joyent, Inc.
 */

// --- globals

// var VERSION = require('../package.json').version;
// var DEFAULT_USERAGENT = 'node-docker-registry-client/' + VERSION +
//     ' (' + os.arch() + '-' + os.platform() + '; ' +
//    'node/' + process.versions.node + ')';
export const DEFAULT_USERAGENT = 'deno-docker_registry_client/' + '0.1.0' +
' (+'+import.meta.url+'; ' +
'deno/' + Deno.version + ')';

// See `INDEXNAME` in docker/docker.git:registry/config.go.
export const DEFAULT_INDEX_NAME = 'docker.io';
export const DEFAULT_INDEX_URL = 'https://index.docker.io';

export const DEFAULT_LOGIN_SERVERNAME = 'https://index.docker.io/v1/';


// JSSTYLED
// 'DEFAULTTAG' from https://github.com/docker/docker/blob/0c7b51089c8cd7ef3510a9b40edaa139a7ca91aa/graph/tags.go#L25
export const DEFAULT_TAG = 'latest';

const VALID_NS = /^[a-z0-9\._-]*$/;
const VALID_REPO = /^[a-z0-9_\/\.-]*$/;


// --- exports

export function splitIntoTwo(str: string, sep: string) {
    const slashIdx = str.indexOf(sep)
    return slashIdx == -1
        ? [str]
        : [str.slice(0, slashIdx), str.slice(slashIdx+1)];
}

/**
 * Parse a docker index name or index URL.
 *
 * Examples:
 *      docker.io               (no scheme implies 'https')
 *      index.docker.io         (normalized to docker.io)
 *      https://docker.io
 *      http://localhost:5000
 *      https://index.docker.io/v1/  (special case)
 *
 * Special case: By default `docker login` sends
 * "servername=https://index.docker.io/v1/". Let's not bork on that. It
 * simplifies `login()` and `ping()` argument handling in the clients to
 * handle this case here.
 *
 * @param {String} arg: Optional. Index name (optionally with leading scheme).
 */
export function parseIndex(arg?: string) {
    // assert.optionalString(arg, 'arg');

    var index = {} as RegistryIndex;

    if (!arg || arg === DEFAULT_LOGIN_SERVERNAME) {
        // Default index.
        index.name = DEFAULT_INDEX_NAME;
        index.official = true;
    } else {
        // Optional protocol/scheme.
        var indexName;
        var protoSepIdx = arg.indexOf('://');
        if (protoSepIdx !== -1) {
            var scheme = arg.slice(0, protoSepIdx);
            if (['http', 'https'].indexOf(scheme) === -1) {
                throw new Error('invalid index scheme, must be ' +
                    '"http" or "https": ' + arg);
            }
            index.scheme = scheme;
            indexName = arg.slice(protoSepIdx + 3);
        } else {
            indexName = arg;
        }

        if (!indexName) {
            throw new Error('invalid index, empty host: ' + arg);
        } else if (indexName.indexOf('.') === -1 &&
            indexName.indexOf(':') === -1 &&
            indexName !== 'localhost')
        {
            throw new Error(`invalid index, "${indexName}" does not look like a valid host: ${arg}`);
        } else {
            // Allow a trailing '/' as from some URL builder functions that
            // add a default '/' path to a URL, e.g. 'https://docker.io/'.
            if (indexName[indexName.length - 1] === '/') {
                indexName = indexName.slice(0, indexName.length - 1);
            }

            // Ensure no trailing repo.
            if (indexName.indexOf('/') !== -1) {
                throw new Error('invalid index, trailing repo: ' + arg);
            }
        }

        // Per docker.git's `ValidateIndexName`.
        if (indexName === 'index.' + DEFAULT_INDEX_NAME) {
            indexName = DEFAULT_INDEX_NAME;
        }

        index.name = indexName;
        index.official = Boolean(indexName === DEFAULT_INDEX_NAME);
    }

    // Disallow official and 'http'.
    if (index.official && index.scheme === 'http') {
        throw new Error('invalid index, HTTP to official index ' +
            'is disallowed: ' + arg);
    }

    return index;
}


/**
 * Parse a docker repo and tag string: [INDEX/]REPO[:TAG|@DIGEST]
 *
 * Examples:
 *    busybox
 *    google/python
 *    docker.io/ubuntu
 *    localhost:5000/blarg
 *    http://localhost:5000/blarg
 *
 * Dev Notes:
 * - This is meant to mimic
 *   docker.git:registry/config.go#ServiceConfig.NewRepositoryInfo
 *   as much as reasonable -- with the addition that we maintain the
 *   'tag' field.  Also, that we accept the scheme on the "INDEX" is
 *   different than docker.git's parsing.
 * - TODO: what about the '@digest' digest alternative to a tag? See:
 *   // JSSTYLED
 *   https://github.com/docker/docker/blob/0c7b51089c8cd7ef3510a9b40edaa139a7ca91aa/pkg/parsers/parsers.go#L68
 *
 * @param arg {String} The docker repo string to parse. See examples above.
 * @param defaultIndex {Object|String} Optional. The default index to use
 *      if not specified with `arg`. If not given the default is 'docker.io'.
 *      If given it may either be a string, e.g. 'https://myreg.example.com',
 *      or parsed index object, as from `parseIndex()`.
 */
export function parseRepo(arg: string, defaultIndex?: string | RegistryIndex) {
    var info = {} as RegistryImage;

    // Strip off optional leading `INDEX/`, parse it to `info.index` and
    // leave the rest in `remoteName`.
    var remoteName;
    var protoSepIdx = arg.indexOf('://');
    if (protoSepIdx !== -1) {
        // (A) repo with a protocol, e.g. 'https://host/repo'.
        var slashIdx = arg.indexOf('/', protoSepIdx + 3);
        if (slashIdx === -1) {
            throw new Error('invalid repository name, no "/REPO" after ' +
                'hostame: ' + arg);
        }
        var indexName = arg.slice(0, slashIdx);
        remoteName = arg.slice(slashIdx + 1);
        info.index = parseIndex(indexName);
    } else {
        var parts = splitIntoTwo(arg, '/');
        if (parts.length === 1 || (
            /* or if parts[0] doesn't look like a hostname or IP */
            parts[0].indexOf('.') === -1 &&
            parts[0].indexOf(':') === -1 &&
            parts[0] !== 'localhost'))
        {
            // (B) repo without leading 'INDEX/'.
            if (defaultIndex === undefined) {
                info.index = parseIndex();
            } else if (typeof (defaultIndex) === 'string') {
                info.index = parseIndex(defaultIndex);
            } else {
                info.index = defaultIndex;
            }
            remoteName = arg;
        } else {
            // (C) repo with leading 'INDEX/' (without protocol).
            info.index = parseIndex(parts[0]);
            remoteName = parts[1];
        }
    }

    // Validate remoteName (docker `validateRemoteName`).
    var nameParts = splitIntoTwo(remoteName, '/');
    var ns, name;
    if (nameParts.length === 2) {
        name = nameParts[1];

        // Validate ns.
        ns = nameParts[0];
        if (ns.length < 2 || ns.length > 255) {
            throw new Error('invalid repository namespace, must be between ' +
                '2 and 255 characters: ' + ns);
        }
        if (! VALID_NS.test(ns)) {
            throw new Error('invalid repository namespace, may only contain ' +
                '[a-z0-9._-] characters: ' + ns);
        }
        if (ns[0] === '-' && ns[ns.length - 1] === '-') {
            throw new Error('invalid repository namespace, cannot start or ' +
                'end with a hypen: ' + ns);
        }
        if (ns.indexOf('--') !== -1) {
            throw new Error('invalid repository namespace, cannot contain ' +
                'consecutive hyphens: ' + ns);
        }
    } else {
        name = remoteName;
        if (info.index.official) {
            ns = 'library';
        }
    }

    // Validate name.
    if (! VALID_REPO.test(name)) {
        throw new Error('invalid repository name, may only contain ' +
            '[a-z0-9_/.-] characters: ' + name);
    }


    info.official = false;
    if (info.index.official) {
        info.remoteName = ns + '/' + name;
        if (ns === 'library') {
            info.official = true;
            info.localName = name;
        } else {
            info.localName = info.remoteName;
        }
        info.canonicalName = DEFAULT_INDEX_NAME + '/' + info.localName;
    } else {
        if (ns) {
            info.remoteName = ns + '/' + name;
        } else {
            info.remoteName = name;
        }
        info.localName = info.index.name + '/' + info.remoteName;
        info.canonicalName = info.localName;
    }

    return info;
}


/**
 * Parse a docker repo and tag/digest string: [INDEX/]REPO[:TAG|@DIGEST]
 *
 * Examples:
 *    busybox
 *    busybox:latest
 *    google/python:3.3
 *    docker.io/ubuntu
 *    localhost:5000/blarg
 *    http://localhost:5000/blarg:latest
 *    alpine@sha256:fb9f16730ac6316afa4d97caa5130219927bfcecf0b0...
 *
 * Dev Notes:
 * - TODO Validation on digest and tag would be nice.
 *
 * @param arg {String} The docker repo:tag string to parse. See examples above.
 * @param defaultIndex {Object|String} Optional. The default index to use
 *      if not specified with `arg`. If not given the default is 'docker.io'.
 *      If given it may either be a string, e.g. 'https://myreg.example.com',
 *      or parsed index object, as from `parseIndex()`.
 */
export function parseRepoAndRef(arg: string, defaultIndex?: string | RegistryIndex) {
    // Parse off the tag/digest per
    // JSSTYLED
    // https://github.com/docker/docker/blob/0c7b51089c8cd7ef3510a9b40edaa139a7ca91aa/pkg/parsers/parsers.go#L69
    var repo, tag, digest;
    var atIdx = arg.lastIndexOf('@');
    if (atIdx !== -1) {
        repo = arg.slice(0, atIdx);
        digest = arg.slice(atIdx + 1);
    } else {
        var colonIdx = arg.lastIndexOf(':');
        var slashIdx = arg.lastIndexOf('/');
        if (colonIdx !== -1 && colonIdx > slashIdx) {
            repo = arg.slice(0, colonIdx);
            tag = arg.slice(colonIdx + 1);
        } else {
            repo = arg;
        }
    }

    var info = parseRepo(repo, defaultIndex);
    if (digest) {
        info.digest = digest;
    } else if (tag) {
        info.tag = tag;
    } else {
        info.tag = DEFAULT_TAG;
    }

    return info;
}

export const parseRepoAndTag = parseRepoAndRef;


/**
 * Similar in spirit to docker.git:registry/endpoint.go#NewEndpoint().
 */
export function urlFromIndex(index: RegistryIndex) {
    // assert.bool(index.official, 'index.official');
    // assert.optionalString(index.scheme, 'index.scheme');
    // assert.string(index.name, 'index.name');

    if (index.official) {  // v1
        return DEFAULT_INDEX_URL;
    } else {
        return `${index.scheme || 'https'}://${index.name}`;
    }
}


export function isLocalhost(host: string) {
    var lead = host.split(':')[0];
    if (lead === 'localhost' || lead === '127.0.0.1') {
        return true;
    } else {
        return false;
    }
}
