// Motor de lenguaje in-process para .bel: sirve el documento virtual TSX de
// cada archivo a un ts.LanguageService de TypeScript y traduce posiciones
// virtual ↔ source. Es puro (sin imports de vscode) para poder testearlo en
// Node.
//
// Estrategia (Volar/Svelte): el .bel no es TSX válido (decoradores, @...),
// así que belToTsx() lo convierte en un documento TSX con un mapa de
// posiciones. El language service solo ve los documentos virtuales.

import * as ts from "typescript";
import path from "node:path";
import {
  belToTsx,
  type BelTsxResult,
  type MarkerKind,
} from "../../../src/tsxTransform";

export interface SourcePosition {
  line: number; // 0-based
  character: number; // 0-based
}

export interface BelCompletion {
  label: string;
  kind?: string;
  insertText?: string;
}

export interface BelHover {
  contents: string;
  range?: { start: SourcePosition; end: SourcePosition };
}

export interface BelDiagnostic {
  message: string;
  start: SourcePosition;
  end: SourcePosition;
  severity: "error" | "warning" | "info" | "hint";
  code?: number;
}

export interface BelDefinition {
  uri: string;
  start: SourcePosition;
  end: SourcePosition;
}

export interface BelSemanticToken {
  start: SourcePosition;
  length: number;
  tokenType: string;
}

export interface BelFoldingRange {
  start: SourcePosition;
  end: SourcePosition;
  kind: "region" | "comment";
}

interface DocState {
  uri: string;
  tsxPath: string;
  source: string;
  virtual: BelTsxResult;
  version: number;
}

export interface BelziumLanguageServiceOptions {
  rootDir: string;
  typesDir: string;
  libDir: string;
}

const COMPILATION_SETTINGS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.Preserve,
  strict: true,
  skipLibCheck: true,
  allowSyntheticDefaultImports: true,
  esModuleInterop: true,
};

// Marcadores @ → tipo de token semántico. El `@` de las directivas se
// elimina del documento virtual (no existe para TypeScript), así que el
// coloreado de las directivas se construye desde aquí.
const MARKER_TOKEN_TYPES: Record<MarkerKind, string> = {
  directive: "keyword",
  decorator: "decorator",
  custom: "type",
};

// Longitud en caracteres de `@nombre` en el source a partir del offset del '@'.
function atNameLength(source: string, at: number): number {
  if (source[at] !== "@") return 0;
  let i = at + 1;
  if (!/[A-Za-z_$]/.test(source[i] ?? "")) return 0;
  while (i < source.length && /[A-Za-z0-9$-]/.test(source[i])) i++;
  return i - at;
}

export class BelziumLanguageService {
  private readonly docs = new Map<string, DocState>();
  private readonly pathToUri = new Map<string, string>();
  private readonly rootDir: string;
  private readonly typesIndexPath: string;
  private readonly defaultLibPath: string;
  private service: ts.LanguageService | null = null;

  constructor(opts: BelziumLanguageServiceOptions) {
    this.rootDir = opts.rootDir;
    this.typesIndexPath = path.join(opts.typesDir, "index.d.ts");
    this.defaultLibPath = path.join(
      opts.libDir,
      ts.getDefaultLibFileName(COMPILATION_SETTINGS),
    );
  }

  // ------------------------------------------------------------------
  // Ciclo de vida de los documentos
  // ------------------------------------------------------------------

  openDocument(uri: string, source: string): void {
    this.setDocument(uri, source, 0);
  }

  updateDocument(uri: string, source: string): void {
    const prev = this.docs.get(uri);
    this.setDocument(uri, source, prev ? prev.version + 1 : 0);
  }

  closeDocument(uri: string): void {
    const state = this.docs.get(uri);
    if (state) {
      this.docs.delete(uri);
      this.pathToUri.delete(state.tsxPath);
    }
  }

  private setDocument(uri: string, source: string, version: number): void {
    const tsxPath = uri + ".tsx";
    const state: DocState = {
      uri,
      tsxPath,
      source,
      virtual: belToTsx(source),
      version,
    };
    this.docs.set(uri, state);
    this.pathToUri.set(tsxPath, uri);
  }

  // ------------------------------------------------------------------
  // Providers (posiciones en coordenadas de source)
  // ------------------------------------------------------------------

  getCompletionsAt(uri: string, position: SourcePosition): BelCompletion[] {
    const state = this.docs.get(uri);
    if (!state || state.virtual.code.length === 0) return [];

    const vOffset = this.toVirtualOffset(state, position);
    const info = this.getService().getCompletionsAtPosition(state.tsxPath, vOffset, {
      includeCompletionsWithInsertText: true,
      includeCompletionsForModuleExports: true,
    });
    if (!info) return [];

    return info.entries.map((entry) => ({
      label: entry.name,
      kind: entry.kind,
      insertText: entry.insertText ?? entry.name,
    }));
  }

