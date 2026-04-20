import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'cubits/auth_cubit.dart';
import 'cubits/chat_cubit.dart';
import 'cubits/sessions_cubit.dart';
import 'cubits/providers_cubit.dart';
import 'cubits/settings_cubit.dart';
import 'services/auth_storage.dart';
import 'services/websocket_service.dart';
import 'app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  final authStorage = AuthStorage();
  final wsService = WebSocketService();

  runApp(OpenFlowApp(
    authStorage: authStorage,
    wsService: wsService,
  ));
}

class OpenFlowApp extends StatelessWidget {
  final AuthStorage authStorage;
  final WebSocketService wsService;

  const OpenFlowApp({
    super.key,
    required this.authStorage,
    required this.wsService,
  });

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
            create: (_) => AuthCubit(authStorage)..loadAuth(),
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
