/** An alias for Uint8Array now that Typescript 5.7 */
export type ByteArray = Uint8Array<ArrayBuffer>;

export interface RegistryIndex {
  name: string;
  official: boolean;
  scheme: 'https' | 'http';
}

export interface RegistryRepo {
  index: RegistryIndex;
  official: boolean;
  remoteName: string;
  localName: string;
  canonicalName: string;
}

export interface RegistryImage extends RegistryRepo {
  digest: string | null;
  tag: string | null;
  canonicalRef: string;
}


export interface TagList {
  name: string;
  tags: string[];
  // these seem GCR specific:
  child?: string[];
  manifest?: Record<string, {
      imageSizeBytes: string;
      layerId?: string;
      mediaType: string;
      tag: string[];
      timeCreatedMs: string;
      timeUploadedMs: string;
  }>;
};


export type Manifest =
| ManifestV2
| ManifestV2List
| ManifestOCI
| ManifestOCIIndex
;

export interface ManifestV2 {
  schemaVersion: 2;
  mediaType: "application/vnd.docker.distribution.manifest.v2+json";
  config: ManifestV2Descriptor;
  layers: Array<ManifestV2Descriptor>;
}

export interface ManifestV2Descriptor {
  mediaType: string;
  size: number;
  digest: string;
  urls?: Array<string>;
}

export interface ManifestV2List {
  schemaVersion: 2;
  mediaType: "application/vnd.docker.distribution.manifest.list.v2+json";
  manifests: Array<{
    mediaType: string;
    digest: string;
    size: number;
    platform: {
      "architecture": string;
      "os": string;
      "os.version"?: string; // windows version
      "os.features"?: string[];
      "variant"?: string; // cpu variant
      "features"?: string[]; // cpu features
    };
  }>;
}


export interface ManifestOCI {
  schemaVersion: 2;
  mediaType?: "application/vnd.oci.image.manifest.v1+json";
  config: ManifestOCIDescriptor;
  layers: Array<ManifestOCIDescriptor>;
  annotations?: Record<string, string>;
}

export interface ManifestOCIDescriptor {
  mediaType: string;
  size: number;
  digest: string;
  urls?: Array<string>;
  annotations?: Record<string, string>;
}

export interface ManifestOCIIndex {
  schemaVersion: 2;
  mediaType?: "application/vnd.oci.image.index.v1+json";
  manifests: Array<{
    mediaType: string;
    digest: string;
    size: number;
    platform?: {
      "architecture": string;
      "os": string;
      "os.version"?: string; // windows version
      "os.features"?: string[];
      "variant"?: string; // cpu variant
      "features"?: string[]; // cpu features
    };
    /** Used for OCI Image Layouts */
    annotations?: Record<string, string>;
  }>;
  annotations?: Record<string, string>;
}


export interface RegistryClientOpts {
  name?: string; // mutually exclusive with repo
  repo?: RegistryRepo;
  // log
  username?: string;
  password?: string;
  token?: string; // for bearer auth
  insecure?: boolean;
  scheme?: 'https' | 'http';
  acceptOCIManifests?: boolean;
  acceptManifestLists?: boolean;
  userAgent?: string;
  scopes?: string[];
  client?: Deno.HttpClient;
};


export type AuthInfo =
| { type: 'None'; }
| { type: 'Basic';
    username: string;
    password: string;
  }
| { type: 'Bearer';
    token: string;
  }
;


export interface DockerResponse extends Response {
  dockerBody(): Promise<ByteArray>;
  dockerJson(): Promise<unknown>;
  dockerStream(): ReadableStream<ByteArray>;

  dockerErrors(): Promise<Array<RegistryError>>;
  dockerThrowable(baseMsg: string): Promise<Error>;
}

export interface RegistryError {
  code?: string;
  message: string;
  detail?: string;
};
