//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ProviderResponse {
  /// Returns a new [ProviderResponse] instance.
  ProviderResponse({
    required this.id,
    required this.name,
    required this.baseUrl,
    required this.apiKey,
    required this.model,
    required this.isDefault,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
  });

  String id;

  String name;

  String baseUrl;

  /// Masked API key (e.g. \"sk-t••••1234\")
  String apiKey;

  String model;

  bool isDefault;

  bool isActive;

  /// Epoch milliseconds
  int createdAt;

  /// Epoch milliseconds
  int updatedAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ProviderResponse &&
          other.id == id &&
          other.name == name &&
          other.baseUrl == baseUrl &&
          other.apiKey == apiKey &&
          other.model == model &&
          other.isDefault == isDefault &&
          other.isActive == isActive &&
          other.createdAt == createdAt &&
          other.updatedAt == updatedAt;

  @override
  int get hashCode =>
      // ignore: unnecessary_parenthesis
      (id.hashCode) +
      (name.hashCode) +
      (baseUrl.hashCode) +
      (apiKey.hashCode) +
      (model.hashCode) +
      (isDefault.hashCode) +
      (isActive.hashCode) +
      (createdAt.hashCode) +
      (updatedAt.hashCode);

  @override
  String toString() =>
      'ProviderResponse[id=$id, name=$name, baseUrl=$baseUrl, apiKey=$apiKey, model=$model, isDefault=$isDefault, isActive=$isActive, createdAt=$createdAt, updatedAt=$updatedAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    json[r'id'] = this.id;
    json[r'name'] = this.name;
    json[r'baseUrl'] = this.baseUrl;
    json[r'apiKey'] = this.apiKey;
    json[r'model'] = this.model;
    json[r'isDefault'] = this.isDefault;
    json[r'isActive'] = this.isActive;
    json[r'createdAt'] = this.createdAt;
    json[r'updatedAt'] = this.updatedAt;
    return json;
  }

  /// Returns a new [ProviderResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ProviderResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        assert(json.containsKey(r'id'),
            'Required key "ProviderResponse[id]" is missing from JSON.');
        assert(json[r'id'] != null,
            'Required key "ProviderResponse[id]" has a null value in JSON.');
        assert(json.containsKey(r'name'),
            'Required key "ProviderResponse[name]" is missing from JSON.');
        assert(json[r'name'] != null,
            'Required key "ProviderResponse[name]" has a null value in JSON.');
        assert(json.containsKey(r'baseUrl'),
            'Required key "ProviderResponse[baseUrl]" is missing from JSON.');
        assert(json[r'baseUrl'] != null,
            'Required key "ProviderResponse[baseUrl]" has a null value in JSON.');
        assert(json.containsKey(r'apiKey'),
            'Required key "ProviderResponse[apiKey]" is missing from JSON.');
        assert(json[r'apiKey'] != null,
            'Required key "ProviderResponse[apiKey]" has a null value in JSON.');
        assert(json.containsKey(r'model'),
            'Required key "ProviderResponse[model]" is missing from JSON.');
        assert(json[r'model'] != null,
            'Required key "ProviderResponse[model]" has a null value in JSON.');
        assert(json.containsKey(r'isDefault'),
            'Required key "ProviderResponse[isDefault]" is missing from JSON.');
        assert(json[r'isDefault'] != null,
            'Required key "ProviderResponse[isDefault]" has a null value in JSON.');
        assert(json.containsKey(r'isActive'),
            'Required key "ProviderResponse[isActive]" is missing from JSON.');
        assert(json[r'isActive'] != null,
            'Required key "ProviderResponse[isActive]" has a null value in JSON.');
        assert(json.containsKey(r'createdAt'),
            'Required key "ProviderResponse[createdAt]" is missing from JSON.');
        assert(json[r'createdAt'] != null,
            'Required key "ProviderResponse[createdAt]" has a null value in JSON.');
        assert(json.containsKey(r'updatedAt'),
            'Required key "ProviderResponse[updatedAt]" is missing from JSON.');
        assert(json[r'updatedAt'] != null,
            'Required key "ProviderResponse[updatedAt]" has a null value in JSON.');
        return true;
      }());

      return ProviderResponse(
        id: mapValueOfType<String>(json, r'id')!,
        name: mapValueOfType<String>(json, r'name')!,
        baseUrl: mapValueOfType<String>(json, r'baseUrl')!,
        apiKey: mapValueOfType<String>(json, r'apiKey')!,
        model: mapValueOfType<String>(json, r'model')!,
        isDefault: mapValueOfType<bool>(json, r'isDefault')!,
        isActive: mapValueOfType<bool>(json, r'isActive')!,
        createdAt: mapValueOfType<int>(json, r'createdAt')!,
        updatedAt: mapValueOfType<int>(json, r'updatedAt')!,
      );
    }
    return null;
  }

  static List<ProviderResponse> listFromJson(
    dynamic json, {
    bool growable = false,
  }) {
    final result = <ProviderResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ProviderResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ProviderResponse> mapFromJson(dynamic json) {
    final map = <String, ProviderResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ProviderResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ProviderResponse-objects as value to a dart map
  static Map<String, List<ProviderResponse>> mapListFromJson(
    dynamic json, {
    bool growable = false,
  }) {
    final map = <String, List<ProviderResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ProviderResponse.listFromJson(
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
    'name',
    'baseUrl',
    'apiKey',
    'model',
    'isDefault',
    'isActive',
    'createdAt',
    'updatedAt',
  };
}
