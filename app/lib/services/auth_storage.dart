import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/protocol.dart';

class AuthStorage {
  static const _key = 'openflow_auth';
  final FlutterSecureStorage _storage;

  AuthStorage() : _storage = const FlutterSecureStorage();

  Future<void> saveAuth(StoredAuth auth) async {
    await _storage.write(key: _key, value: jsonEncode(auth.toJson()));
  }

  Future<StoredAuth?> loadAuth() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return null;
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      return StoredAuth.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearAuth() async {
    await _storage.delete(key: _key);
  }
}
