import * as vscode from "vscode";
import * as path from "path";
import {
  BelziumLanguageService,
  type BelDiagnostic,
  type BelHover,
  type BelDefinition,
  type SourcePosition,
} from "./languageService";

const DIRECTIVE_KEYWORDS = [
  "if",
  "else",
  "for",
  "switch",
  "case",
  "default",
];

const DIAGNOSTICS_DEBOUNCE_MS = 300;

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const rootDir = workspaceFolder ?? path.dirname(context.extensionPath);
  const typesDir = path.join(context.extensionPath, "types");
  const libDir = path.join(context.extensionPath, "lib");
  const service = new BelziumLanguageService({ rootDir, typesDir, libDir });

  const diagnostics = vscode.languages.createDiagnosticCollection("bel");
  context.subscriptions.push(diagnostics);

  let publishTimer: NodeJS.Timeout | undefined;

  const publishDiagnostics = (document: vscode.TextDocument): void => {
    if (document.languageId !== "bel") return;
    const items = service
      .getDiagnostics(document.uri.toString())
      .map(toVsCodeDiagnostic);
    diagnostics.set(document.uri, items);
  };

  const schedulePublish = (document: vscode.TextDocument): void => {
    if (publishTimer) clearTimeout(publishTimer);
    publishTimer = setTimeout(() => publishDiagnostics(document), DIAGNOSTICS_DEBOUNCE_MS);
  };

  const refresh = (document: vscode.TextDocument): void => {
    if (document.languageId !== "bel") return;
    service.updateDocument(document.uri.toString(), document.getText());
    schedulePublish(document);
  };

  for (const document of vscode.workspace.textDocuments) {
    if (document.languageId === "bel") {
      service.openDocument(document.uri.toString(), document.getText());
      schedulePublish(document);
    }
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.languageId !== "bel") return;
      service.openDocument(document.uri.toString(), document.getText());
      schedulePublish(document);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => refresh(event.document)),
    vscode.workspace.onDidSaveTextDocument(publishDiagnostics),
    vscode.workspace.onDidCloseTextDocument((document) =>
      service.closeDocument(document.uri.toString()),
    ),
  );

  // Completions de directivas @ (TS no conoce el marcador @).
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "bel",
      {
        provideCompletionItems(document, position) {
          const line = document.lineAt(position).text;
          if (!line.slice(0, position.character).endsWith("@")) return [];

          return DIRECTIVE_KEYWORDS.map((keyword) => {
            const item = new vscode.CompletionItem(
              `@${keyword}`,
              vscode.CompletionItemKind.Keyword,
            );
            item.insertText = `@${keyword} (`;
            return item;
          });
        },
      },
      "@",
    ),
  );

  // Completions reales vía el language service.
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider("bel", {
      provideCompletionItems(document, position) {
        const entries = service.getCompletionsAt(document.uri.toString(), {
          line: position.line,
          character: position.character,
        });
        return entries.map((entry) => {
          const item = new vscode.CompletionItem(
            entry.label,
            toVsCodeCompletionKind(entry.kind),
          );
          item.insertText = entry.insertText ?? entry.label;
          return item;
        });
      },
    }),
  );

  // Hover.
  context.subscriptions.push(
    vscode.languages.registerHoverProvider("bel", {
      provideHover(document, position) {
        const hover = service.getHoverAt(document.uri.toString(), {
          line: position.line,
          character: position.character,
        });
        if (!hover) return null;
        return toVsCodeHover(hover);
      },
    }),
  );

  // Definición.
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider("bel", {
      provideDefinition(document, position) {
        const definitions = service.getDefinitionAt(document.uri.toString(), {
          line: position.line,
          character: position.character,
        });
        return definitions.map(toVsCodeDefinition);
      },
    }),
  );

  // Tokens semánticos (colorean directivas @ y decoradores, que TS no ve).
  const semanticTokenTypes = ["keyword", "decorator", "type"];
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      "bel",
      {
        provideDocumentSemanticTokens(document) {
          const tokens = service.getSemanticTokens(document.uri.toString());
          const builder = new vscode.SemanticTokensBuilder(
            new vscode.SemanticTokensLegend(semanticTokenTypes),
          );
          for (const token of tokens) {
            builder.push(tokenRange(token), token.tokenType);
          }
          return builder.build();
        },
      },
      new vscode.SemanticTokensLegend(semanticTokenTypes),
    ),
  );

  // Plegado de bloques (directivas @ + clases/métodos/comentarios).
  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider("bel", {
      provideFoldingRanges(document) {
        return service.getFoldingRanges(document.uri.toString()).map((fold) => {
          return new vscode.FoldingRange(
            fold.start.line,
            fold.end.line,
            fold.kind === "comment"
              ? vscode.FoldingRangeKind.Comment
              : vscode.FoldingRangeKind.Region,
          );
        });
      },
    }),
  );
}