  getHoverAt(uri: string, position: SourcePosition): BelHover | null {
    const state = this.docs.get(uri);
    if (!state || state.virtual.code.length === 0) return null;

    const vOffset = this.toVirtualOffset(state, position);
    const info = this.getService().getQuickInfoAtPosition(state.tsxPath, vOffset);
    if (!info) return null;

    const contents = ts.displayPartsToString(info.displayParts);
    let range: BelHover["range"];
    if (info.textSpan) {
      const sStart = state.virtual.toSource(info.textSpan.start);
      const sEnd = state.virtual.toSource(info.textSpan.start + info.textSpan.length);
      if (sStart !== null && sEnd !== null) {
        range = {
          start: this.toSourcePosition(state.source, sStart),
          end: this.toSourcePosition(state.source, sEnd),
        };
      }
    }
    return { contents, range };
  }

  getDefinitionAt(uri: string, position: SourcePosition): BelDefinition[] {
    const state = this.docs.get(uri);
    if (!state || state.virtual.code.length === 0) return [];

    const vOffset = this.toVirtualOffset(state, position);
    const infos = this.getService().getDefinitionAtPosition(state.tsxPath, vOffset) ?? [];
    const out: BelDefinition[] = [];

    for (const info of infos) {
      const targetUri = this.pathToUri.get(info.fileName);
      const target = targetUri ? this.docs.get(targetUri) : undefined;
      if (!target) continue;

      const sStart = target.virtual.toSource(info.textSpan.start);
      const sEnd = target.virtual.toSource(info.textSpan.start + info.textSpan.length);
      if (sStart === null || sEnd === null) continue;

      out.push({
        uri: target.uri,
        start: this.toSourcePosition(target.source, sStart),
        end: this.toSourcePosition(target.source, sEnd),
      });
    }
    return out;
  }

  getDiagnostics(uri: string): BelDiagnostic[] {
    const state = this.docs.get(uri);
    if (!state || state.virtual.code.length === 0) return [];

    const ls = this.getService();
    const syntactic = ls.getSyntacticDiagnostics(state.tsxPath);
    const semantic = ls.getSemanticDiagnostics(state.tsxPath);
    const out: BelDiagnostic[] = [];

    for (const diagnostic of [...syntactic, ...semantic]) {
      if (diagnostic.start === undefined || diagnostic.length === undefined) continue;

      const sStart = state.virtual.toSource(diagnostic.start);
      const sEnd = state.virtual.toSource(diagnostic.start + diagnostic.length);
      if (sStart === null || sEnd === null) continue;

      const severity =
        diagnostic.category === ts.DiagnosticCategory.Error
          ? "error"
          : diagnostic.category === ts.DiagnosticCategory.Warning
            ? "warning"
            : diagnostic.category === ts.DiagnosticCategory.Suggestion
              ? "info"
              : "hint";

      out.push({
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        start: this.toSourcePosition(state.source, sStart),
        end: this.toSourcePosition(state.source, sEnd),
        severity,
        code: diagnostic.code,
      });
    }
    return out;
  }

  // ------------------------------------------------------------------
  // Tokens semánticos y plegado
  // ------------------------------------------------------------------

  getSemanticTokens(uri: string): BelSemanticToken[] {
    const state = this.docs.get(uri);
    if (!state || state.virtual.code.length === 0) return [];

    const tokens: BelSemanticToken[] = [];
    for (const marker of state.virtual.markers) {
      const tokenType = MARKER_TOKEN_TYPES[marker.kind];
      const nameLen = atNameLength(state.source, marker.s);
      if (nameLen <= 0) continue;
      tokens.push({
        start: this.toSourcePosition(state.source, marker.s),
        length: nameLen,
        tokenType,
      });
    }

    tokens.sort(
      (a, b) =>
        this.toSourceOffset(state.source, a.start) -
        this.toSourceOffset(state.source, b.start),
    );
    return tokens;
  }

