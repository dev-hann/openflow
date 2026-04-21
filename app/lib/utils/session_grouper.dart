import 'package:openflow/models/protocol.dart';

Map<String, List<SessionInfo>> groupSessionsByDate(List<SessionInfo> sessions) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final yesterday = today.subtract(const Duration(days: 1));
  final weekAgo = today.subtract(const Duration(days: 7));

  final groups = <String, List<SessionInfo>>{
    '오늘': [],
    '어제': [],
    '지난 7일': [],
    '이전': [],
  };

  for (final session in sessions) {
    final date = DateTime(
      session.createdAt.year,
      session.createdAt.month,
      session.createdAt.day,
    );
    if (date == today) {
      groups['오늘']!.add(session);
    } else if (date == yesterday) {
      groups['어제']!.add(session);
    } else if (date.isAfter(weekAgo)) {
      groups['지난 7일']!.add(session);
    } else {
      groups['이전']!.add(session);
    }
  }

  return groups..removeWhere((_, v) => v.isEmpty);
}
