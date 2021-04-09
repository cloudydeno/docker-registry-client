![Deno CI](https://github.com/cloudydeno/deno-docker_registry_client/workflows/Deno%20CI/badge.svg?branch=main)

# Deno `/x/docker_registry_client`

A port of a Docker Registry API client.

The [original Node.JS project](https://github.com/joyent/node-docker-registry-client)
README included these notes:

> Limitations: Currently only support for Registry API v1
> (<https://docs.docker.com/v1.6/reference/api/registry_api/>) *pull* support
> (i.e. excluding API endpoints for push) and Registry API v2 *pull* support.
> Support for v2 push endpoints is coming.
>
> Note: This repository is part of the Joyent Triton project. See the
> [contribution guidelines](https://github.com/joyent/triton/blob/master/CONTRIBUTING.md)
> and general documentation at the main
> [Triton project](https://github.com/joyent/triton) page.

## Design Points

* Only handling the v2 Registry API.
    * I can't imagine a reason to keep the v1 API code at all.
        Please let me know if you have any such reasoning.
        I'm going to delete it otherwise.
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

If you know, for example, that you are only dealing with a v2 Docker Registry,
then simple usage will look like this:

```typescript
import { createClient } from 'https://deno.land/x/docker_registry_client/registry-client-v2.ts';
var REPO = 'alpine';
var client = createClient({name: REPO});

const tags = await client.listTags();
// ...
console.log(JSON.stringify(tags, null, 4));
```

A more complete example (showing auth, etc.):

```typescript
import { createClient } from 'https://deno.land/x/docker_registry_client/registry-client-v2.ts';

var REPO = 'alpine';
var client = createClient({
    name: REPO,
    // Optional basic auth to the registry
    username: <username>,
    password: <password>,
    // Optional, for a registry without a signed TLS certificate.
    // NOTE: Deno does not currently support this option
    // insecure: <true|false>,
    // ... see the source code for other options
});
```

This package also supports the nominal technique for pinging the registry
to see if it supports v2, otherwise falling back to v1:

```typescript
import { createClient } from 'https://deno.land/x/docker_registry_client/index.ts';

var REPO = 'alpine';
const client = await createClient({name: REPO, /* ... */});
console.log('Got a Docker Registry API v%d client', client.version);
```

NOTE: This port does not include v1 support


## v2 API

A mapping of the [Docker Registry API v2
endpoints](https://docs.docker.com/registry/spec/api/#detail) to the API
equivalents in this client lib.

| Name / Endpoint      | Implemented | Description |
| -------------------- | ----------- | ----------- |
| ping <br> `GET /v2/`                | Yes  | Check that the endpoint implements Docker Registry API V2. |
| listTags <br> `GET /v2/<name>/tags/list`            | Yes  | Fetch the tags under the repository identified by `name`. |
| getManifest <br> `GET /v2/<name>/manifests/<reference>`         | Yes* | Fetch the manifest identified by `name` and `reference` where `reference` can be a tag or digest. |
| putManifest <br> `PUT /v2/<name>/manifests/<reference>`         | No   | Put the manifest identified by `name` and `reference` where `reference` can be a tag or digest. |
| deleteManifest <br> `DELETE /v2/<name>/manifests/<reference>`      | No   | Delete the manifest identified by `name` and `reference` where `reference` can be a tag or digest. |
| createBlobReadStream <br> `GET /v2/<name>/blobs/<digest>` | No*  | Retrieve the blob from the registry identified by `digest`. |
| headBlob <br> `HEAD /v2/<name>/blobs/<digest>`            | No*  | Retrieve the blob from the registry identified by `digest` -- just the headers. |
| startBlobUpload <br> `POST /v2/<name>/blobs/uploads/`     | No   | Initiate a resumable blob upload. If successful, an upload location will be provided to complete the upload. Optionally, if the `digest` parameter is present, the request body will be used to complete the upload in a single request. |
| getBlobUploadStatus <br> `GET /v2/<name>/blobs/uploads/<uuid>` | No   | Retrieve status of upload identified by `uuid`. The primary purpose of this endpoint is to resolve the current status of a resumable upload. |
| uploadBlobChunk <br> `PATCH /v2/<name>/blobs/uploads/<uuid>`     | No   | Upload a chunk of data for the specified upload. |
| completeBlobUpload <br> `PUT /v2/<name>/blobs/uploads/<uuid>`  | No   | Complete the upload specified by `uuid`, optionally appending the body as the final chunk. |
| cancelBlobUpload <br> `DELETE /v2/<name>/blobs/uploads/<uuid>`    | No   | Cancel outstanding upload processes, releasing associated resources. If this is not called, the unfinished uploads will eventually timeout. |
| deleteBlob <br> `DELETE /v2/<name>/blobs/<digest>`          | No   | Delete the blob identified by `name` and `digest`. Warning: From the Docker spec I'm not sure that `deleteBlob` doesn't corrupt images if you delete a shared blob. |
| listRepositories <br> `GET /v2/_catalog/`    | No   | List all repositories in this registry. [Spec.](https://docs.docker.com/registry/spec/api/#listing-repositories) |

*: Endpoints with Javascript implementations that haven't been partially fully ported to Deno / Typescript yet.

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

Not ported. Likely to be deleted instead.

## Development

### Naming convensions

For naming this package attempts to consistently use `repo` for repository,
`img` for image, etc.
