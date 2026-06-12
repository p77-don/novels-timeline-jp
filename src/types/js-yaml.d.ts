// js-yaml 型宣言フォールバック
// @types/js-yaml がインストール済みの場合はそちらが優先されます。
// 未インストール環境でも import * as yaml from "js-yaml" が解決できるよう宣言します。

declare module "js-yaml" {
  export function load(input: string, options?: LoadOptions): unknown;
  export function dump(obj: unknown, options?: DumpOptions): string;

  export interface LoadOptions {
    filename?: string;
    onWarning?: (warning: YAMLException) => void;
    schema?: Schema;
    json?: boolean;
  }

  export interface DumpOptions {
    indent?: number;
    noArrayIndent?: boolean;
    skipInvalid?: boolean;
    flowLevel?: number;
    lineWidth?: number;
    noRefs?: boolean;
    noCompatMode?: boolean;
    condenseFlow?: boolean;
    quotingType?: "'" | '"';
    forceQuotes?: boolean;
  }

  export interface Schema {}

  export class YAMLException extends Error {
    name: string;
    reason: string;
    mark: unknown;
    message: string;
  }
}
