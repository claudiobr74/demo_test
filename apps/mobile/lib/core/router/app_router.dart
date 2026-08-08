import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/ai/ai_usage_page.dart';
import '../../features/appointments/agenda_page.dart';
import '../../features/auth/login_page.dart';
import '../../features/documents/documents_page.dart';
import '../../features/finance/finance_page.dart';
import '../../features/patients/clinical_records_page.dart';
import '../../features/patients/formulation_page.dart';
import '../../features/patients/patient_hub_page.dart';
import '../../features/patients/patients_page.dart';
import '../../features/patients/treatment_plan_page.dart';
import '../../features/sessions/prepare_session_page.dart';
import '../../features/sessions/session_page.dart';
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
            path: '/agenda',
            pageBuilder: (context, state) => const NoTransitionPage(child: AgendaPage()),
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
                routes: [
                  GoRoute(
                    path: 'prontuario',
                    builder: (context, state) => ClinicalRecordsPage(
                      patientId: state.pathParameters['id']!,
                    ),
                  ),
                  GoRoute(
                    path: 'preparar',
                    builder: (context, state) => PrepareSessionPage(
                      patientId: state.pathParameters['id']!,
                    ),
                  ),
                  GoRoute(
                    path: 'formulacao',
                    builder: (context, state) => FormulationPage(
                      patientId: state.pathParameters['id']!,
                    ),
                  ),
                  GoRoute(
                    path: 'plano',
                    builder: (context, state) => TreatmentPlanPage(
                      patientId: state.pathParameters['id']!,
                    ),
                  ),
                ],
              ),
            ],
          ),
          GoRoute(
            path: '/financeiro',
            pageBuilder: (context, state) => const NoTransitionPage(child: FinancePage()),
          ),
          GoRoute(
            path: '/documentos',
            pageBuilder: (context, state) => const NoTransitionPage(child: DocumentsPage()),
          ),
          GoRoute(
            path: '/ia',
            pageBuilder: (context, state) => const NoTransitionPage(child: AiUsagePage()),
          ),
          GoRoute(
            path: '/sessoes/nova',
            builder: (context, state) => SessionPage(
              patientId: state.uri.queryParameters['patientId'],
              appointmentId: state.uri.queryParameters['appointmentId'],
            ),
          ),
          GoRoute(
            path: '/sessoes/:id',
            builder: (context, state) => SessionPage(
              sessionId: state.pathParameters['id'],
            ),
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
