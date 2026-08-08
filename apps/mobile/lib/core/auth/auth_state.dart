import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

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

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  @override
  AuthState build() {
    Future.microtask(_restore);
    return const AuthState();
  }

  Future<void> _restore() async {
    final token = await _storage.read(key: _tokenKey);
    final refresh = await _storage.read(key: _refreshKey);
    if (token != null) {
      state = state.copyWith(accessToken: token, refreshToken: refresh);
    }
  }

  Future<void> login({required String email, required String password}) async {
    final client = ApiClient(
      baseUrl: const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://localhost:8000',
      ),
    );
    final data = await client.post('/api/v1/auth/login', body: {
      'email': email,
      'password': password,
    });
    final access = data['access_token'] as String;
    final refresh = data['refresh_token'] as String?;
    await _storage.write(key: _tokenKey, value: access);
    if (refresh != null) await _storage.write(key: _refreshKey, value: refresh);
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
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _refreshKey);
    state = const AuthState();
  }

  bool hasPermission(String permission) => state.permissions.contains(permission);
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);
