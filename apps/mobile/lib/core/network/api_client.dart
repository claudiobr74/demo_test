import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../auth/auth_state.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  final auth = ref.watch(authControllerProvider);
  return ApiClient(
    baseUrl: const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:8000',
    ),
    accessToken: auth.accessToken,
  );
});

class ApiClient {
  ApiClient({required this.baseUrl, this.accessToken});

  final String baseUrl;
  final String? accessToken;

  Future<Map<String, dynamic>> get(String path) async {
    final response = await http.get(_uri(path), headers: _headers());
    return _decode(response);
  }

  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    final response = await http.post(
      _uri(path),
      headers: _headers(),
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> patch(String path, {Map<String, dynamic>? body}) async {
    final response = await http.patch(
      _uri(path),
      headers: _headers(),
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(response);
  }

  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Map<String, String> _headers() => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (accessToken != null) 'Authorization': 'Bearer $accessToken',
      };

  Map<String, dynamic> _decode(http.Response response) {
    final map = response.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw ApiException(
        code: map['code'] as String? ?? 'HTTP_${response.statusCode}',
        message: map['message'] as String? ?? 'Falha na requisição',
        requestId: map['request_id'] as String?,
        statusCode: response.statusCode,
      );
    }
    return map;
  }
}

class ApiException implements Exception {
  ApiException({
    required this.code,
    required this.message,
    this.requestId,
    this.statusCode,
  });

  final String code;
  final String message;
  final String? requestId;
  final int? statusCode;

  @override
  String toString() => message;
}
