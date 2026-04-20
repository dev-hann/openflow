import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:openflow/app.dart';
import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/cubits/chat_cubit.dart';
import 'package:openflow/cubits/providers_cubit.dart';
import 'package:openflow/cubits/sessions_cubit.dart';
import 'package:openflow/cubits/settings_cubit.dart';
import 'package:openflow/services/auth_storage.dart';
import 'package:openflow/services/websocket_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  final authStorage = AuthStorage();
  final wsService = WebSocketService();

  runApp(OpenFlowApp(
    authStorage: authStorage,
    wsService: wsService,
  ),);
}

class OpenFlowApp extends StatelessWidget {

  const OpenFlowApp({
    required this.authStorage, required this.wsService, super.key,
  });
  final AuthStorage authStorage;
  final WebSocketService wsService;

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<AuthStorage>.value(value: authStorage),
        RepositoryProvider<WebSocketService>.value(value: wsService),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider(
            create: (_) => AuthCubit(authStorage)
              ..loadAuth()
              .ignore(),
          ),
          BlocProvider(create: (_) => ChatCubit()),
          BlocProvider(create: (_) => SessionsCubit()),
          BlocProvider(create: (_) => ProvidersCubit()),
          BlocProvider(create: (_) => SettingsCubit()),
        ],
        child: const OpenFlowMaterialApp(),
      ),
    );
  }
}
