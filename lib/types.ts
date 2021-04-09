
export interface RegistryIndex {
  name: string;
  official?: boolean;
  scheme: string;
}

export interface RegistryImage {
  index: RegistryIndex;
  remoteName?: string;
  localName?: string;
  canonicalName?: string;
  official?: boolean;
  digest?: string;
  tag?: string;
}

export interface Manifest {
  schemaVersion: number;
  // v1?
  name?: string;
  tag?: string;
  architecture?: string;
  fsLayers?: Array<{
      blobSum: string;
  }>;
  history?: Array<{
      v1Compatibility?: string; // JSON?
  }>;
  signatures?: Array<{
      header: Record<string, any>; // JWT header
      protected: string;
      signature: string;
  }>;
  // v2?
  mediaType?: string;
  manifests?: Array<{
      digest: string;
      mediaType: string;
      platform: {
          architecture: string;
          os: string;
      };
      size: number;
  }>;
  config?: {
      mediaType: string;
      size: number;
      digest: string;
  };
  layers?: Array<{
      mediaType: string;
      size: number;
      digest: string;
  }>;
}
