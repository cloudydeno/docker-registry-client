![Deno CI](https://github.com/cloudydeno/deno-docker_registry_client/workflows/CI/badge.svg?branch=main)

# Deno `/x/docker_registry_client`

A port of a Docker Registry API V2 client.

The [original Node.JS project](https://github.com/joyent/node-docker-registry-client)
README included these notes:

> Limitations: Currently only support for [...] Registry API v2 *pull* support.
> Support for v2 push endpoints is coming.
>
> Note: This repository is part of the Joyent Triton project. See the
> [contribution guidelines](https://github.com/joyent/triton/blob/master/CONTRIBUTING.md)
> and general documentation at the main
> [Triton project](https://github.com/joyent/triton) page.

## Design Points

* Only handling the v2 Registry API.
* Typescript, async/await, Promises, `fetch()`
* Focus on image management.
    For example, listing and deleting tags.
* I'm mostly using gcr.io though there's also some tests against major registries.

## Auth Approaches

* Dockerhub: normal user/password
* Github: `-u $USERNAME -p $GITHUB_TOKEN`
    * like with Github API, username can likely be anything (haven't confirmed)
* AWS ECR: `-u AWS -p $(aws ecr get-login-password)`
    * you need AWS auth even for 'public' images
* Gcloud GCR: `-u oauth2accesstoken -p $(gcloud auth print-access-token)`

## Overview

Most usage of this package involves creating a *Registry* API client for a
specific *repository* and calling its methods.

A Registry client requires a repository name (called a `repo` in the code):

```sh
[INDEX/]NAME                # a "repo name"
```

Examples:

```sh
mongo                       # implies default index (docker.io) and namespace (library)
docker.io/mongo             # same thing
docker.io/library/mongo     # same thing

myreg.example.com:5000/busybox   # a "busybox" repo on a private registry

quay.io/trentm/foo          # trentm's "foo" repo on the quay.io service
```

The `parseRepo` function is used to parse these. See "examples/parseRepo.ts"
to see how they are parsed:

```json
$ ./examples/parseRepo.ts mongo
{
    "index": {
        "name": "docker.io",
        "official": true
    },
    "official": true,
    "remoteName": "library/mongo",
    "localName": "mongo",
    "canonicalName": "docker.io/mongo"
}
```

Commonly, a "repo name and tag" string is used for working with a Docker
registry, e.g. `docker pull busybox:latest`. The v2 API adds support for using
"repo name and digest" to stably identify images, e.g. `docker pull
alpine@sha256:fb9f16730ac6316afa4d97caa5130219927bfcecf0b0ce35c01dcb612f449739`.
This package provides a `parseRepoAndRef` (and the synonym `parseRepoAndTag`)
for that, e.g.:

```json
$ ./examples/parseRepoAndRef.ts myreg.example.com:5000/busybox:foo
{
    "index": {
        "name": "myreg.example.com:5000",
        "official": false
    },
    "official": false,
    "remoteName": "busybox",
    "localName": "myreg.example.com:5000/busybox",
    "canonicalName": "myreg.example.com:5000/busybox",
    "tag": "foo"
}
```

Slightly different than docker.git's parsing, this package allows the
scheme to be given on the index:

```json
$ ./examples/parseRepoAndRef.ts https://quay.io/trentm/foo
{
    "index": {
        "scheme": "https",              // <--- scheme
        "name": "quay.io",
        "official": false
    },
    "official": false,
    "remoteName": "trentm/foo",
    "localName": "quay.io/trentm/foo",
    "canonicalName": "quay.io/trentm/foo",
    "tag": "latest"                     // <--- default to 'latest' tag
}
```

If a scheme isn't given, then "https" is assumed.


## Usage

Check out [the README in lib/](./lib/README.md).

## v2 API

See ["examples/v2/*.ts"](./examples/) for short code examples one can run from
the CLI for each API endpoint. E.g.:

```json
$ ./examples/v2/listTags.ts busybox
{
    "name": "library/busybox",
    "tags": [
        "buildroot-2013.08.1",
        "buildroot-2014.02",
        "latest",
        "ubuntu-12.04",
        "ubuntu-14.04"
    ]
}
```

~~You can also get logging on processing and HTTP requests/responses via the
`-v` option to the example scripts.~~

```json
$ ./examples/v2/listTags.ts -v busybox
// NOTE: verbose logging is not currently implemented
{
    "name": "library/busybox",
    "tags": [
        "buildroot-2013.08.1",
        "buildroot-2014.02",
        "latest",
        "ubuntu-12.04",
        "ubuntu-14.04"
    ]
}
```


## v1 API

Not implemented. I see no reason to maintain v1 client code.

## Development

### Naming convensions

For naming this package attempts to consistently use `repo` for repository,
`img` for image, etc.
