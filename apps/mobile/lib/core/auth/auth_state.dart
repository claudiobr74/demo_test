import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';

class AuthState {
  const AuthState({
    this.accessToken,
    this.refreshToken,
    this.userName,
    this.organizationName,
    this.permissions = const [],
  });

  final String? accessToken;
  final String? refreshToken;
  final String? userName;
  final String? organizationName;
  final List<String> permissions;

  bool get isAuthenticated => accessToken != null && accessToken!.isNotEmpty;

  AuthState copyWith({
    String? accessToken,
    String? refreshToken,
    String? userName,
    String? organizationName,
    List<String>? permissions,
  }) {
    return AuthState(
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      userName: userName ?? this.userName,
      organizationName: organizationName ?? this.organizationName,
      permissions: permissions ?? this.permissions,
    );
  }
}

class AuthController extends Notifier<AuthState> {
  static const _tokenKey = 'serenapsi_access_token';
  static const _refreshKey = 'serenapsi_refresh_token';

  @override
  AuthState build() {
    Future.microtask(_restore);
    return const AuthState();
  }

  Future<void> _restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString(_tokenKey);
      final refresh = prefs.getString(_refreshKey);
      if (token != null && token.isNotEmpty) {
        state = state.copyWith(accessToken: token, refreshToken: refresh);
      }
    } catch (_) {
      // Web/local storage pode falhar; login ainda funciona na sessão atual.
    }
  }

  Future<void> login({required String email, required String password}) async {
    final client = ApiClient(baseUrl: resolveApiBaseUrl());
    final data = await client.post('/api/v1/auth/login', body: {
      'email': email,
      'password': password,
    });
    final access = data['access_token'] as String;
    final refresh = data['refresh_token'] as String?;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, access);
      if (refresh != null) await prefs.setString(_refreshKey, refresh);
    } catch (_) {
      // Não bloqueia o login se o storage falhar (comum em alguns contextos web).
    }

    state = AuthState(
      accessToken: access,
      refreshToken: refresh,
      userName: (data['user'] as Map?)?['full_name'] as String?,
      organizationName: (data['organization'] as Map?)?['name'] as String?,
      permissions: List<String>.from(
        ((data['membership'] as Map?)?['permissions'] as List?) ?? const [],
      ),
    );
  }

  Future<void> logout() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_tokenKey);
      await prefs.remove(_refreshKey);
    } catch (_) {}
    state = const AuthState();
  }

  bool hasPermission(String permission) => state.permissions.contains(permission);
}

/// Em web, default same-origin (via gateway :3000). Em outras plataformas, API local.
String resolveApiBaseUrl() {
  const fromEnv = String.fromEnvironment('API_BASE_URL');
  if (fromEnv.isNotEmpty) return fromEnv;
  if (kIsWeb) return '';
  return 'http://127.0.0.1:8000';
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);
