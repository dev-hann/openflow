import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:flutter_markdown/flutter_markdown.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/format_time.dart';
import 'package:openflow/widgets/typing_indicator.dart';

class MessageBubble extends StatefulWidget {
  const MessageBubble({
    required this.message,
    super.key,
    this.isFirstInGroup = true,
    this.isLastInGroup = true,
    this.onRetry,
  });
  final ChatMessage message;
  final bool isFirstInGroup;
  final bool isLastInGroup;
  final VoidCallback? onRetry;

  @override
  State<MessageBubble> createState() => _MessageBubbleState();
}

class _MessageBubbleState extends State<MessageBubble> {
  MarkdownStyleSheet? _cachedStyleSheet;
  ThemeData? _cachedTheme;

  MarkdownStyleSheet _getStyleSheet(ThemeData theme, Color fgColor) {
    if (_cachedStyleSheet != null && identical(_cachedTheme, theme)) {
      return _cachedStyleSheet!;
    }
    _cachedStyleSheet = MarkdownStyleSheet(
      p: TextStyle(color: fgColor, fontSize: 15, height: 1.5),
      code: TextStyle(
        color: fgColor,
        backgroundColor: theme.colorScheme.surfaceContainerHigh,
        fontSize: 13,
      ),
      codeblockDecoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(8),
      ),
    );
    _cachedTheme = theme;
    return _cachedStyleSheet!;
  }

  void _showContextMenu() {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.copy),
              title: const Text('복사'),
              onTap: () {
                Clipboard.setData(ClipboardData(text: widget.message.content));
                Navigator.pop(ctx);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final message = widget.message;
    final isUser = message.role == MessageRole.user;

    return Padding(
      padding: EdgeInsets.only(
        left: isUser ? 48 : Spacing.md,
        right: isUser ? Spacing.md : 48,
        top: widget.isFirstInGroup ? Spacing.sm : 2,
        bottom: widget.isLastInGroup ? Spacing.sm : 2,
      ),
      child: Column(
        crossAxisAlignment:
            isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment:
                isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (!isUser) _buildAvatar(theme),
              Flexible(
                child: Semantics(
                  label: isUser ? '내 메시지' : 'AI 응답',
                  child: GestureDetector(
                    onLongPress: _showContextMenu,
                    child: _buildBubble(context, theme, isUser),
                  ),
                ),
              ),
            ],
          ),
          if (widget.isLastInGroup && message.isFailed)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: TextButton.icon(
                onPressed: widget.onRetry,
                icon: const Icon(Icons.refresh, size: 14),
                label: const Text('재시도'),
                style: TextButton.styleFrom(
                  foregroundColor: theme.colorScheme.error,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildAvatar(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: CircleAvatar(
        radius: 14,
        backgroundColor: theme.colorScheme.primaryContainer,
        child: Icon(
          Icons.smart_toy_outlined,
          size: 16,
          color: theme.colorScheme.onPrimaryContainer,
        ),
      ),
    );
  }

  Widget _buildBubble(BuildContext context, ThemeData theme, bool isUser) {
    final message = widget.message;
    final radius = BorderRadius.only(
      topLeft: isUser || !widget.isFirstInGroup
          ? const Radius.circular(16)
          : const Radius.circular(4),
      topRight: !isUser || !widget.isFirstInGroup
          ? const Radius.circular(16)
          : const Radius.circular(4),
      bottomLeft: isUser || !widget.isLastInGroup
          ? const Radius.circular(16)
          : const Radius.circular(4),
      bottomRight: !isUser || !widget.isLastInGroup
          ? const Radius.circular(16)
          : const Radius.circular(4),
    );

    final bgColor = isUser
        ? theme.colorScheme.primary
        : theme.colorScheme.surfaceContainerHighest;
    final fgColor =
        isUser ? theme.colorScheme.onPrimary : theme.colorScheme.onSurface;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: Spacing.md,
        vertical: Spacing.sm,
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: radius,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (message.isStreaming && message.content.isEmpty)
            TypingIndicator(color: fgColor)
          else if (isUser)
            SelectableText(
              message.content,
              style: TextStyle(color: fgColor, fontSize: 15),
            )
          else
            MarkdownBody(
              data: message.content,
              selectable: true,
              styleSheet: _getStyleSheet(theme, fgColor),
            ),
          if (widget.isLastInGroup) ...[
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                formatTime(message.timestamp),
                style: TextStyle(
                  color: fgColor.withValues(alpha: 0.6),
                  fontSize: 11,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