  getFoldingRanges(uri: string): BelFoldingRange[] {
    const state = this.docs.get(uri);
    if (!state || state.virtual.code.length === 0) return [];

    const out: BelFoldingRange[] = [];
    const seen = new Set<string>();

    const add = (
      sOffset: number,
      eOffset: number,
      kind: BelFoldingRange["kind"],
    ): void => {
      if (eOffset <= sOffset) return;
      const key = `${sOffset}:${eOffset}:${kind}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        start: this.toSourcePosition(state.source, sOffset),
        end: this.toSourcePosition(state.source, eOffset),
        kind,
      });
    };

    // Pliegues de directivas @ (regiones exactas del source).
    for (const fold of state.virtual.folding) {
      add(fold.start, fold.end, "region");
    }

    // Pliegues de TypeScript (clases, métodos, comentarios) mapeados al source.
    // Solo se conservan los spans íntegramente dentro de un segmento verbatim:
    // los que cruzan regiones generadas (@-directivas, import, header) se
    // descartan para evitar pliegues espurios.
    for (const span of this.getService().getOutliningSpans(state.tsxPath)) {
      const vStart = span.textSpan.start;
      const vEnd = span.textSpan.start + span.textSpan.length;
      const sStart = state.virtual.toSource(vStart);
      const sEnd = state.virtual.toSource(vEnd);
      if (sStart === null || sEnd === null) continue;
      // Round-trip: si toVirtual(toSource(v)) !== v el punto cae en una
      // región generada (anclada a un marcador) y no es fiable.
      if (state.virtual.toVirtual(sStart) !== vStart) continue;
      if (state.virtual.toVirtual(sEnd) !== vEnd) continue;
      const kind: BelFoldingRange["kind"] =
        span.kind === ts.OutliningSpanKind.Comment ? "comment" : "region";
      add(sStart, sEnd, kind);
    }

    out.sort((a, b) => {
      const oa = this.toSourceOffset(state.source, a.start);
      const ob = this.toSourceOffset(state.source, b.start);
      if (oa !== ob) return oa - ob;
      const ea = this.toSourceOffset(state.source, a.end);
      const eb = this.toSourceOffset(state.source, b.end);
      return eb - ea;
    });
    return out;
  }

  // ------------------------------------------------------------------
  // Conversión de posiciones
  // ------------------------------------------------------------------

  private toVirtualOffset(state: DocState, position: SourcePosition): number {
    return state.virtual.toVirtual(this.toSourceOffset(state.source, position));
  }

  private toSourcePosition(source: string, offset: number): SourcePosition {
    let line = 0;
    let i = 0;
    while (i < offset) {
      const nl = source.indexOf("\n", i);
      if (nl === -1 || nl >= offset) break;
      i = nl + 1;
      line++;
    }
    return { line, character: offset - i };
  }

  private toSourceOffset(source: string, position: SourcePosition): number {
    let line = 0;
    let offset = 0;
    while (line < position.line && offset < source.length) {
      const nl = source.indexOf("\n", offset);
      if (nl === -1) return source.length;
      offset = nl + 1;
      line++;
    }
    return Math.min(source.length, offset + position.character);
  }

  // ------------------------------------------------------------------
  // ts.LanguageService
  // ------------------------------------------------------------------

  private getService(): ts.LanguageService {
    if (!this.service) {
      this.service = ts.createLanguageService(this.createHost());
    }
    return this.service;
  }

  private createHost(): ts.LanguageServiceHost {
    const self = this;
    const settings = COMPILATION_SETTINGS;

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => [...self.docs.values()].map((d) => d.tsxPath),
      getScriptVersion: (fileName) => {
        const uri = self.pathToUri.get(fileName);
        const state = uri ? self.docs.get(uri) : undefined;
        return state ? String(state.version) : "0";
      },
      getScriptSnapshot: (fileName) => {
        const uri = self.pathToUri.get(fileName);
        if (uri) {
          const state = self.docs.get(uri);
          return state ? ts.ScriptSnapshot.fromString(state.virtual.code) : undefined;
        }
        const content = ts.sys.readFile(fileName);
        return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content);
      },
      getScriptKind: (fileName) =>
        fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.Unknown,
      getCurrentDirectory: () => self.rootDir,
      getCompilationSettings: () => settings,
      getDefaultLibFileName: () => self.defaultLibPath,
      getNewLine: () => "\n",
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
      readFile: (fileName) => ts.sys.readFile(fileName),
      fileExists: (fileName) => ts.sys.fileExists(fileName),
      readDirectory: (dir, extensions, exclude, include, depth) =>
        ts.sys.readDirectory(dir, extensions, exclude, include, depth),
      resolveModuleNames: (moduleNames, containingFile) =>
        moduleNames.map((name) => {
          if (name === "belzium") {
            return {
              resolvedFileName: self.typesIndexPath,
              extension: ts.Extension.Dts,
            };
          }
          const resolved = ts.resolveModuleName(
            name,
            containingFile,
            settings,
            ts.sys,
          ).resolvedModule;
          return resolved;
        }),
    };
    return host;
  }
}
