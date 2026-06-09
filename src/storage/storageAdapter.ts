// SPDX-License-Identifier: Apache-2.0

export interface StorageAdapter {
  readonly type: string;
  test(): Promise<void>;
  download(): Promise<string | null>;
  upload(content: string, message: string): Promise<void>;
  delete?(): Promise<void>;
}
