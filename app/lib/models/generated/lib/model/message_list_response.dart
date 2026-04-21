//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class MessageListResponse {
  /// Returns a new [MessageListResponse] instance.
  MessageListResponse({
    this.messages = const [],
    required this.total,
  });

  List<ChatMessageResponse> messages;

  int total;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MessageListResponse &&
          _deepEquality.equals(other.messages, messages) &&
          other.total == total;

  @override
  int get hashCode =>
      // ignore: unnecessary_parenthesis
      (messages.hashCode) + (total.hashCode);

  @override
  String toString() => 'MessageListResponse[messages=$messages, total=$total]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    json[r'messages'] = this.messages;
    json[r'total'] = this.total;
    return json;
  }

  /// Returns a new [MessageListResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static MessageListResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        assert(json.containsKey(r'messages'),
            'Required key "MessageListResponse[messages]" is missing from JSON.');
        assert(json[r'messages'] != null,
            'Required key "MessageListResponse[messages]" has a null value in JSON.');
        assert(json.containsKey(r'total'),
            'Required key "MessageListResponse[total]" is missing from JSON.');
        assert(json[r'total'] != null,
            'Required key "MessageListResponse[total]" has a null value in JSON.');
        return true;
      }());

      return MessageListResponse(
        messages: ChatMessageResponse.listFromJson(json[r'messages']),
        total: mapValueOfType<int>(json, r'total')!,
      );
    }
    return null;
  }

  static List<MessageListResponse> listFromJson(
    dynamic json, {
    bool growable = false,
  }) {
    final result = <MessageListResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = MessageListResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, MessageListResponse> mapFromJson(dynamic json) {
    final map = <String, MessageListResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = MessageListResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of MessageListResponse-objects as value to a dart map
  static Map<String, List<MessageListResponse>> mapListFromJson(
    dynamic json, {
    bool growable = false,
  }) {
    final map = <String, List<MessageListResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = MessageListResponse.listFromJson(
          entry.value,
          growable: growable,
        );
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'messages',
    'total',
  };
}
