import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:markdown/markdown.dart' as md;
import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/format_time.dart';
import 'package:openflow/utils/markdown_styles.dart';
import 'package:openflow/widgets/message_actions.dart';
import 'package:openflow/widgets/streaming_cursor.dart';
import 'package:openflow/widgets/typing_indicator.dart';
import 'package:shadcn_ui/shadcn_ui.dart';
import 'package:url_launcher/url_launcher.dart';

class MessageBubble extends StatefulWidget {
  const MessageBubble({
    required this.message,
    super.key,
    this.isFirstInGroup = true,
    this.isLastInGroup = true,
    this.isLastAssistant = false,
    this.onRetry,
    this.onEdit,
  });

  final ChatMessage message;
  final bool isFirstInGroup;
  final bool isLastInGroup;
  final bool isLastAssistant;
  final VoidCallback? onRetry;
  final VoidCallback? onEdit;

  @override
  State<MessageBubble> createState() => _MessageBubbleState();
}

class _MessageBubbleState extends State<MessageBubble> {
  MarkdownStyleSheet? _cachedStyleSheet;
  ShadThemeData? _cachedTheme;

  MarkdownStyleSheet _getStyleSheet(ShadThemeData theme, Color fgColor) {
    if (_cachedStyleSheet != null && identical(_cachedTheme, theme)) {
      return _cachedStyleSheet!;
    }
    _cachedStyleSheet = buildMarkdownStyleSheet(theme, fgColor);
    _cachedTheme = theme;
    return _cachedStyleSheet!;
  }

  void _handleLinkTap(String text, String? href, String title) {
    if (href == null) return;
    final uri = Uri.tryParse(href);
    if (uri != null) {
      launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = ShadTheme.of(context);
    final message = widget.message;
    final isUser = message.role == MessageRole.user;

    if (!isUser && !message.isStreaming && message.content.isEmpty) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: EdgeInsets.only(
        left: isUser ? 48 : AppSpacing.md,
        right: isUser ? AppSpacing.md : 48,
        top: widget.isFirstInGroup ? AppSpacing.sm : 2,
        bottom: widget.isLastInGroup ? AppSpacing.sm : 2,
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
                  child: _buildBubble(context, theme, isUser),
                ),
              ),
            ],
          ),
          if (widget.isLastInGroup && !message.isStreaming)
            _buildActions(isUser),
        ],
      ),
    );
  }

  Widget _buildAvatar(ShadThemeData theme) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: CircleAvatar(
        radius: 14,
        backgroundColor: theme.colorScheme.secondary,
        child: Icon(
          Icons.smart_toy_outlined,
          size: 16,
          color: theme.colorScheme.secondaryForeground,
        ),
      ),
    );
  }

  Widget _buildActions(bool isUser) {
    return Padding(
      padding: EdgeInsets.only(
        left: isUser ? 0 : 48,
        top: 2,
      ),
      child: MessageActions(
        message: widget.message,
        isLastAssistant: widget.isLastAssistant,
        onRegenerate: widget.onRetry,
        onEdit: widget.onEdit,
      ),
    );
  }

  Widget _buildBubble(BuildContext context, ShadThemeData theme, bool isUser) {
    final bgColor = isUser
        ? theme.colorScheme.primary
        : theme.colorScheme.card;
    final fgColor =
        isUser ? theme.colorScheme.primaryForeground : theme.colorScheme.foreground;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: _buildRadius(isUser),
      ),
      child: _buildContent(context, theme, isUser, fgColor),
    );
  }

  BorderRadius _buildRadius(bool isUser) {
    return BorderRadius.only(
      topLeft: isUser || !widget.isFirstInGroup
          ? const Radius.circular(AppRadius.lg)
          : const Radius.circular(4),
      topRight: !isUser || !widget.isFirstInGroup
          ? const Radius.circular(AppRadius.lg)
          : const Radius.circular(4),
      bottomLeft: isUser || !widget.isLastInGroup
          ? const Radius.circular(AppRadius.lg)
          : const Radius.circular(4),
      bottomRight: !isUser || !widget.isLastInGroup
          ? const Radius.circular(AppRadius.lg)
          : const Radius.circular(4),
    );
  }

  Widget _buildContent(
    BuildContext context,
    ShadThemeData theme,
    bool isUser,
    Color fgColor,
  ) {
    final message = widget.message;
    return Column(
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
            extensionSet: md.ExtensionSet.gitHubWeb,
            styleSheet: _getStyleSheet(theme, fgColor),
            onTapLink: _handleLinkTap,
          ),
        if (message.isStreaming && message.content.isNotEmpty)
          StreamingCursor(color: theme.colorScheme.primary),
        if (widget.isLastInGroup && !message.isStreaming) ...[
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
    );
  }
}
