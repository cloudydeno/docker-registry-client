![Deno CI](https://github.com/cloudydeno/deno-docker_registry_client/workflows/Deno%20CI/badge.svg?branch=main)

# Deno `/x/docker_registry_client`

A port / fork of a Docker Registry API V2 client.
Support for v1 registries has been removed and support for OCI registries has been added.

The [original Node.JS project](https://github.com/TritonDataCenter/node-docker-registry-client)
supported v1 registries/manifests.

This release is designed for Deno 2.

## Design Points

* Only handling the v2 Registry API.
* Typescript, async/await, Promises, `fetch()`
* Covers most APIs: pull, push, list, delete
* Used in practice with Github container registries, Google Artifact Registry, and others

## Auth Approaches

* Dockerhub: normal user/password
* Github: username `$USERNAME` password `$GITHUB_TOKEN`
    * like with Github API, username can probably be anything (haven't confirmed)
* AWS ECR: username `"AWS"` password from running `aws ecr get-login-password`
    * you need AWS auth even for 'public' images
* Gcloud GCR: username `"oauth2accesstoken"` password from running `gcloud auth print-access-token`

## Overview

Most usage of this package involves creating a *Registry* API client for a
specific *repository* and calling its methods.

## Usage

Simple usage will look like this:

```typescript
import { RegistryClientV2 } from 'https://deno.land/x/docker_registry_client/registry-client-v2.ts';
var REPO = 'alpine';
var client = new RegistryClientV2({name: REPO});

const tags = await client.listTags();
console.log(JSON.stringify(tags, null, 4));
```

If you need to authenticate, the `RegistryClientV2` call might look more like this:

```typescript
import { RegistryClientV2 } from 'https://deno.land/x/docker_registry_client/registry-client-v2.ts';

var client = new RegistryClientV2({
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
