import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/format_time.dart';
import 'package:openflow/widgets/typing_indicator.dart';

class MessageBubble extends StatelessWidget {

  const MessageBubble({
    required this.message, super.key,
    this.isFirstInGroup = true,
    this.isLastInGroup = true,
    this.onRetry,
  });
  final ChatMessage message;
  final bool isFirstInGroup;
  final bool isLastInGroup;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isUser = message.role == MessageRole.user;

    return Padding(
      padding: EdgeInsets.only(
        left: isUser ? 48 : Spacing.md,
        right: isUser ? Spacing.md : 48,
        top: isFirstInGroup ? Spacing.sm : 2,
        bottom: isLastInGroup ? Spacing.sm : 2,
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
              Flexible(child: _buildBubble(context, theme, isUser)),
            ],
          ),
          if (isLastInGroup && message.isFailed)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: TextButton.icon(
                onPressed: onRetry,
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
    final radius = BorderRadius.only(
      topLeft: isUser || !isFirstInGroup
          ? const Radius.circular(16)
          : const Radius.circular(4),
      topRight: !isUser || !isFirstInGroup
          ? const Radius.circular(16)
          : const Radius.circular(4),
      bottomLeft: isUser || !isLastInGroup
          ? const Radius.circular(16)
          : const Radius.circular(4),
      bottomRight: !isUser || !isLastInGroup
          ? const Radius.circular(16)
          : const Radius.circular(4),
    );

    final bgColor = isUser
        ? theme.colorScheme.primary
        : theme.colorScheme.surfaceContainerHighest;
    final fgColor = isUser
        ? theme.colorScheme.onPrimary
        : theme.colorScheme.onSurface;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
              styleSheet: MarkdownStyleSheet(
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
              ),
            ),
          if (isLastInGroup) ...[
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
