// SPDX-License-Identifier: Apache-2.0

import {
  getRuntimeMessageError,
  sendRuntimeMessage,
  type RuntimeMessageResult,
} from '../src/utils/runtimeMessages';

type RuntimeMessageHandler = (message: Record<string, unknown>) => Promise<RuntimeMessageResult>;

runTests();

async function runTests() {
  await returnsSuccessfulBackgroundResult();
  await convertsRuntimeSendFailuresToFailedResults();
  reportsFailedResultMessages();
  usesFallbackForFailedResultsWithoutMessages();
  ignoresSuccessfulOrMissingResults();
  console.log('runtimeMessages tests passed');
}

async function returnsSuccessfulBackgroundResult() {
  setRuntimeMessageHandler(async message => ({
    success: true,
    action: message.action,
  }));

  const result = await sendRuntimeMessage({ action: 'download' });

  assertEqual(result.success, true, 'successful background result should be returned');
  assertEqual(result.action, 'download', 'runtime message payload should reach the background sender');
}

async function convertsRuntimeSendFailuresToFailedResults() {
  setRuntimeMessageHandler(async () => {
    throw new Error('background unavailable');
  });

  const result = await sendRuntimeMessage({ action: 'upload' });

  assertEqual(result.success, false, 'runtime send failure should return a failed result');
  assertEqual(result.message, 'background unavailable', 'runtime send failure should preserve the error message');
}

function reportsFailedResultMessages() {
  assertEqual(
    getRuntimeMessageError({ success: false, message: 'storage failed' }, 'fallback'),
    'storage failed',
    'failed result should expose its message',
  );
}

function usesFallbackForFailedResultsWithoutMessages() {
  assertEqual(
    getRuntimeMessageError({ success: false }, 'fallback'),
    'fallback',
    'failed result without a message should use fallback text',
  );
}

function ignoresSuccessfulOrMissingResults() {
  assertEqual(
    getRuntimeMessageError({ success: true }, 'fallback'),
    '',
    'successful result should not report an error',
  );
  assertEqual(
    getRuntimeMessageError(undefined, 'fallback'),
    '',
    'missing result should not report an error',
  );
}

function setRuntimeMessageHandler(handler: RuntimeMessageHandler) {
  (globalThis as typeof globalThis & {
    browser: {
      runtime: {
        sendMessage: RuntimeMessageHandler;
      };
    };
  }).browser = {
    runtime: {
      sendMessage: handler,
    },
  };
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}
