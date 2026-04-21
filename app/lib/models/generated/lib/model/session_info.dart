//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class SessionInfo {
  /// Returns a new [SessionInfo] instance.
  SessionInfo({
    required this.id,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
    required this.messageCount,
  });

  String id;

  String title;

  /// Epoch milliseconds
  int createdAt;

  /// Epoch milliseconds
  int updatedAt;

  int messageCount;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SessionInfo &&
          other.id == id &&
          other.title == title &&
          other.createdAt == createdAt &&
          other.updatedAt == updatedAt &&
          other.messageCount == messageCount;

  @override
  int get hashCode =>
      // ignore: unnecessary_parenthesis
      (id.hashCode) +
      (title.hashCode) +
      (createdAt.hashCode) +
      (updatedAt.hashCode) +
      (messageCount.hashCode);

  @override
  String toString() =>
      'SessionInfo[id=$id, title=$title, createdAt=$createdAt, updatedAt=$updatedAt, messageCount=$messageCount]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    json[r'id'] = this.id;
    json[r'title'] = this.title;
    json[r'createdAt'] = this.createdAt;
    json[r'updatedAt'] = this.updatedAt;
    json[r'messageCount'] = this.messageCount;
    return json;
  }

  /// Returns a new [SessionInfo] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static SessionInfo? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        assert(json.containsKey(r'id'),
            'Required key "SessionInfo[id]" is missing from JSON.');
        assert(json[r'id'] != null,
            'Required key "SessionInfo[id]" has a null value in JSON.');
        assert(json.containsKey(r'title'),
            'Required key "SessionInfo[title]" is missing from JSON.');
        assert(json[r'title'] != null,
            'Required key "SessionInfo[title]" has a null value in JSON.');
        assert(json.containsKey(r'createdAt'),
            'Required key "SessionInfo[createdAt]" is missing from JSON.');
        assert(json[r'createdAt'] != null,
            'Required key "SessionInfo[createdAt]" has a null value in JSON.');
        assert(json.containsKey(r'updatedAt'),
            'Required key "SessionInfo[updatedAt]" is missing from JSON.');
        assert(json[r'updatedAt'] != null,
            'Required key "SessionInfo[updatedAt]" has a null value in JSON.');
        assert(json.containsKey(r'messageCount'),
            'Required key "SessionInfo[messageCount]" is missing from JSON.');
        assert(json[r'messageCount'] != null,
            'Required key "SessionInfo[messageCount]" has a null value in JSON.');
        return true;
      }());

      return SessionInfo(
        id: mapValueOfType<String>(json, r'id')!,
        title: mapValueOfType<String>(json, r'title')!,
        createdAt: mapValueOfType<int>(json, r'createdAt')!,
        updatedAt: mapValueOfType<int>(json, r'updatedAt')!,
        messageCount: mapValueOfType<int>(json, r'messageCount')!,
      );
    }
    return null;
  }

  static List<SessionInfo> listFromJson(
    dynamic json, {
    bool growable = false,
  }) {
    final result = <SessionInfo>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = SessionInfo.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, SessionInfo> mapFromJson(dynamic json) {
    final map = <String, SessionInfo>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = SessionInfo.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of SessionInfo-objects as value to a dart map
  static Map<String, List<SessionInfo>> mapListFromJson(
    dynamic json, {
    bool growable = false,
  }) {
    final map = <String, List<SessionInfo>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = SessionInfo.listFromJson(
          entry.value,
          growable: growable,
        );
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'id',
    'title',
    'createdAt',
    'updatedAt',
    'messageCount',
  };
}
