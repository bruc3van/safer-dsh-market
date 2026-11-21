/**
 * The MCP shapes both halves agree on: the Host's own server-name and
 * credential-template grammar, and the heuristics that decide whether a
 * configured string looks like a secret someone pasted in the clear.
 *
 * Dependency-free on purpose: the Host scan masks static rows with these
 * before anything crosses the wire, and the browser runs the same rules over
 * the managed entries it already reads through Settings — one definition, so
 * the two never disagree about what "plaintext secret" means.
 * @module dsh-market-pro/mcpShapes
 */
/** `dsh-mcp-client`'s `serverName` (and the manager's `servers` key) grammar. */
export declare const SERVER_NAME_PATTERN: RegExp;
/** One credential reference name, as `${credential:REF}` accepts it. */
export declare const CREDENTIAL_REF_PATTERN: RegExp;
/** The Host package names whose Loader rows are MCP servers or their manager. */
export declare const MCP_CLIENT_PACKAGE = "@deepseek-ai/dsh-mcp-client";
export declare const MCP_MANAGER_PACKAGE = "@deepseek-ai/dsh-mcp-manager";
/** The `${credential:REF}` names one string carries, in order. */
export declare function credentialRefsIn(value: string): string[];
/** Whether a string is exactly one well-formed `${credential:REF}` token (after trimming). */
export declare function isExactCredentialTemplate(value: string): boolean;
/** The first `${…}` occurrence that is not a well-formed credential token, if any. */
export declare function malformedTemplate(value: string): string | undefined;
/** The template that stands in for one stored credential. */
export declare function credentialTemplate(ref: string): string;
/**
 * Whether a value, read on its own, looks like a credential: a well-known
 * token prefix, or a long opaque run of letters and digits that is neither a
 * path, a URL nor a package specifier.
 */
export declare function looksSecretValue(value: string): boolean;
/** Whether a named field (an env variable or a header) holds a secret in the clear. */
export declare function isSecretField(name: string, value: string): boolean;
/** Whether a URL carries a secret in its query string. */
export declare function isSecretUrl(url: string): boolean;
/**
 * Which argument positions carry a secret: one that looks like a credential
 * on its own, the value after a `--api-key`-style flag, or the right side of
 * a `--token=…` form.
 */
export declare function secretArgIndexes(args: readonly string[]): number[];
/** A legal credential reference name for one field of one server. */
export declare function suggestRef(server: string, field: string, taken?: ReadonlySet<string>): string;
/** What a masked value renders as. */
export declare const MASK = "\u2022\u2022\u2022\u2022\u2022\u2022";
/** Mask one argument, keeping a `--flag=` prefix legible. */
export declare function maskArg(arg: string): string;
/** Mask a URL's secret query values. */
export declare function maskUrl(url: string): string;
