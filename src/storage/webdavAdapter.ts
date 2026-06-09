// SPDX-License-Identifier: Apache-2.0

import { StorageAdapter } from './storageAdapter';
import type { Setting } from '../utils/setting';
import { assertWebDavHostPermission } from './webdavPermissions';

export class WebDavAdapter implements StorageAdapter {
  readonly type = 'webdav';

  constructor(private readonly setting: Setting) {
  }

  async test() {
    await this.requireCompleteSettings();
    await assertWebDavHostPermission(this.setting.webdavUrl);
    const response = await fetch(this.getFileUrl(), {
      method: 'HEAD',
      headers: this.getHeaders(),
    });

    if (response.status === 404) {
      return;
    }

    if (!response.ok) {
      throw new Error(`WebDAV test failed: ${response.status} ${response.statusText}`);
    }
  }

  async download() {
    await this.requireCompleteSettings();
    await assertWebDavHostPermission(this.setting.webdavUrl);
    const response = await fetch(this.getFileUrl(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`WebDAV download failed: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  async upload(content: string, _message: string) {
    await this.requireCompleteSettings();
    await assertWebDavHostPermission(this.setting.webdavUrl);
    const response = await fetch(this.getFileUrl(), {
      method: 'PUT',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json;charset=utf-8',
      },
      body: content,
    });

    if (!response.ok) {
      throw new Error(`WebDAV upload failed: ${response.status} ${response.statusText}`);
    }
  }

  private getFileUrl() {
    return joinWebDavPath(this.setting.webdavUrl, this.setting.webdavPath);
  }

  private getHeaders() {
    return {
      Authorization: `Basic ${btoa(`${this.setting.webdavUsername}:${this.setting.webdavPassword}`)}`,
      Cache: 'no-store',
    };
  }

  private async requireCompleteSettings() {
    if (this.setting.webdavUrl === '') {
      throw new Error('WebDAV URL Not Found');
    }
    if (this.setting.webdavUsername === '') {
      throw new Error('WebDAV Username Not Found');
    }
    if (this.setting.webdavPassword === '') {
      throw new Error('WebDAV Password Not Found');
    }
    if (this.setting.webdavPath === '') {
      throw new Error('WebDAV File Path Not Found');
    }
  }
}

function joinWebDavPath(baseUrl: string, path: string) {
  const parsedBase = new URL(baseUrl);
  parsedBase.username = '';
  parsedBase.password = '';
  parsedBase.search = '';
  parsedBase.hash = '';

  const baseWithoutCredentials = `${parsedBase.origin}${parsedBase.pathname}`;
  const normalizedBase = baseWithoutCredentials.endsWith('/') ? baseWithoutCredentials.slice(0, -1) : baseWithoutCredentials;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
