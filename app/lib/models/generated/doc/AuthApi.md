# openapi.api.AuthApi

## Load the API package
```dart
import 'package:openapi/api.dart';
```

All URIs are relative to *http://localhost:9800*

Method | HTTP request | Description
------------- | ------------- | -------------
[**pairInit**](AuthApi.md#pairinit) | **POST** /api/auth/pair/init | Create pairing PIN
[**pairVerify**](AuthApi.md#pairverify) | **POST** /api/auth/pair/verify | Verify PIN and issue tokens
[**refreshToken**](AuthApi.md#refreshtoken) | **POST** /api/auth/refresh | Refresh access token
[**unpair**](AuthApi.md#unpair) | **DELETE** /api/auth/unpair | Unpair device


# **pairInit**
> PairInitResponse pairInit()

Create pairing PIN

### Example
```dart
import 'package:openapi/api.dart';

final api_instance = AuthApi();

try {
    final result = api_instance.pairInit();
    print(result);
} catch (e) {
    print('Exception when calling AuthApi->pairInit: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**PairInitResponse**](PairInitResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pairVerify**
> TokenPairResponse pairVerify(pairVerifyRequest)

Verify PIN and issue tokens

### Example
```dart
import 'package:openapi/api.dart';

final api_instance = AuthApi();
final pairVerifyRequest = PairVerifyRequest(); // PairVerifyRequest | 

try {
    final result = api_instance.pairVerify(pairVerifyRequest);
    print(result);
} catch (e) {
    print('Exception when calling AuthApi->pairVerify: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **pairVerifyRequest** | [**PairVerifyRequest**](PairVerifyRequest.md)|  | 

### Return type

[**TokenPairResponse**](TokenPairResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **refreshToken**
> TokenPairResponse refreshToken(refreshRequest)

Refresh access token

### Example
```dart
import 'package:openapi/api.dart';

final api_instance = AuthApi();
final refreshRequest = RefreshRequest(); // RefreshRequest | 

try {
    final result = api_instance.refreshToken(refreshRequest);
    print(result);
} catch (e) {
    print('Exception when calling AuthApi->refreshToken: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **refreshRequest** | [**RefreshRequest**](RefreshRequest.md)|  | 

### Return type

[**TokenPairResponse**](TokenPairResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **unpair**
> OkResponse unpair()

Unpair device

### Example
```dart
import 'package:openapi/api.dart';
// TODO Configure HTTP Bearer authorization: BearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('BearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AuthApi();

try {
    final result = api_instance.unpair();
    print(result);
} catch (e) {
    print('Exception when calling AuthApi->unpair: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**OkResponse**](OkResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

