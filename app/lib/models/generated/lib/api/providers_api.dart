//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ProvidersApi {
  ProvidersApi([ApiClient? apiClient])
      : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Create a provider
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [CreateProviderRequest] createProviderRequest (required):
  Future<Response> createProviderWithHttpInfo(
    CreateProviderRequest createProviderRequest,
  ) async {
    // ignore: prefer_const_declarations
    final path = r'/api/providers';

    // ignore: prefer_final_locals
    Object? postBody = createProviderRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];

    return apiClient.invokeAPI(
      path,
      'POST',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Create a provider
  ///
  /// Parameters:
  ///
  /// * [CreateProviderRequest] createProviderRequest (required):
  Future<ProviderResponse?> createProvider(
    CreateProviderRequest createProviderRequest,
  ) async {
    final response = await createProviderWithHttpInfo(
      createProviderRequest,
    );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty &&
        response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(
        await _decodeBodyBytes(response),
        'ProviderResponse',
      ) as ProviderResponse;
    }
    return null;
  }

  /// Delete a provider
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] providerId (required):
  Future<Response> deleteProviderWithHttpInfo(
    String providerId,
  ) async {
    // ignore: prefer_const_declarations
    final path =
        r'/api/providers/{providerId}'.replaceAll('{providerId}', providerId);

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];

    return apiClient.invokeAPI(
      path,
      'DELETE',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Delete a provider
  ///
  /// Parameters:
  ///
  /// * [String] providerId (required):
  Future<OkResponse?> deleteProvider(
    String providerId,
  ) async {
    final response = await deleteProviderWithHttpInfo(
      providerId,
    );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty &&
        response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(
        await _decodeBodyBytes(response),
        'OkResponse',
      ) as OkResponse;
    }
    return null;
  }

  /// Fetch available models from provider
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] providerId (required):
  Future<Response> fetchProviderModelsWithHttpInfo(
    String providerId,
  ) async {
    // ignore: prefer_const_declarations
    final path = r'/api/providers/{providerId}/models'
        .replaceAll('{providerId}', providerId);

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];

    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Fetch available models from provider
  ///
  /// Parameters:
  ///
  /// * [String] providerId (required):
  Future<ProviderModelsResponse?> fetchProviderModels(
    String providerId,
  ) async {
    final response = await fetchProviderModelsWithHttpInfo(
      providerId,
    );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty &&
        response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(
        await _decodeBodyBytes(response),
        'ProviderModelsResponse',
      ) as ProviderModelsResponse;
    }
    return null;
  }

  /// List providers
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> listProvidersWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/api/providers';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];

    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// List providers
  Future<ProviderListResponse?> listProviders() async {
    final response = await listProvidersWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty &&
        response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(
        await _decodeBodyBytes(response),
        'ProviderListResponse',
      ) as ProviderListResponse;
    }
    return null;
  }

  /// Switch active provider
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [SwitchProviderRequest] switchProviderRequest (required):
  Future<Response> switchProviderWithHttpInfo(
    SwitchProviderRequest switchProviderRequest,
  ) async {
    // ignore: prefer_const_declarations
    final path = r'/api/providers/current';

    // ignore: prefer_final_locals
    Object? postBody = switchProviderRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];

    return apiClient.invokeAPI(
      path,
      'PUT',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Switch active provider
  ///
  /// Parameters:
  ///
  /// * [SwitchProviderRequest] switchProviderRequest (required):
  Future<SwitchProviderResponse?> switchProvider(
    SwitchProviderRequest switchProviderRequest,
  ) async {
    final response = await switchProviderWithHttpInfo(
      switchProviderRequest,
    );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty &&
        response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(
        await _decodeBodyBytes(response),
        'SwitchProviderResponse',
      ) as SwitchProviderResponse;
    }
    return null;
  }

  /// Update a provider
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] providerId (required):
  ///
  /// * [UpdateProviderRequest] updateProviderRequest (required):
  Future<Response> updateProviderWithHttpInfo(
    String providerId,
    UpdateProviderRequest updateProviderRequest,
  ) async {
    // ignore: prefer_const_declarations
    final path =
        r'/api/providers/{providerId}'.replaceAll('{providerId}', providerId);

    // ignore: prefer_final_locals
    Object? postBody = updateProviderRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];

    return apiClient.invokeAPI(
      path,
      'PUT',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Update a provider
  ///
  /// Parameters:
  ///
  /// * [String] providerId (required):
  ///
  /// * [UpdateProviderRequest] updateProviderRequest (required):
  Future<ProviderResponse?> updateProvider(
    String providerId,
    UpdateProviderRequest updateProviderRequest,
  ) async {
    final response = await updateProviderWithHttpInfo(
      providerId,
      updateProviderRequest,
    );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty &&
        response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(
        await _decodeBodyBytes(response),
        'ProviderResponse',
      ) as ProviderResponse;
    }
    return null;
  }

  /// Verify provider connectivity
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] providerId (required):
  Future<Response> verifyProviderWithHttpInfo(
    String providerId,
  ) async {
    // ignore: prefer_const_declarations
    final path = r'/api/providers/{providerId}/verify'
        .replaceAll('{providerId}', providerId);

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];

    return apiClient.invokeAPI(
      path,
      'POST',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Verify provider connectivity
  ///
  /// Parameters:
  ///
  /// * [String] providerId (required):
  Future<VerifyProviderResponse?> verifyProvider(
    String providerId,
  ) async {
    final response = await verifyProviderWithHttpInfo(
      providerId,
    );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty &&
        response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(
        await _decodeBodyBytes(response),
        'VerifyProviderResponse',
      ) as VerifyProviderResponse;
    }
    return null;
  }
}
