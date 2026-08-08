import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/serena_theme.dart';

class SessionPage extends ConsumerStatefulWidget {
  const SessionPage({
    super.key,
    this.sessionId,
    this.patientId,
    this.appointmentId,
  });

  final String? sessionId;
  final String? patientId;
  final String? appointmentId;

  @override
  ConsumerState<SessionPage> createState() => _SessionPageState();
}

class _SessionPageState extends ConsumerState<SessionPage> {
  final _focus = TextEditingController();
  final _observations = TextEditingController();
  final _events = TextEditingController();
  final _interventions = TextEditingController();
  final _hypotheses = TextEditingController();
  final _tasks = TextEditingController();
  final _agreements = TextEditingController();
  final _planning = TextEditingController();

  String? _sessionId;
  int _version = 1;
  String _saveState = 'idle'; // idle | saving | saved | error
  String? _patientName;
  String? _error;
  bool _bootstrapping = true;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _bootstrap();
    for (final c in [
      _focus,
      _observations,
      _events,
      _interventions,
      _hypotheses,
      _tasks,
      _agreements,
      _planning,
    ]) {
      c.addListener(_onChanged);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    for (final c in [
      _focus,
      _observations,
      _events,
      _interventions,
      _hypotheses,
      _tasks,
      _agreements,
      _planning,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final client = ref.read(apiClientProvider);
    try {
      if (widget.sessionId != null) {
        final data = await client.get('/api/v1/sessions/${widget.sessionId}');
        _apply(data);
      } else if (widget.patientId != null) {
        final data = await client.post('/api/v1/sessions/start', body: {
          'patient_id': widget.patientId,
          if (widget.appointmentId != null) 'appointment_id': widget.appointmentId,
        });
        _apply(data);
      } else {
        setState(() => _error = 'Paciente não informado.');
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _bootstrapping = false);
    }
  }

  void _apply(Map<String, dynamic> data) {
    _sessionId = data['id'] as String?;
    _version = data['version'] as int? ?? 1;
    _patientName = data['patient_display_name'] as String?;
    _focus.text = data['focus'] as String? ?? '';
    _observations.text = data['observations'] as String? ?? '';
    _events.text = data['events'] as String? ?? '';
    _interventions.text = data['interventions'] as String? ?? '';
    _hypotheses.text = data['hypotheses'] as String? ?? '';
    _tasks.text = data['tasks'] as String? ?? '';
    _agreements.text = data['agreements'] as String? ?? '';
    _planning.text = data['planning'] as String? ?? '';
    _saveState = 'saved';
  }

  void _onChanged() {
    if (_bootstrapping || _sessionId == null) return;
    setState(() => _saveState = 'idle');
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 900), _autosave);
  }

  Future<void> _autosave() async {
    if (_sessionId == null) return;
    setState(() => _saveState = 'saving');
    try {
      final data = await ref.read(apiClientProvider).patch(
        '/api/v1/sessions/$_sessionId/autosave',
        body: {
          'focus': _focus.text,
          'observations': _observations.text,
          'events': _events.text,
          'interventions': _interventions.text,
          'hypotheses': _hypotheses.text,
          'tasks': _tasks.text,
          'agreements': _agreements.text,
          'planning': _planning.text,
          'version': _version,
        },
      );
      if (!mounted) return;
      setState(() {
        _version = data['version'] as int? ?? _version + 1;
        _saveState = 'saved';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saveState = 'error';
        _error = e.toString();
      });
    }
  }

  Future<void> _close({required bool finalize}) async {
    if (_sessionId == null) return;
    await _autosave();
    final client = ref.read(apiClientProvider);
    try {
      if (finalize) {
        await client.post('/api/v1/sessions/$_sessionId/close', body: {'finalize_record': true});
      } else {
        await client.post('/api/v1/sessions/$_sessionId/defer-closure');
      }
      if (mounted) context.go('/hoje');
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_bootstrapping) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_sessionId == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Sessão')),
        body: Center(child: Text(_error ?? 'Não foi possível abrir a sessão.')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_patientName ?? 'Sessão'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(child: _SaveIndicator(state: _saveState)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 120),
        children: [
          Text(
            'Registro da sessão',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 6),
          Text(
            'Pouca digitação, salvamento automático. A transcrição nunca vira prontuário sozinha.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          if (_error != null && _saveState == 'error') ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: SerenaColors.danger)),
          ],
          const SizedBox(height: 20),
          _field('Foco', _focus),
          _field('Observações / evolução', _observations, maxLines: 5),
          _field('Acontecimentos', _events, maxLines: 3),
          _field('Intervenções', _interventions, maxLines: 3),
          _field('Hipóteses', _hypotheses, maxLines: 3),
          _field('Tarefas terapêuticas', _tasks, maxLines: 3),
          _field('Combinados', _agreements, maxLines: 2),
          _field('Planejamento / próximo foco', _planning, maxLines: 3),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _close(finalize: false),
                  child: const Text('Finalizar depois'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: () => _close(finalize: true),
                  child: const Text('Finalizar sessão'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(String label, TextEditingController controller, {int maxLines = 2}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        decoration: InputDecoration(labelText: label, alignLabelWithHint: true),
      ),
    );
  }
}

class _SaveIndicator extends StatelessWidget {
  const _SaveIndicator({required this.state});
  final String state;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (state) {
      'saving' => ('Salvando...', SerenaColors.inkSoft),
      'saved' => ('Salvo', SerenaColors.success),
      'error' => ('Falha ao salvar', SerenaColors.danger),
      _ => ('', SerenaColors.inkSoft),
    };
    if (label.isEmpty) return const SizedBox.shrink();
    return Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600));
  }
}
