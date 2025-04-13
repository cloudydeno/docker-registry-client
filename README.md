![CI](https://github.com/cloudydeno/docker-registry-client/actions/workflows/deno-ci.yaml/badge.svg?branch=main)

# `@cloudydeno/docker-registry-client`

A Deno-oriented port of a Docker Registry API V2 client.

* Typescript, async/await, Promises, `fetch()`
* Covers most APIs: pull, push, list, delete
* Used in practice with Github container registries, Google Artifact Registry, and others
* Handles v2 registries with Docker or OCI images.
  * The [original Node.JS project](https://github.com/TritonDataCenter/node-docker-registry-client) supported v1 registries/manifests. This has been removed.
* [Published on JSR](https://jsr.io/@cloudydeno/docker-registry-client) since `v0.6.0`.
* Last version [published to `/x/`](https://deno.land/x/docker_registry_client) is `v0.5.0`.

## Credentials

How to authenticate to particular registries:

* Github:
    * username `$USERNAME` or similar
        * like with Github API, username is not validated, you can use whatever
    * password `$GITHUB_TOKEN`
* AWS ECR:
    * you need AWS auth even for 'public' images
    * username `"AWS"`
    * password from running `aws ecr get-login-password`
* Google Artifact Registry & gcr:
    * username `"oauth2accesstoken"`
    * password from running `gcloud auth print-access-token`

## Usage

Most usage of this package involves creating a *Registry* API client for a
specific *repository* and calling its methods.

Simple usage will look like this:

```typescript
import { RegistryClientV2 } from 'jsr:@cloudydeno/docker-registry-client';
const REPO = 'alpine';
const client = new RegistryClientV2({name: REPO});

const tags = await client.listTags();
console.log(JSON.stringify(tags, null, 4));
```

If you need to authenticate, the `RegistryClientV2` call might look more like this:

```typescript
import { RegistryClientV2 } from 'jsr:@cloudydeno/docker-registry-client';

const client = new RegistryClientV2({
    name: 'alpine',
    // Optional basic auth to the registry
    username: <username>,
    password: <password>,
    // Optional, for a registry without a signed TLS certificate.
    // NOTE: Deno does not currently support this option
    // insecure: <true|false>,
    // client: Deno.createHttpClient({ ... }),
    // ... see the source code for other options
});
```

NOTE: This module does not include v1 API support.

## Examples

Most usage of this package involves creating a *Registry* API client for a
specific *repository* and calling its methods.

### Repository / Reference Parsing

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

### v2 API

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

## Naming convensions

For naming this package attempts to consistently use `repo` for repository,
`img` for image, etc.

## v1 API

Not implemented. I see no reason to maintain v1 client code.

## v2 API

A mapping of the [Docker Registry API v2
endpoints](https://docs.docker.com/registry/spec/api/#detail) to the API
equivalents in this client lib.

| Name / Endpoint      | Implemented | Description |
| -------------------- | ----------- | ----------- |
| ping <br> `GET /v2/`                | Yes  | Check that the endpoint implements Docker Registry API V2. |
| listTags <br> `GET /v2/<name>/tags/list`            | Yes  | Fetch the tags under the repository identified by `name`. |
| getManifest <br> `GET /v2/<name>/manifests/<reference>`         | Yes | Fetch the manifest identified by `name` and `reference` where `reference` can be a tag or digest. |
| putManifest <br> `PUT /v2/<name>/manifests/<reference>`         | Yes  | Put the manifest identified by `name` and `reference` where `reference` can be a tag or digest. |
| deleteManifest <br> `DELETE /v2/<name>/manifests/<reference>`      | Yes  | Delete the manifest identified by `name` and `reference` where `reference` can be a tag or digest. |
| createBlobReadStream <br> `GET /v2/<name>/blobs/<digest>` | Yes  | Retrieve the blob from the registry identified by `digest`. |
| headBlob <br> `HEAD /v2/<name>/blobs/<digest>`            | Yes  | Retrieve the blob from the registry identified by `digest` -- just the headers. |
| startBlobUpload <br> `POST /v2/<name>/blobs/uploads/`     | Yes  | Initiate a resumable blob upload. If successful, an upload location will be provided to complete the upload. Optionally, if the `digest` parameter is present, the request body will be used to complete the upload in a single request. |
| getBlobUploadStatus <br> `GET /v2/<name>/blobs/uploads/<uuid>` | No   | Retrieve status of upload identified by `uuid`. The primary purpose of this endpoint is to resolve the current status of a resumable upload. |
| uploadBlobChunk <br> `PATCH /v2/<name>/blobs/uploads/<uuid>`     | No   | Upload a chunk of data for the specified upload. |
| completeBlobUpload <br> `PUT /v2/<name>/blobs/uploads/<uuid>`  | Yes  | Complete the upload specified by `uuid`, optionally appending the body as the final chunk. |
| cancelBlobUpload <br> `DELETE /v2/<name>/blobs/uploads/<uuid>`    | No   | Cancel outstanding upload processes, releasing associated resources. If this is not called, the unfinished uploads will eventually timeout. |
| deleteBlob <br> `DELETE /v2/<name>/blobs/<digest>`          | No   | Delete the blob identified by `name` and `digest`. Warning: From the Docker spec I'm not sure that `deleteBlob` doesn't corrupt images if you delete a shared blob. |
| listRepositories <br> `GET /v2/_catalog/`    | No   | List all repositories in this registry. [Spec.](https://docs.docker.com/registry/spec/api/#listing-repositories) |

For more code examples, check out the other folders in this Github repo.
