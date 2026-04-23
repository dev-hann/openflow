import 'package:equatable/equatable.dart';

class VerifyResult extends Equatable {
  const VerifyResult({required this.ok, this.models = const [], this.error});
  final bool ok;
  final List<String> models;
  final String? error;

  @override
  List<Object?> get props => [ok, models, error];
}
