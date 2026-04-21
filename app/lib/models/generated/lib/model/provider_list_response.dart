//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ProviderListResponse {
  /// Returns a new [ProviderListResponse] instance.
  ProviderListResponse({
    this.providers = const [],
    required this.activeProviderId,
  });

  List<ProviderResponse> providers;

  String activeProviderId;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ProviderListResponse &&
    _deepEquality.equals(other.providers, providers) &&
    other.activeProviderId == activeProviderId;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (providers.hashCode) +
    (activeProviderId.hashCode);

  @override
  String toString() => 'ProviderListResponse[providers=$providers, activeProviderId=$activeProviderId]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'providers'] = this.providers;
      json[r'activeProviderId'] = this.activeProviderId;
    return json;
  }

  /// Returns a new [ProviderListResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ProviderListResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        assert(json.containsKey(r'providers'), 'Required key "ProviderListResponse[providers]" is missing from JSON.');
        assert(json[r'providers'] != null, 'Required key "ProviderListResponse[providers]" has a null value in JSON.');
        assert(json.containsKey(r'activeProviderId'), 'Required key "ProviderListResponse[activeProviderId]" is missing from JSON.');
        assert(json[r'activeProviderId'] != null, 'Required key "ProviderListResponse[activeProviderId]" has a null value in JSON.');
        return true;
      }());

      return ProviderListResponse(
        providers: ProviderResponse.listFromJson(json[r'providers']),
        activeProviderId: mapValueOfType<String>(json, r'activeProviderId')!,
      );
    }
    return null;
  }

  static List<ProviderListResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ProviderListResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ProviderListResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ProviderListResponse> mapFromJson(dynamic json) {
    final map = <String, ProviderListResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ProviderListResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ProviderListResponse-objects as value to a dart map
  static Map<String, List<ProviderListResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ProviderListResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ProviderListResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'providers',
    'activeProviderId',
  };
}

