# openapi.api.ProvidersApi

## Load the API package
```dart
import 'package:openapi/api.dart';
```

All URIs are relative to *http://localhost:9800*

Method | HTTP request | Description
------------- | ------------- | -------------
[**createProvider**](ProvidersApi.md#createprovider) | **POST** /api/providers | Create a provider
[**deleteProvider**](ProvidersApi.md#deleteprovider) | **DELETE** /api/providers/{providerId} | Delete a provider
[**fetchProviderModels**](ProvidersApi.md#fetchprovidermodels) | **GET** /api/providers/{providerId}/models | Fetch available models from provider
[**listProviders**](ProvidersApi.md#listproviders) | **GET** /api/providers | List providers
[**switchProvider**](ProvidersApi.md#switchprovider) | **PUT** /api/providers/current | Switch active provider
[**updateProvider**](ProvidersApi.md#updateprovider) | **PUT** /api/providers/{providerId} | Update a provider
[**verifyProvider**](ProvidersApi.md#verifyprovider) | **POST** /api/providers/{providerId}/verify | Verify provider connectivity


# **createProvider**
> ProviderResponse createProvider(createProviderRequest)

Create a provider

### Example
```dart
import 'package:openapi/api.dart';
// TODO Configure HTTP Bearer authorization: BearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProvidersApi();
final createProviderRequest = CreateProviderRequest(); // CreateProviderRequest | 

try {
    final result = api_instance.createProvider(createProviderRequest);
    print(result);
} catch (e) {
    print('Exception when calling ProvidersApi->createProvider: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createProviderRequest** | [**CreateProviderRequest**](CreateProviderRequest.md)|  | 

### Return type

[**ProviderResponse**](ProviderResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteProvider**
> OkResponse deleteProvider(providerId)

Delete a provider

### Example
```dart
import 'package:openapi/api.dart';
// TODO Configure HTTP Bearer authorization: BearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProvidersApi();
final providerId = providerId_example; // String | 

try {
    final result = api_instance.deleteProvider(providerId);
    print(result);
} catch (e) {
    print('Exception when calling ProvidersApi->deleteProvider: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **providerId** | **String**|  | 

### Return type

[**OkResponse**](OkResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fetchProviderModels**
> ProviderModelsResponse fetchProviderModels(providerId)

Fetch available models from provider

### Example
```dart
import 'package:openapi/api.dart';
// TODO Configure HTTP Bearer authorization: BearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProvidersApi();
final providerId = providerId_example; // String | 

try {
    final result = api_instance.fetchProviderModels(providerId);
    print(result);
} catch (e) {
    print('Exception when calling ProvidersApi->fetchProviderModels: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **providerId** | **String**|  | 

### Return type

[**ProviderModelsResponse**](ProviderModelsResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listProviders**
> ProviderListResponse listProviders()

List providers

### Example
```dart
import 'package:openapi/api.dart';
// TODO Configure HTTP Bearer authorization: BearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProvidersApi();

try {
    final result = api_instance.listProviders();
    print(result);
} catch (e) {
    print('Exception when calling ProvidersApi->listProviders: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**ProviderListResponse**](ProviderListResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **switchProvider**
> SwitchProviderResponse switchProvider(switchProviderRequest)

Switch active provider

### Example
```dart
import 'package:openapi/api.dart';
// TODO Configure HTTP Bearer authorization: BearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProvidersApi();
final switchProviderRequest = SwitchProviderRequest(); // SwitchProviderRequest | 

try {
    final result = api_instance.switchProvider(switchProviderRequest);
    print(result);
} catch (e) {
    print('Exception when calling ProvidersApi->switchProvider: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **switchProviderRequest** | [**SwitchProviderRequest**](SwitchProviderRequest.md)|  | 

### Return type

[**SwitchProviderResponse**](SwitchProviderResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateProvider**
> ProviderResponse updateProvider(providerId, updateProviderRequest)

Update a provider

### Example
```dart
import 'package:openapi/api.dart';
// TODO Configure HTTP Bearer authorization: BearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProvidersApi();
final providerId = providerId_example; // String | 
final updateProviderRequest = UpdateProviderRequest(); // UpdateProviderRequest | 

try {
    final result = api_instance.updateProvider(providerId, updateProviderRequest);
    print(result);
} catch (e) {
    print('Exception when calling ProvidersApi->updateProvider: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **providerId** | **String**|  | 
 **updateProviderRequest** | [**UpdateProviderRequest**](UpdateProviderRequest.md)|  | 

### Return type

[**ProviderResponse**](ProviderResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **verifyProvider**
> VerifyProviderResponse verifyProvider(providerId)

Verify provider connectivity

### Example
```dart
import 'package:openapi/api.dart';
// TODO Configure HTTP Bearer authorization: BearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProvidersApi();
final providerId = providerId_example; // String | 

try {
    final result = api_instance.verifyProvider(providerId);
    print(result);
} catch (e) {
    print('Exception when calling ProvidersApi->verifyProvider: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **providerId** | **String**|  | 

### Return type

[**VerifyProviderResponse**](VerifyProviderResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

