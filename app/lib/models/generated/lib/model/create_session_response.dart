//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class CreateSessionResponse {
  /// Returns a new [CreateSessionResponse] instance.
  CreateSessionResponse({
    required this.id,
    required this.title,
  });

  String id;

  String title;

  @override
  bool operator ==(Object other) => identical(this, other) || other is CreateSessionResponse &&
    other.id == id &&
    other.title == title;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id.hashCode) +
    (title.hashCode);

  @override
  String toString() => 'CreateSessionResponse[id=$id, title=$title]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'id'] = this.id;
      json[r'title'] = this.title;
    return json;
  }

  /// Returns a new [CreateSessionResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static CreateSessionResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        assert(json.containsKey(r'id'), 'Required key "CreateSessionResponse[id]" is missing from JSON.');
        assert(json[r'id'] != null, 'Required key "CreateSessionResponse[id]" has a null value in JSON.');
        assert(json.containsKey(r'title'), 'Required key "CreateSessionResponse[title]" is missing from JSON.');
        assert(json[r'title'] != null, 'Required key "CreateSessionResponse[title]" has a null value in JSON.');
        return true;
      }());

      return CreateSessionResponse(
        id: mapValueOfType<String>(json, r'id')!,
        title: mapValueOfType<String>(json, r'title')!,
      );
    }
    return null;
  }

  static List<CreateSessionResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <CreateSessionResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = CreateSessionResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, CreateSessionResponse> mapFromJson(dynamic json) {
    final map = <String, CreateSessionResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = CreateSessionResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of CreateSessionResponse-objects as value to a dart map
  static Map<String, List<CreateSessionResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<CreateSessionResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = CreateSessionResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'id',
    'title',
  };
}