export function deactivate(): void {}

// --------------------------------------------------------------------------
// Conversión a tipos de vscode
// --------------------------------------------------------------------------

function toVsCodeDiagnostic(d: BelDiagnostic): vscode.Diagnostic {
  const range = new vscode.Range(
    d.start.line,
    d.start.character,
    d.end.line,
    d.end.character,
  );
  const severity = toVsCodeSeverity(d.severity);
  const diagnostic = new vscode.Diagnostic(range, d.message, severity);
  diagnostic.source = "bel";
  if (d.code !== undefined) diagnostic.code = d.code;
  return diagnostic;
}

function toVsCodeSeverity(
  severity: BelDiagnostic["severity"],
): vscode.DiagnosticSeverity {
  switch (severity) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    case "info":
      return vscode.DiagnosticSeverity.Information;
    case "hint":
      return vscode.DiagnosticSeverity.Hint;
  }
}

function toVsCodeHover(hover: BelHover): vscode.Hover {
  const contents = new vscode.MarkdownString("```ts\n" + hover.contents + "\n```");
  let range: vscode.Range | undefined;
  if (hover.range) {
    range = toVsCodeRange(hover.range);
  }
  return new vscode.Hover(contents, range);
}

function toVsCodeDefinition(def: BelDefinition): vscode.Location {
  const uri = vscode.Uri.parse(def.uri);
  return new vscode.Location(uri, toVsCodeRange(def));
}

function toVsCodeRange(
  range: { start: SourcePosition; end: SourcePosition },
): vscode.Range {
  return new vscode.Range(
    range.start.line,
    range.start.character,
    range.end.line,
    range.end.character,
  );
}

function tokenRange(token: {
  start: SourcePosition;
  length: number;
}): vscode.Range {
  return new vscode.Range(
    token.start.line,
    token.start.character,
    token.start.line,
    token.start.character + token.length,
  );
}

function toVsCodeCompletionKind(kind: string | undefined): vscode.CompletionItemKind {
  switch (kind?.toLowerCase()) {
    case "method":
    case "getter":
    case "setter":
      return vscode.CompletionItemKind.Method;
    case "function":
      return vscode.CompletionItemKind.Function;
    case "constructor":
      return vscode.CompletionItemKind.Constructor;
    case "property":
    case "field":
    case "member":
      return vscode.CompletionItemKind.Property;
    case "variable":
    case "local variable":
    case "parameter":
      return vscode.CompletionItemKind.Variable;
    case "class":
      return vscode.CompletionItemKind.Class;
    case "interface":
      return vscode.CompletionItemKind.Interface;
    case "enum":
      return vscode.CompletionItemKind.Enum;
    case "enum member":
      return vscode.CompletionItemKind.EnumMember;
    case "module":
      return vscode.CompletionItemKind.Module;
    case "keyword":
      return vscode.CompletionItemKind.Keyword;
    case "constant":
      return vscode.CompletionItemKind.Constant;
    case "type":
    case "primitive type":
      return vscode.CompletionItemKind.Class;
    default:
      return vscode.CompletionItemKind.Value;
  }
}
