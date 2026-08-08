import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/serena_theme.dart';
import '../../shared/widgets/serena_section.dart';

final patientProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) async {
  final client = ref.watch(apiClientProvider);
  return client.get('/api/v1/patients/$id');
});

class PatientHubPage extends ConsumerWidget {
  const PatientHubPage({super.key, required this.patientId});

  final String patientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final patient = ref.watch(patientProvider(patientId));

    return patient.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('Paciente')),
        body: Center(child: Text(e.toString())),
      ),
      data: (data) {
        final name = data['display_name'] as String? ?? 'Paciente';
        return Scaffold(
          appBar: AppBar(title: Text(name)),
          body: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(
                name,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 6),
              Text(
                'Hub do paciente — jornada clínica e administrativa em um só lugar.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 24),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.play_arrow_outlined),
                    label: const Text('Nova sessão'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.folder_open_outlined),
                    label: const Text('Ver prontuário'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.psychology_outlined),
                    label: const Text('Abrir Supervisor IA'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.description_outlined),
                    label: const Text('Gerar documento'),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              SerenaSection(
                title: 'Cadastro',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _kv(context, 'Modalidade', data['modality']?.toString()),
                    _kv(context, 'Status', data['status']?.toString()),
                    _kv(context, 'Abordagem', data['framework']?.toString()),
                    _kv(context, 'Telefone', data['phone']?.toString()),
                    _kv(context, 'E-mail', data['email']?.toString()),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SerenaSection(
                title: 'Atalhos do hub',
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: const [
                    _HubChip('Sessões'),
                    _HubChip('Prontuário'),
                    _HubChip('Evolução'),
                    _HubChip('Formulação'),
                    _HubChip('Plano terapêutico'),
                    _HubChip('Tarefas'),
                    _HubChip('Documentos'),
                    _HubChip('Consentimentos'),
                    _HubChip('Financeiro'),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _kv(BuildContext context, String k, String? v) {
    if (v == null || v.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(k, style: Theme.of(context).textTheme.bodyMedium),
          ),
          Expanded(child: Text(v, style: Theme.of(context).textTheme.titleSmall)),
        ],
      ),
    );
  }
}

class _HubChip extends StatelessWidget {
  const _HubChip(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: SerenaColors.offWhite,
        borderRadius: BorderRadius.circular(SerenaRadius.sm),
        border: Border.all(color: SerenaColors.border),
      ),
      child: Text(label),
    );
  }
}
