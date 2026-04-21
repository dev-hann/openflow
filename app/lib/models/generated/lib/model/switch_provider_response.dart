//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class SwitchProviderResponse {
  /// Returns a new [SwitchProviderResponse] instance.
  SwitchProviderResponse({
    required this.providerId,
  });

  String providerId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SwitchProviderResponse && other.providerId == providerId;

  @override
  int get hashCode =>
      // ignore: unnecessary_parenthesis
      (providerId.hashCode);

  @override
  String toString() => 'SwitchProviderResponse[providerId=$providerId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    json[r'providerId'] = this.providerId;
    return json;
  }

  /// Returns a new [SwitchProviderResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static SwitchProviderResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        assert(json.containsKey(r'providerId'),
            'Required key "SwitchProviderResponse[providerId]" is missing from JSON.');
        assert(json[r'providerId'] != null,
            'Required key "SwitchProviderResponse[providerId]" has a null value in JSON.');
        return true;
      }());

      return SwitchProviderResponse(
        providerId: mapValueOfType<String>(json, r'providerId')!,
      );
    }
    return null;
  }

  static List<SwitchProviderResponse> listFromJson(
    dynamic json, {
    bool growable = false,
  }) {
    final result = <SwitchProviderResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = SwitchProviderResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, SwitchProviderResponse> mapFromJson(dynamic json) {
    final map = <String, SwitchProviderResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = SwitchProviderResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of SwitchProviderResponse-objects as value to a dart map
  static Map<String, List<SwitchProviderResponse>> mapListFromJson(
    dynamic json, {
    bool growable = false,
  }) {
    final map = <String, List<SwitchProviderResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = SwitchProviderResponse.listFromJson(
          entry.value,
          growable: growable,
        );
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'providerId',
  };
}
