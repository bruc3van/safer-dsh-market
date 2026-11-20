/**
 * Extract the first matching file from a gzipped tar response stream,
 * cancelling the underlying HTTP stream as soon as the entry is complete.
 * @param response - HTTP 200 response whose body is a `.tgz` stream.
 * @param targetPaths - Normalized paths to accept (checked in order of arrival).
 * @param maxBytes - Upper bound for both compressed download and decompressed output.
 * @returns The extracted file bytes.
 */
export declare function extractFileFromTgzResponse(response: Response, targetPaths: readonly string[], maxBytes: number): Promise<Buffer>;
