// SPDX-License-Identifier: Apache-2.0

import enMessages from '../public/_locales/en/messages.json';
import zhCnMessages from '../public/_locales/zh_CN/messages.json';
import { AppLanguage } from '../settings/appSettings';
import { normalizeAppLanguage } from '../settings/settingNormalization';

type LocaleMessages = Record<string, { message?: string }>;

export type ResolvedAppLanguage = Exclude<AppLanguage, 'auto'>;
export type Translator = (key: string, fallback: string) => string;

const localeMessages: Record<ResolvedAppLanguage, LocaleMessages> = {
  en: enMessages,
  zh_CN: zhCnMessages,
};

export function resolveAppLanguage(language: unknown, uiLanguage = getBrowserUiLanguage()): ResolvedAppLanguage {
  const normalizedLanguage = normalizeAppLanguage(language);
  if (normalizedLanguage === 'en' || normalizedLanguage === 'zh_CN') {
    return normalizedLanguage;
  }

  const normalizedUiLanguage = uiLanguage.replace('_', '-').toLowerCase();
  return normalizedUiLanguage.startsWith('zh') ? 'zh_CN' : 'en';
}

export function createTranslator(language: unknown, uiLanguage?: string): Translator {
  const resolvedLanguage = resolveAppLanguage(language, uiLanguage);
  const messages = localeMessages[resolvedLanguage];

  return (key: string, fallback: string) => {
    const localeMessage = messages[key]?.message;
    if (localeMessage) {
      return localeMessage;
    }

    const browserMessage = getBrowserMessage(key);
    return browserMessage || fallback;
  };
}

export const fallbackTranslator: Translator = (key, fallback) => getBrowserMessage(key) || fallback;

function getBrowserUiLanguage() {
  if (typeof browser !== 'undefined' && browser.i18n?.getUILanguage) {
    return browser.i18n.getUILanguage();
  }

  return 'en';
}

function getBrowserMessage(key: string) {
  if (typeof browser !== 'undefined' && browser.i18n?.getMessage) {
    return browser.i18n.getMessage(key as any);
  }

  return '';
}
