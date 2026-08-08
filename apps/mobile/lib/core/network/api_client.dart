import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../auth/auth_state.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  final auth = ref.watch(authControllerProvider);
  return ApiClient(
    baseUrl: resolveApiBaseUrl(),
    accessToken: auth.accessToken,
  );
});

class ApiClient {
  ApiClient({required this.baseUrl, this.accessToken});

  final String baseUrl;
  final String? accessToken;

  Future<Map<String, dynamic>> get(String path) async {
    try {
      final response = await http.get(_uri(path), headers: _headers());
      return _decode(response);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(
        code: 'NETWORK_ERROR',
        message:
            'Não foi possível conectar à API ($baseUrl$path). '
            'Use o gateway em http://127.0.0.1:3000 ou confira se a API está no ar.',
      );
    }
  }

  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    try {
      final response = await http.post(
        _uri(path),
        headers: _headers(),
        body: body == null ? null : jsonEncode(body),
      );
      return _decode(response);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(
        code: 'NETWORK_ERROR',
        message:
            'Não foi possível conectar à API. '
            'Abra o app por http://127.0.0.1:3000 (gateway) com a API em :8000.',
      );
    }
  }

  Future<Map<String, dynamic>> patch(String path, {Map<String, dynamic>? body}) async {
    try {
      final response = await http.patch(
        _uri(path),
        headers: _headers(),
        body: body == null ? null : jsonEncode(body),
      );
      return _decode(response);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(
        code: 'NETWORK_ERROR',
        message: 'Não foi possível conectar à API.',
      );
    }
  }

  Uri _uri(String path) {
    if (baseUrl.isEmpty) {
      return Uri.parse(path);
    }
    return Uri.parse('$baseUrl$path');
  }

  Map<String, String> _headers() => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (accessToken != null) 'Authorization': 'Bearer $accessToken',
      };

  Map<String, dynamic> _decode(http.Response response) {
    Map<String, dynamic> map = {};
    if (response.body.isNotEmpty) {
      try {
        map = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      } catch (_) {
        map = {'message': response.body};
      }
    }
    if (response.statusCode >= 400) {
      // FastAPI validation errors use "detail"
      final detail = map['detail'];
      String message = map['message'] as String? ?? 'Falha na requisição';
      if (detail is String) message = detail;
      if (detail is List && detail.isNotEmpty) {
        final first = detail.first;
        if (first is Map && first['msg'] != null) {
          message = first['msg'].toString();
        }
      }
      throw ApiException(
        code: map['code'] as String? ?? 'HTTP_${response.statusCode}',
        message: message,
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
