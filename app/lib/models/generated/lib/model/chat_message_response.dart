//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ChatMessageResponse {
  /// Returns a new [ChatMessageResponse] instance.
  ChatMessageResponse({
    required this.role,
    required this.content,
    required this.createdAt,
  });

  ChatMessageResponseRoleEnum role;

  String content;

  /// Epoch milliseconds
  int createdAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ChatMessageResponse &&
    other.role == role &&
    other.content == content &&
    other.createdAt == createdAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (role.hashCode) +
    (content.hashCode) +
    (createdAt.hashCode);

  @override
  String toString() => 'ChatMessageResponse[role=$role, content=$content, createdAt=$createdAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'role'] = this.role;
      json[r'content'] = this.content;
      json[r'createdAt'] = this.createdAt;
    return json;
  }

  /// Returns a new [ChatMessageResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ChatMessageResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        assert(json.containsKey(r'role'), 'Required key "ChatMessageResponse[role]" is missing from JSON.');
        assert(json[r'role'] != null, 'Required key "ChatMessageResponse[role]" has a null value in JSON.');
        assert(json.containsKey(r'content'), 'Required key "ChatMessageResponse[content]" is missing from JSON.');
        assert(json[r'content'] != null, 'Required key "ChatMessageResponse[content]" has a null value in JSON.');
        assert(json.containsKey(r'createdAt'), 'Required key "ChatMessageResponse[createdAt]" is missing from JSON.');
        assert(json[r'createdAt'] != null, 'Required key "ChatMessageResponse[createdAt]" has a null value in JSON.');
        return true;
      }());

      return ChatMessageResponse(
        role: ChatMessageResponseRoleEnum.fromJson(json[r'role'])!,
        content: mapValueOfType<String>(json, r'content')!,
        createdAt: mapValueOfType<int>(json, r'createdAt')!,
      );
    }
    return null;
  }

  static List<ChatMessageResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ChatMessageResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ChatMessageResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ChatMessageResponse> mapFromJson(dynamic json) {
    final map = <String, ChatMessageResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ChatMessageResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ChatMessageResponse-objects as value to a dart map
  static Map<String, List<ChatMessageResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ChatMessageResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ChatMessageResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'role',
    'content',
    'createdAt',
  };
}


class ChatMessageResponseRoleEnum {
  /// Instantiate a new enum with the provided [value].
  const ChatMessageResponseRoleEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const user = ChatMessageResponseRoleEnum._(r'user');
  static const assistant = ChatMessageResponseRoleEnum._(r'assistant');

  /// List of all possible values in this [enum][ChatMessageResponseRoleEnum].
  static const values = <ChatMessageResponseRoleEnum>[
    user,
    assistant,
  ];

  static ChatMessageResponseRoleEnum? fromJson(dynamic value) => ChatMessageResponseRoleEnumTypeTransformer().decode(value);

  static List<ChatMessageResponseRoleEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ChatMessageResponseRoleEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ChatMessageResponseRoleEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [ChatMessageResponseRoleEnum] to String,
/// and [decode] dynamic data back to [ChatMessageResponseRoleEnum].
class ChatMessageResponseRoleEnumTypeTransformer {
  factory ChatMessageResponseRoleEnumTypeTransformer() => _instance ??= const ChatMessageResponseRoleEnumTypeTransformer._();

  const ChatMessageResponseRoleEnumTypeTransformer._();

  String encode(ChatMessageResponseRoleEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a ChatMessageResponseRoleEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  ChatMessageResponseRoleEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'user': return ChatMessageResponseRoleEnum.user;
        case r'assistant': return ChatMessageResponseRoleEnum.assistant;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [ChatMessageResponseRoleEnumTypeTransformer] instance.
  static ChatMessageResponseRoleEnumTypeTransformer? _instance;
}


