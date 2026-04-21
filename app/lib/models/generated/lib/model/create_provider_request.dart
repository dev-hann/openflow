//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class CreateProviderRequest {
  /// Returns a new [CreateProviderRequest] instance.
  CreateProviderRequest({
    required this.name,
    required this.baseUrl,
    required this.apiKey,
    required this.model,
    this.isDefault = false,
  });

  String name;

  String baseUrl;

  String apiKey;

  String model;

  bool isDefault;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CreateProviderRequest &&
          other.name == name &&
          other.baseUrl == baseUrl &&
          other.apiKey == apiKey &&
          other.model == model &&
          other.isDefault == isDefault;

  @override
  int get hashCode =>
      // ignore: unnecessary_parenthesis
      (name.hashCode) +
      (baseUrl.hashCode) +
      (apiKey.hashCode) +
      (model.hashCode) +
      (isDefault.hashCode);

  @override
  String toString() =>
      'CreateProviderRequest[name=$name, baseUrl=$baseUrl, apiKey=$apiKey, model=$model, isDefault=$isDefault]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    json[r'name'] = this.name;
    json[r'baseUrl'] = this.baseUrl;
    json[r'apiKey'] = this.apiKey;
    json[r'model'] = this.model;
    json[r'isDefault'] = this.isDefault;
    return json;
  }

  /// Returns a new [CreateProviderRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static CreateProviderRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        assert(json.containsKey(r'name'),
            'Required key "CreateProviderRequest[name]" is missing from JSON.');
        assert(json[r'name'] != null,
            'Required key "CreateProviderRequest[name]" has a null value in JSON.');
        assert(json.containsKey(r'baseUrl'),
            'Required key "CreateProviderRequest[baseUrl]" is missing from JSON.');
        assert(json[r'baseUrl'] != null,
            'Required key "CreateProviderRequest[baseUrl]" has a null value in JSON.');
        assert(json.containsKey(r'apiKey'),
            'Required key "CreateProviderRequest[apiKey]" is missing from JSON.');
        assert(json[r'apiKey'] != null,
            'Required key "CreateProviderRequest[apiKey]" has a null value in JSON.');
        assert(json.containsKey(r'model'),
            'Required key "CreateProviderRequest[model]" is missing from JSON.');
        assert(json[r'model'] != null,
            'Required key "CreateProviderRequest[model]" has a null value in JSON.');
        return true;
      }());

      return CreateProviderRequest(
        name: mapValueOfType<String>(json, r'name')!,
        baseUrl: mapValueOfType<String>(json, r'baseUrl')!,
        apiKey: mapValueOfType<String>(json, r'apiKey')!,
        model: mapValueOfType<String>(json, r'model')!,
        isDefault: mapValueOfType<bool>(json, r'isDefault') ?? false,
      );
    }
    return null;
  }

  static List<CreateProviderRequest> listFromJson(
    dynamic json, {
    bool growable = false,
  }) {
    final result = <CreateProviderRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = CreateProviderRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, CreateProviderRequest> mapFromJson(dynamic json) {
    final map = <String, CreateProviderRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = CreateProviderRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of CreateProviderRequest-objects as value to a dart map
  static Map<String, List<CreateProviderRequest>> mapListFromJson(
    dynamic json, {
    bool growable = false,
  }) {
    final map = <String, List<CreateProviderRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = CreateProviderRequest.listFromJson(
          entry.value,
          growable: growable,
        );
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'name',
    'baseUrl',
    'apiKey',
    'model',
  };
}
