import 'package:flutter/material.dart';

import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

MarkdownStyleSheet buildMarkdownStyleSheet(ShadThemeData theme, Color fgColor) {
  final cs = theme.colorScheme;
  return MarkdownStyleSheet(
    p: TextStyle(color: fgColor, fontSize: 15, height: 1.5),
    h1: TextStyle(
      color: fgColor,
      fontSize: 22,
      fontWeight: FontWeight.bold,
      height: 1.4,
    ),
    h2: TextStyle(
      color: fgColor,
      fontSize: 18,
      fontWeight: FontWeight.bold,
      height: 1.4,
    ),
    h3: TextStyle(
      color: fgColor,
      fontSize: 16,
      fontWeight: FontWeight.w600,
      height: 1.4,
    ),
    code: TextStyle(color: fgColor, backgroundColor: cs.muted, fontSize: 13),
    codeblockDecoration: BoxDecoration(
      color: cs.muted,
      borderRadius: BorderRadius.circular(AppRadius.sm),
    ),
    blockquote: TextStyle(
      color: fgColor.withValues(alpha: 0.85),
      fontSize: 14,
      height: 1.5,
    ),
    blockquoteDecoration: BoxDecoration(
      color: cs.muted,
      borderRadius: BorderRadius.circular(4),
      border: Border(left: BorderSide(color: cs.primary, width: 3)),
    ),
    blockquotePadding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
    listBullet: TextStyle(color: cs.primary),
    tableHead: TextStyle(
      fontWeight: FontWeight.w600,
      fontSize: 13,
      color: fgColor,
    ),
    tableBody: TextStyle(fontSize: 13, color: fgColor),
    tableHeadAlign: TextAlign.center,
    tableBorder: TableBorder.all(color: cs.border, width: 0.5),
    tableCellsPadding: const EdgeInsets.all(6),
    em: TextStyle(fontStyle: FontStyle.italic, color: fgColor),
    strong: TextStyle(fontWeight: FontWeight.bold, color: fgColor),
    del: TextStyle(
      decoration: TextDecoration.lineThrough,
      color: fgColor.withValues(alpha: 0.6),
    ),
  );
}
