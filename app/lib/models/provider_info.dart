import 'package:equatable/equatable.dart';

class ProviderInfo extends Equatable {
  const ProviderInfo({
    required this.id,
    required this.name,
    required this.baseUrl,
    required this.model,
    required this.createdAt,
    this.isActive = false,
  });

  factory ProviderInfo.fromJson(Map<String, dynamic> json) => ProviderInfo(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        baseUrl: json['baseUrl'] as String? ?? '',
        model: json['model'] as String? ?? '',
        isActive: json['isActive'] as bool? ?? false,
        createdAt: json['createdAt'] != null
            ? DateTime.fromMillisecondsSinceEpoch(
                (json['createdAt'] as num).toInt(),
              )
            : DateTime.now(),
      );
  final String id;
  final String name;
  final String baseUrl;
  final String model;
  final bool isActive;
  final DateTime createdAt;

  ProviderInfo copyWith({
    String? name,
    String? baseUrl,
    String? model,
    bool? isActive,
  }) {
    return ProviderInfo(
      id: id,
      name: name ?? this.name,
      baseUrl: baseUrl ?? this.baseUrl,
      model: model ?? this.model,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt,
    );
  }

  @override
  List<Object?> get props => [id, name, baseUrl, model, isActive, createdAt];
}
