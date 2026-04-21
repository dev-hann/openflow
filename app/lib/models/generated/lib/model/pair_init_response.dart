//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PairInitResponse {
  /// Returns a new [PairInitResponse] instance.
  PairInitResponse({
    required this.expiresInMs,
  });

  int expiresInMs;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PairInitResponse &&
    other.expiresInMs == expiresInMs;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (expiresInMs.hashCode);

  @override
  String toString() => 'PairInitResponse[expiresInMs=$expiresInMs]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'expiresInMs'] = this.expiresInMs;
    return json;
  }

  /// Returns a new [PairInitResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PairInitResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        assert(json.containsKey(r'expiresInMs'), 'Required key "PairInitResponse[expiresInMs]" is missing from JSON.');
        assert(json[r'expiresInMs'] != null, 'Required key "PairInitResponse[expiresInMs]" has a null value in JSON.');
        return true;
      }());

      return PairInitResponse(
        expiresInMs: mapValueOfType<int>(json, r'expiresInMs')!,
      );
    }
    return null;
  }

  static List<PairInitResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PairInitResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PairInitResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PairInitResponse> mapFromJson(dynamic json) {
    final map = <String, PairInitResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PairInitResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PairInitResponse-objects as value to a dart map
  static Map<String, List<PairInitResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PairInitResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PairInitResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'expiresInMs',
  };
}

