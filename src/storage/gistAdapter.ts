// SPDX-License-Identifier: Apache-2.0

import { StorageAdapter } from './storageAdapter';
import type { Setting } from '../utils/setting';
import { assertGistHostPermissions } from './gistPermissions';

type GistHttpClient = {
  get(url: string, options?: unknown): {
    json(): Promise<unknown>;
    text(): Promise<string>;
  };
  patch(url: string, options: unknown): {
    json(): Promise<unknown>;
  };
};

export class GistAdapter implements StorageAdapter {
  readonly type = 'gist';

  constructor(
    private readonly setting: Setting,
    private readonly client?: GistHttpClient,
  ) {
  }

  async test() {
    await this.requireCompleteSettings();
    await assertGistHostPermissions();
    const client = await this.getClient();
    await client.get(`gists/${this.setting.gistID}`).json();
  }

  async download() {
    await this.requireCompleteSettings();
    await assertGistHostPermissions();
    const client = await this.getClient();
    const resp = await client.get(`gists/${this.setting.gistID}`).json() as any;
    if (!resp?.files) {
      return null;
    }

    const gistFile = resp.files[this.setting.gistFileName];
    if (!gistFile) {
      return null;
    }

    if (gistFile.truncated) {
      return client.get(gistFile.raw_url, { prefixUrl: '' }).text();
    }

    return gistFile.content;
  }

  async upload(content: string, message: string) {
    await this.requireCompleteSettings();
    await assertGistHostPermissions();
    const client = await this.getClient();
    await client.patch(`gists/${this.setting.gistID}`, {
      json: {
        files: {
          [this.setting.gistFileName]: {
            content,
          },
        },
        description: message,
      },
    }).json();
  }

  private async getClient() {
    if (this.client) {
      return this.client;
    }

    const { http } = await import('../utils/http');
    return http;
  }

  private async requireCompleteSettings() {
    if (this.setting.githubToken === '') {
      throw new Error('Gist Token Not Found');
    }
    if (this.setting.gistID === '') {
      throw new Error('Gist ID Not Found');
    }
    if (this.setting.gistFileName === '') {
      throw new Error('Gist File Not Found');
    }
  }
}
