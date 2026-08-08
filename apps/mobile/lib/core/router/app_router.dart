import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/login_page.dart';
import '../../features/patients/patient_hub_page.dart';
import '../../features/patients/patients_page.dart';
import '../../features/shell/app_shell.dart';
import '../../features/today/today_page.dart';
import '../auth/auth_state.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/hoje',
    refreshListenable: _AuthListenable(ref),
    redirect: (context, state) {
      final loggedIn = auth.isAuthenticated;
      final loggingIn = state.matchedLocation == '/entrar';
      if (!loggedIn && !loggingIn) return '/entrar';
      if (loggedIn && loggingIn) return '/hoje';
      return null;
    },
    routes: [
      GoRoute(
        path: '/entrar',
        builder: (context, state) => const LoginPage(),
      ),
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(
            path: '/hoje',
            pageBuilder: (context, state) => const NoTransitionPage(child: TodayPage()),
          ),
          GoRoute(
            path: '/pacientes',
            pageBuilder: (context, state) => const NoTransitionPage(child: PatientsPage()),
            routes: [
              GoRoute(
                path: ':id',
                builder: (context, state) => PatientHubPage(
                  patientId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

class _AuthListenable extends ChangeNotifier {
  _AuthListenable(this.ref) {
    ref.listen(authControllerProvider, (_, __) => notifyListeners());
  }

  final Ref ref;
}
