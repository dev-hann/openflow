import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:openflow/models/protocol.dart';

class AuthStorage {
  AuthStorage() : _storage = const FlutterSecureStorage();
  static const _key = 'openflow_auth';
  final FlutterSecureStorage _storage;

  Future<void> saveAuth(StoredAuth auth) async {
    await _storage.write(key: _key, value: jsonEncode(auth.toJson()));
  }

  Future<StoredAuth?> loadAuth() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return null;
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      return StoredAuth.fromJson(json);
    } on Object catch (e) {
      debugPrint('[AuthStorage] Failed to load auth: $e');
      return null;
    }
  }

  Future<void> clearAuth() async {
    await _storage.delete(key: _key);
  }
}
