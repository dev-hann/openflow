import 'package:flutter/material.dart';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/utils/normalize_url.dart';

class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final _scannerController = MobileScannerController();
  bool _processing = false;

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  Future<void> _handleScan(BarcodeCapture capture) async {
    if (_processing) return;
    final barcode = capture.barcodes.firstOrNull;
    if (barcode == null || barcode.rawValue == null) return;

    final url = barcode.rawValue!;
    final uri = Uri.tryParse(url);
    if (uri == null || uri.queryParameters['session'] == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('유효하지 않은 QR 코드입니다')),
        );
      }
      return;
    }

    final sessionId = uri.queryParameters['session']!;
    final authCubit = context.read<AuthCubit>();
    final serverUrl = authCubit.state.storedAuth?.serverUrl;
    if (serverUrl == null || !mounted) return;

    final serverUri = Uri.tryParse(normalizeUrl(serverUrl));
    if (serverUri != null && uri.host.isNotEmpty && uri.host != serverUri.host) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('다른 서버의 QR 코드입니다')),
        );
      }
      return;
    }

    final token = await authCubit.getValidToken();
    if (!mounted) return;
    if (token == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('인증이 만료되었습니다. 다시 로그인해주세요.')),
      );
      return;
    }

    setState(() => _processing = true);

    try {
      final api = createApiClient(serverUrl, token: token);
      await api.approveWebAuth(sessionId);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('웹 로그인이 승인되었습니다')),
        );
        Navigator.of(context).pop();
      }
    } on ApiException catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('서버 오류로 승인에 실패했습니다')),
        );
      }
    } on Object catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('승인에 실패했습니다. 네트워크를 확인해주세요.')),
        );
      }
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('웹 로그인 QR 스캔')),
      body: Stack(
        children: [
          MobileScanner(
            controller: _scannerController,
            onDetect: _handleScan,
            errorBuilder: (context, error, child) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.videocam_off, size: 48, color: Colors.white54),
                      const SizedBox(height: 16),
                      Text(
                        error.errorDetails?.message ?? '카메라를 사용할 수 없습니다',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white70),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: _scannerController.start,
                        child: const Text('다시 시도'),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          if (_processing)
            const ColoredBox(
              color: Colors.black54,
              child: Center(child: CircularProgressIndicator()),
            ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: Colors.black54,
              child: Text(
                _processing ? '처리 중...' : '웹 화면의 QR 코드를 스캔하세요',
                style: const TextStyle(color: Colors.white, fontSize: 14),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
