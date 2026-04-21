//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class SwitchProviderRequest {
  /// Returns a new [SwitchProviderRequest] instance.
  SwitchProviderRequest({
    required this.providerId,
  });

  String providerId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SwitchProviderRequest && other.providerId == providerId;

  @override
  int get hashCode =>
      // ignore: unnecessary_parenthesis
      (providerId.hashCode);

  @override
  String toString() => 'SwitchProviderRequest[providerId=$providerId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    json[r'providerId'] = this.providerId;
    return json;
  }

  /// Returns a new [SwitchProviderRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static SwitchProviderRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        assert(json.containsKey(r'providerId'),
            'Required key "SwitchProviderRequest[providerId]" is missing from JSON.');
        assert(json[r'providerId'] != null,
            'Required key "SwitchProviderRequest[providerId]" has a null value in JSON.');
        return true;
      }());

      return SwitchProviderRequest(
        providerId: mapValueOfType<String>(json, r'providerId')!,
      );
    }
    return null;
  }

  static List<SwitchProviderRequest> listFromJson(
    dynamic json, {
    bool growable = false,
  }) {
    final result = <SwitchProviderRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = SwitchProviderRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, SwitchProviderRequest> mapFromJson(dynamic json) {
    final map = <String, SwitchProviderRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = SwitchProviderRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of SwitchProviderRequest-objects as value to a dart map
  static Map<String, List<SwitchProviderRequest>> mapListFromJson(
    dynamic json, {
    bool growable = false,
  }) {
    final map = <String, List<SwitchProviderRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = SwitchProviderRequest.listFromJson(
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
