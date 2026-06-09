// SPDX-License-Identifier: Apache-2.0

export interface RuntimeMessageResult {
    success?: boolean;
    message?: string;
    [key: string]: unknown;
}

export async function sendRuntimeMessage<T extends RuntimeMessageResult = RuntimeMessageResult>(
    message: Record<string, unknown>,
): Promise<T> {
    try {
        return await browser.runtime.sendMessage(message) as T;
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : String(error),
        } as T;
    }
}

export function getRuntimeMessageError(
    result: RuntimeMessageResult | undefined,
    fallback: string,
) {
    if (result?.success === false) {
        return result.message || fallback;
    }

    return '';
}
