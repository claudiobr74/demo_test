import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/serena_theme.dart';

enum AgendaViewMode { day, week, month }

class AgendaModeNotifier extends Notifier<AgendaViewMode> {
  @override
  AgendaViewMode build() => AgendaViewMode.day;
  void setMode(AgendaViewMode mode) => state = mode;
}

class AgendaAnchorNotifier extends Notifier<DateTime> {
  @override
  DateTime build() => DateTime.now();
  void setDate(DateTime value) => state = value;
  void shift(int days) => state = state.add(Duration(days: days));
  void shiftMonths(int months) {
    state = DateTime(state.year, state.month + months, 1);
  }
}

final agendaModeProvider = NotifierProvider<AgendaModeNotifier, AgendaViewMode>(
  AgendaModeNotifier.new,
);
final agendaAnchorProvider = NotifierProvider<AgendaAnchorNotifier, DateTime>(
  AgendaAnchorNotifier.new,
);
final agendaProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final mode = ref.watch(agendaModeProvider);
  final anchor = ref.watch(agendaAnchorProvider);
  final client = ref.watch(apiClientProvider);

  late DateTime start;
  late DateTime end;
  if (mode == AgendaViewMode.day) {
    start = DateTime(anchor.year, anchor.month, anchor.day);
    end = start.add(const Duration(days: 1));
  } else if (mode == AgendaViewMode.week) {
    final weekday = anchor.weekday; // 1=Mon
    start = DateTime(anchor.year, anchor.month, anchor.day).subtract(Duration(days: weekday - 1));
    end = start.add(const Duration(days: 7));
  } else {
    start = DateTime(anchor.year, anchor.month, 1);
    end = DateTime(anchor.year, anchor.month + 1, 1);
  }

  final data = await client.get(
    '/api/v1/appointments?start=${start.toUtc().toIso8601String()}&end=${end.toUtc().toIso8601String()}',
  );
  return (data['items'] as List? ?? [])
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList();
});

class AgendaPage extends ConsumerWidget {
  const AgendaPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(agendaModeProvider);
    final anchor = ref.watch(agendaAnchorProvider);
    final agenda = ref.watch(agendaProvider);
    final dateLabel = switch (mode) {
      AgendaViewMode.day => DateFormat('EEE dd/MM/yyyy').format(anchor),
      AgendaViewMode.week =>
        'Semana de ${DateFormat('dd/MM').format(anchor.subtract(Duration(days: anchor.weekday - 1)))}',
      AgendaViewMode.month => DateFormat('MM/yyyy').format(anchor),
    };

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          title: const Text('Agenda'),
          actions: [
            IconButton(
              tooltip: 'Novo atendimento',
              onPressed: () => _openCreate(context, ref),
              icon: const Icon(Icons.add),
            ),
          ],
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 48),
          sliver: SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SegmentedButton<AgendaViewMode>(
                  segments: const [
                    ButtonSegment(value: AgendaViewMode.day, label: Text('Dia'), icon: Icon(Icons.today)),
                    ButtonSegment(value: AgendaViewMode.week, label: Text('Semana'), icon: Icon(Icons.view_week)),
                    ButtonSegment(value: AgendaViewMode.month, label: Text('Mês'), icon: Icon(Icons.calendar_month)),
                  ],
                  selected: {mode},
                  onSelectionChanged: (v) => ref.read(agendaModeProvider.notifier).setMode(v.first),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    IconButton(
                      onPressed: () {
                        if (mode == AgendaViewMode.month) {
                          ref.read(agendaAnchorProvider.notifier).shiftMonths(-1);
                        } else {
                          final delta = mode == AgendaViewMode.day ? -1 : -7;
                          ref.read(agendaAnchorProvider.notifier).shift(delta);
                        }
                      },
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Expanded(
                      child: Text(
                        dateLabel,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    IconButton(
                      onPressed: () {
                        if (mode == AgendaViewMode.month) {
                          ref.read(agendaAnchorProvider.notifier).shiftMonths(1);
                        } else {
                          final delta = mode == AgendaViewMode.day ? 1 : 7;
                          ref.read(agendaAnchorProvider.notifier).shift(delta);
                        }
                      },
                      icon: const Icon(Icons.chevron_right),
                    ),
                    TextButton(
                      onPressed: () => ref.read(agendaAnchorProvider.notifier).setDate(DateTime.now()),
                      child: const Text('Hoje'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                agenda.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (e, _) => Text(e.toString(), style: const TextStyle(color: SerenaColors.danger)),
                  data: (items) {
                    if (mode == AgendaViewMode.day) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (items.isEmpty) ...[
                            Text(
                              'Nenhum atendimento neste dia — use + ou arraste quando houver.',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                            const SizedBox(height: 12),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: FilledButton(
                                onPressed: () => _openCreate(context, ref),
                                child: const Text('Criar atendimento'),
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],
                          _DayTimeline(
                            day: DateTime(anchor.year, anchor.month, anchor.day),
                            items: items,
                            onChanged: () => ref.invalidate(agendaProvider),
                          ),
                        ],
                      );
                    }
                    if (mode == AgendaViewMode.week) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (items.isEmpty) ...[
                            Text(
                              'Nenhum atendimento nesta semana.',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                            const SizedBox(height: 12),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: FilledButton(
                                onPressed: () => _openCreate(context, ref),
                                child: const Text('Criar atendimento'),
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],
                          _WeekTimeline(
                            weekStart: DateTime(anchor.year, anchor.month, anchor.day)
                                .subtract(Duration(days: anchor.weekday - 1)),
                            items: items,
                            onChanged: () => ref.invalidate(agendaProvider),
                          ),
                        ],
                      );
                    }
                    if (items.isEmpty) {
                      return Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: SerenaColors.surface,
                          borderRadius: BorderRadius.circular(SerenaRadius.lg),
                          border: Border.all(color: SerenaColors.border),
                        ),
                        child: Column(
                          children: [
                            Text('Nenhum atendimento neste período.', style: Theme.of(context).textTheme.bodyLarge),
                            const SizedBox(height: 12),
                            FilledButton(
                              onPressed: () => _openCreate(context, ref),
                              child: const Text('Criar atendimento'),
                            ),
                          ],
                        ),
                      );
                    }
                    if (mode == AgendaViewMode.month) {
                      return _MonthAgendaList(
                        items: items,
                        onChanged: () => ref.invalidate(agendaProvider),
                      );
                    }
                    return Column(
                      children: [
                        for (final item in items)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _AppointmentCard(
                              item: item,
                              onChanged: () => ref.invalidate(agendaProvider),
                              conflicting: _hasConflict(item, items),
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _openCreate(BuildContext context, WidgetRef ref) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => const _CreateAppointmentSheet(),
    );
    if (created == true) {
      ref.invalidate(agendaProvider);
    }
  }
}

bool _hasConflict(Map<String, dynamic> item, List<Map<String, dynamic>> all) {
  final aStart = DateTime.tryParse(item['starts_at'] as String? ?? '');
  final aEnd = DateTime.tryParse(item['ends_at'] as String? ?? '');
  if (aStart == null || aEnd == null) return false;
  final status = item['status'] as String? ?? '';
  if ({'cancelled', 'rescheduled', 'no_show'}.contains(status)) return false;
  for (final other in all) {
    if (other['id'] == item['id']) continue;
    final oStatus = other['status'] as String? ?? '';
    if ({'cancelled', 'rescheduled', 'no_show'}.contains(oStatus)) continue;
    final bStart = DateTime.tryParse(other['starts_at'] as String? ?? '');
    final bEnd = DateTime.tryParse(other['ends_at'] as String? ?? '');
    if (bStart == null || bEnd == null) continue;
    if (aStart.isBefore(bEnd) && bStart.isBefore(aEnd)) return true;
  }
  return false;
}

DateTime _snapToQuarter(DateTime value) {
  final q = ((value.minute + 7) ~/ 15) * 15;
  if (q == 60) {
    return DateTime(value.year, value.month, value.day, value.hour + 1);
  }
  return DateTime(value.year, value.month, value.day, value.hour, q);
}

/// Day grid with hour slots — long-press and drop to reschedule.
class _DayTimeline extends ConsumerWidget {
  const _DayTimeline({
    required this.day,
    required this.items,
    required this.onChanged,
  });

  final DateTime day;
  final List<Map<String, dynamic>> items;
  final VoidCallback onChanged;

  static const int _startHour = 7;
  static const int _endHour = 21;
  static const double _slotHeight = 64;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final byHour = <int, List<Map<String, dynamic>>>{};
    for (final item in items) {
      final starts = DateTime.tryParse(item['starts_at'] as String? ?? '')?.toLocal();
      if (starts == null) continue;
      final hour = starts.hour.clamp(_startHour, _endHour - 1);
      byHour.putIfAbsent(hour, () => []).add(item);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Segure e solte em outro horário (ajuste em blocos de 15 min). Conflitos ficam destacados.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: SerenaColors.inkSoft),
        ),
        const SizedBox(height: 12),
        for (var hour = _startHour; hour < _endHour; hour++)
          _HourSlot(
            hour: hour,
            height: _slotHeight,
            appointments: byHour[hour] ?? const [],
            allItems: items,
            onDrop: (item) => _rescheduleToHour(context, ref, item, hour),
            onChanged: onChanged,
          ),
      ],
    );
  }

  Future<void> _rescheduleToHour(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> item,
    int hour,
  ) async {
    final starts = DateTime.tryParse(item['starts_at'] as String? ?? '')?.toLocal();
    if (starts == null) return;
    final next = _snapToQuarter(DateTime(day.year, day.month, day.day, hour, starts.minute));
    if (next.isAtSameMomentAs(starts)) return;
    try {
      await ref.read(apiClientProvider).post(
            '/api/v1/appointments/${item['id']}/reschedule',
            body: {
              'starts_at': next.toUtc().toIso8601String(),
              'version': item['version'],
            },
          );
      onChanged();
    } catch (e) {
      onChanged();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }
}

/// Week grid — columns Mon–Sun with hour drop targets.
class _WeekTimeline extends ConsumerWidget {
  const _WeekTimeline({
    required this.weekStart,
    required this.items,
    required this.onChanged,
  });

  final DateTime weekStart;
  final List<Map<String, dynamic>> items;
  final VoidCallback onChanged;

  static const int _startHour = 8;
  static const int _endHour = 20;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final days = List.generate(7, (i) => weekStart.add(Duration(days: i)));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Visão semanal — segure um atendimento e solte em outro dia/horário.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: SerenaColors.inkSoft),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final day in days)
                SizedBox(
                  width: 168,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          DateFormat('EEE dd/MM').format(day),
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                color: SerenaColors.sageDark,
                              ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      for (var hour = _startHour; hour < _endHour; hour++)
                        _WeekCell(
                          day: day,
                          hour: hour,
                          items: items.where((item) {
                            final s = DateTime.tryParse(item['starts_at'] as String? ?? '')?.toLocal();
                            return s != null &&
                                s.year == day.year &&
                                s.month == day.month &&
                                s.day == day.day &&
                                s.hour == hour;
                          }).toList(),
                          allItems: items,
                          onDrop: (item) => _reschedule(context, ref, item, day, hour),
                          onChanged: onChanged,
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _reschedule(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> item,
    DateTime day,
    int hour,
  ) async {
    final starts = DateTime.tryParse(item['starts_at'] as String? ?? '')?.toLocal();
    if (starts == null) return;
    final next = _snapToQuarter(DateTime(day.year, day.month, day.day, hour, starts.minute));
    if (next.isAtSameMomentAs(starts)) return;
    try {
      await ref.read(apiClientProvider).post(
            '/api/v1/appointments/${item['id']}/reschedule',
            body: {
              'starts_at': next.toUtc().toIso8601String(),
              'version': item['version'],
            },
          );
      onChanged();
    } catch (e) {
      onChanged();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }
}

class _WeekCell extends StatelessWidget {
  const _WeekCell({
    required this.day,
    required this.hour,
    required this.items,
    required this.allItems,
    required this.onDrop,
    required this.onChanged,
  });

  final DateTime day;
  final int hour;
  final List<Map<String, dynamic>> items;
  final List<Map<String, dynamic>> allItems;
  final Future<void> Function(Map<String, dynamic> item) onDrop;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return DragTarget<Map<String, dynamic>>(
      onWillAcceptWithDetails: (_) => true,
      onAcceptWithDetails: (d) => onDrop(d.data),
      builder: (context, candidate, _) {
        final hot = candidate.isNotEmpty;
        return Container(
          constraints: const BoxConstraints(minHeight: 52),
          margin: const EdgeInsets.only(right: 6, bottom: 2),
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: hot ? SerenaColors.sage.withValues(alpha: 0.15) : SerenaColors.offWhite,
            border: Border.all(color: SerenaColors.border.withValues(alpha: 0.7)),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '${hour.toString().padLeft(2, '0')}:00',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(color: SerenaColors.inkSoft),
              ),
              for (final item in items)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: LongPressDraggable<Map<String, dynamic>>(
                    data: item,
                    feedback: Material(
                      elevation: 3,
                      child: SizedBox(
                        width: 140,
                        child: _AppointmentCard(
                          item: item,
                          onChanged: onChanged,
                          compact: true,
                          conflicting: _hasConflict(item, allItems),
                        ),
                      ),
                    ),
                    childWhenDragging: Opacity(
                      opacity: 0.3,
                      child: _AppointmentCard(
                        item: item,
                        onChanged: onChanged,
                        compact: true,
                        conflicting: _hasConflict(item, allItems),
                      ),
                    ),
                    child: _AppointmentCard(
                      item: item,
                      onChanged: onChanged,
                      compact: true,
                      conflicting: _hasConflict(item, allItems),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _HourSlot extends StatelessWidget {
  const _HourSlot({
    required this.hour,
    required this.height,
    required this.appointments,
    required this.allItems,
    required this.onDrop,
    required this.onChanged,
  });

  final int hour;
  final double height;
  final List<Map<String, dynamic>> appointments;
  final List<Map<String, dynamic>> allItems;
  final Future<void> Function(Map<String, dynamic> item) onDrop;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final label = '${hour.toString().padLeft(2, '0')}:00';
    return DragTarget<Map<String, dynamic>>(
      onWillAcceptWithDetails: (_) => true,
      onAcceptWithDetails: (details) => onDrop(details.data),
      builder: (context, candidate, rejected) {
        final highlighting = candidate.isNotEmpty;
        return Container(
          constraints: BoxConstraints(minHeight: height),
          decoration: BoxDecoration(
            color: highlighting
                ? SerenaColors.sage.withValues(alpha: 0.12)
                : Colors.transparent,
            border: Border(
              top: BorderSide(color: SerenaColors.border.withValues(alpha: 0.7)),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 56,
                child: Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    label,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: SerenaColors.inkSoft,
                        ),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: appointments.isEmpty
                      ? SizedBox(height: height - 8)
                      : Column(
                          children: [
                            for (final item in appointments)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 6),
                                child: LongPressDraggable<Map<String, dynamic>>(
                                  data: item,
                                  feedback: Material(
                                    elevation: 4,
                                    borderRadius: BorderRadius.circular(SerenaRadius.md),
                                    child: SizedBox(
                                      width: 280,
                                      child: Opacity(
                                        opacity: 0.9,
                                        child: _AppointmentCard(
                                          item: item,
                                          onChanged: onChanged,
                                          compact: true,
                                          conflicting: _hasConflict(item, allItems),
                                        ),
                                      ),
                                    ),
                                  ),
                                  childWhenDragging: Opacity(
                                    opacity: 0.35,
                                    child: _AppointmentCard(
                                      item: item,
                                      onChanged: onChanged,
                                      compact: true,
                                      conflicting: _hasConflict(item, allItems),
                                    ),
                                  ),
                                  child: _AppointmentCard(
                                    item: item,
                                    onChanged: onChanged,
                                    compact: true,
                                    conflicting: _hasConflict(item, allItems),
                                  ),
                                ),
                              ),
                          ],
                        ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _MonthAgendaList extends ConsumerWidget {
  const _MonthAgendaList({required this.items, required this.onChanged});
  final List<Map<String, dynamic>> items;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final byDay = <String, List<Map<String, dynamic>>>{};
    for (final item in items) {
      final starts = DateTime.tryParse(item['starts_at'] as String? ?? '')?.toLocal();
      final key = starts == null ? '—' : DateFormat('yyyy-MM-dd').format(starts);
      byDay.putIfAbsent(key, () => []).add(item);
    }
    final keys = byDay.keys.toList()..sort();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final key in keys) ...[
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 8),
            child: Text(
              key == '—'
                  ? 'Sem data'
                  : DateFormat('EEE dd/MM').format(DateTime.parse(key)),
              style: Theme.of(context).textTheme.titleMedium?.copyWith(color: SerenaColors.sageDark),
            ),
          ),
          for (final item in byDay[key]!)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _AppointmentCard(
                item: item,
                onChanged: onChanged,
                conflicting: _hasConflict(item, items),
              ),
            ),
        ],
      ],
    );
  }
}

class _AppointmentCard extends ConsumerWidget {
  const _AppointmentCard({
    required this.item,
    required this.onChanged,
    this.compact = false,
    this.conflicting = false,
  });

  final Map<String, dynamic> item;
  final VoidCallback onChanged;
  final bool compact;
  final bool conflicting;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final starts = DateTime.tryParse(item['starts_at'] as String? ?? '')?.toLocal();
    final status = item['status'] as String? ?? '';
    final time = starts == null ? '' : DateFormat('HH:mm').format(starts);

    return Container(
      padding: EdgeInsets.all(compact ? 12 : 16),
      decoration: BoxDecoration(
        color: conflicting
            ? SerenaColors.danger.withValues(alpha: 0.06)
            : SerenaColors.surface,
        borderRadius: BorderRadius.circular(SerenaRadius.md),
        border: Border.all(
          color: conflicting ? SerenaColors.danger.withValues(alpha: 0.55) : SerenaColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(time, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  item['patient_display_name'] as String? ?? '',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (conflicting)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: Text(
                    'Conflito',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: SerenaColors.danger,
                        ),
                  ),
                ),
              _StatusBadge(status: status),
            ],
          ),
          if (!compact) ...[
            const SizedBox(height: 6),
            Text(
              _modality(item['modality'] as String?) +
                  (item['location'] != null ? ' · ${item['location']}' : '') +
                  (item['recurrence_id'] != null ? ' · Série recorrente' : ''),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (status == 'awaiting_confirmation' || status == 'scheduled')
                  OutlinedButton(
                    onPressed: () => _status(ref, 'confirmed'),
                    child: const Text('Confirmar'),
                  ),
                if (status == 'confirmed' || status == 'scheduled' || status == 'awaiting_confirmation') ...[
                  FilledButton(
                    onPressed: () => context.push(
                      '/sessoes/nova?patientId=${item['patient_id']}&appointmentId=${item['id']}',
                    ),
                    child: const Text('Iniciar sessão'),
                  ),
                  OutlinedButton(
                    onPressed: () => context.push('/pacientes/${item['patient_id']}/preparar'),
                    child: const Text('Preparar'),
                  ),
                  OutlinedButton(
                    onPressed: () => _reschedule(context, ref),
                    child: const Text('Reagendar'),
                  ),
                  OutlinedButton(
                    onPressed: () => _nudge(ref, const Duration(minutes: -15)),
                    child: const Text('−15 min'),
                  ),
                  OutlinedButton(
                    onPressed: () => _nudge(ref, const Duration(minutes: 15)),
                    child: const Text('+15 min'),
                  ),
                  OutlinedButton(
                    onPressed: () => _copyConfirmation(context, ref),
                    child: const Text('Mensagem'),
                  ),
                  OutlinedButton(
                    onPressed: () => _enqueueConfirmation(context, ref),
                    child: const Text('Enfileirar'),
                  ),
                  OutlinedButton(
                    onPressed: () => _status(ref, 'no_show'),
                    child: const Text('Falta'),
                  ),
                  OutlinedButton(
                    onPressed: () => _status(ref, 'cancelled', reason: 'Cancelado pela agenda'),
                    child: const Text('Cancelar'),
                  ),
                ],
              ],
            ),
          ] else ...[
            const SizedBox(height: 4),
            Text(
              'Segure para arrastar · toque para ações',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: SerenaColors.inkSoft),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (status == 'confirmed' || status == 'scheduled' || status == 'awaiting_confirmation') ...[
                  TextButton(
                    onPressed: () => context.push(
                      '/sessoes/nova?patientId=${item['patient_id']}&appointmentId=${item['id']}',
                    ),
                    child: const Text('Sessão'),
                  ),
                  TextButton(
                    onPressed: () => _reschedule(context, ref),
                    child: const Text('Reagendar'),
                  ),
                  TextButton(
                    onPressed: () => _nudge(ref, const Duration(minutes: -15)),
                    child: const Text('−15'),
                  ),
                  TextButton(
                    onPressed: () => _nudge(ref, const Duration(minutes: 15)),
                    child: const Text('+15'),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _status(WidgetRef ref, String status, {String? reason}) async {
    final client = ref.read(apiClientProvider);
    await client.post(
      '/api/v1/appointments/${item['id']}/status',
      body: {'status': status, if (reason != null) 'reason': reason},
    );
    onChanged();
  }

  Future<void> _copyConfirmation(BuildContext context, WidgetRef ref) async {
    try {
      final data = await ref.read(apiClientProvider).get(
            '/api/v1/appointments/${item['id']}/confirmation-message',
          );
      final message = data['message'] as String? ?? '';
      await Clipboard.setData(ClipboardData(text: message));
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mensagem copiada — cole no WhatsApp ou SMS.')),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _enqueueConfirmation(BuildContext context, WidgetRef ref) async {
    try {
      final data = await ref.read(apiClientProvider).post(
            '/api/v1/confirmations/appointments/${item['id']}/enqueue',
            body: {'channel': 'whatsapp'},
          );
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Confirmação enfileirada (${data['channel']}). Envio real será plugado depois.',
          ),
        ),
      );
      onChanged();
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _nudge(WidgetRef ref, Duration delta) async {
    final starts = DateTime.tryParse(item['starts_at'] as String? ?? '');
    if (starts == null) return;
    final next = starts.add(delta);
    await ref.read(apiClientProvider).post(
      '/api/v1/appointments/${item['id']}/reschedule',
      body: {
        'starts_at': next.toUtc().toIso8601String(),
        'version': item['version'],
      },
    );
    onChanged();
  }

  Future<void> _reschedule(BuildContext context, WidgetRef ref) async {
    final starts = DateTime.tryParse(item['starts_at'] as String? ?? '')?.toLocal() ??
        DateTime.now().add(const Duration(hours: 1));
    var next = starts;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            final bottom = MediaQuery.viewInsetsOf(ctx).bottom;
            return Padding(
              padding: EdgeInsets.fromLTRB(24, 8, 24, 24 + bottom),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Reagendar', style: Theme.of(ctx).textTheme.headlineMedium),
                  const SizedBox(height: 8),
                  Text(
                    item['patient_display_name'] as String? ?? '',
                    style: Theme.of(ctx).textTheme.bodyLarge,
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Novo horário'),
                    subtitle: Text(DateFormat('dd/MM/yyyy HH:mm').format(next)),
                    trailing: const Icon(Icons.edit_calendar_outlined),
                    onTap: () async {
                      final d = await showDatePicker(
                        context: ctx,
                        initialDate: next,
                        firstDate: DateTime.now().subtract(const Duration(days: 1)),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (d == null) return;
                      if (!ctx.mounted) return;
                      final t = await showTimePicker(
                        context: ctx,
                        initialTime: TimeOfDay.fromDateTime(next),
                      );
                      if (t == null) return;
                      setLocal(() {
                        next = DateTime(d.year, d.month, d.day, t.hour, t.minute);
                      });
                    },
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Salvar novo horário'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
    if (ok != true) return;
    await ref.read(apiClientProvider).post(
      '/api/v1/appointments/${item['id']}/reschedule',
      body: {
        'starts_at': next.toUtc().toIso8601String(),
        'version': item['version'],
      },
    );
    onChanged();
  }

  String _modality(String? m) => switch (m) {
        'online' => 'Online',
        'hybrid' => 'Híbrida',
        _ => 'Presencial',
      };
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final label = switch (status) {
      'confirmed' => 'Confirmado',
      'awaiting_confirmation' => 'Aguardando',
      'completed' => 'Realizado',
      'cancelled' => 'Cancelado',
      'no_show' => 'Falta',
      'rescheduled' => 'Reagendado',
      _ => 'Agendado',
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: SerenaColors.offWhite,
        borderRadius: BorderRadius.circular(SerenaRadius.sm),
        border: Border.all(color: SerenaColors.border),
      ),
      child: Text(label, style: Theme.of(context).textTheme.labelLarge),
    );
  }
}

class _CreateAppointmentSheet extends ConsumerStatefulWidget {
  const _CreateAppointmentSheet();

  @override
  ConsumerState<_CreateAppointmentSheet> createState() => _CreateAppointmentSheetState();
}

class _CreateAppointmentSheetState extends ConsumerState<_CreateAppointmentSheet> {
  List<Map<String, dynamic>> _patients = [];
  String? _patientId;
  DateTime _starts = DateTime.now().add(const Duration(hours: 1)).copyWith(minute: 0, second: 0, millisecond: 0);
  int _duration = 50;
  String _modality = 'in_person';
  String _recurrence = 'none';
  int _recurrenceCount = 8;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPatients();
  }

  Future<void> _loadPatients() async {
    try {
      final data = await ref.read(apiClientProvider).get('/api/v1/patients');
      setState(() {
        _patients = (data['items'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        if (_patients.isNotEmpty) _patientId = _patients.first['id'] as String;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  Future<void> _save() async {
    if (_patientId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final body = <String, dynamic>{
        'patient_id': _patientId,
        'starts_at': _starts.toUtc().toIso8601String(),
        'duration_minutes': _duration,
        'modality': _modality,
        'status': 'awaiting_confirmation',
      };
      if (_recurrence != 'none') {
        body['recurrence_frequency'] = _recurrence;
        body['recurrence_count'] = _recurrenceCount;
      }
      final result = await ref.read(apiClientProvider).post('/api/v1/appointments', body: body);
      if (!mounted) return;
      final series = result['series_count'] as int?;
      if (series != null && series > 1) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Série criada: $series atendimentos.')),
        );
      }
      Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 8, 24, 24 + bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Novo atendimento', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _patientId,
              items: [
                for (final p in _patients)
                  DropdownMenuItem(value: p['id'] as String, child: Text(p['display_name'] as String? ?? '')),
              ],
              onChanged: (v) => setState(() => _patientId = v),
              decoration: const InputDecoration(labelText: 'Paciente'),
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Data e horário'),
              subtitle: Text(DateFormat("dd/MM/yyyy HH:mm").format(_starts)),
              trailing: const Icon(Icons.edit_calendar_outlined),
              onTap: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: _starts,
                  firstDate: DateTime.now().subtract(const Duration(days: 1)),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (d == null) return;
                if (!context.mounted) return;
                final t = await showTimePicker(
                  context: context,
                  initialTime: TimeOfDay.fromDateTime(_starts),
                );
                if (t == null) return;
                if (!mounted) return;
                setState(() {
                  _starts = DateTime(d.year, d.month, d.day, t.hour, t.minute);
                });
              },
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<int>(
              value: _duration,
              items: const [
                DropdownMenuItem(value: 30, child: Text('30 min')),
                DropdownMenuItem(value: 50, child: Text('50 min')),
                DropdownMenuItem(value: 60, child: Text('60 min')),
                DropdownMenuItem(value: 90, child: Text('90 min')),
              ],
              onChanged: (v) => setState(() => _duration = v ?? 50),
              decoration: const InputDecoration(labelText: 'Duração'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _modality,
              items: const [
                DropdownMenuItem(value: 'in_person', child: Text('Presencial')),
                DropdownMenuItem(value: 'online', child: Text('Online')),
                DropdownMenuItem(value: 'hybrid', child: Text('Híbrida')),
              ],
              onChanged: (v) => setState(() => _modality = v ?? 'in_person'),
              decoration: const InputDecoration(labelText: 'Modalidade'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _recurrence,
              items: const [
                DropdownMenuItem(value: 'none', child: Text('Sem recorrência')),
                DropdownMenuItem(value: 'weekly', child: Text('Semanal')),
                DropdownMenuItem(value: 'biweekly', child: Text('Quinzenal')),
              ],
              onChanged: (v) => setState(() => _recurrence = v ?? 'none'),
              decoration: const InputDecoration(labelText: 'Recorrência'),
            ),
            if (_recurrence != 'none') ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                value: _recurrenceCount,
                items: const [
                  DropdownMenuItem(value: 4, child: Text('4 ocorrências')),
                  DropdownMenuItem(value: 8, child: Text('8 ocorrências')),
                  DropdownMenuItem(value: 12, child: Text('12 ocorrências')),
                  DropdownMenuItem(value: 24, child: Text('24 ocorrências')),
                ],
                onChanged: (v) => setState(() => _recurrenceCount = v ?? 8),
                decoration: const InputDecoration(labelText: 'Quantidade'),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: SerenaColors.danger)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _loading ? null : _save,
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text(_recurrence == 'none' ? 'Agendar' : 'Criar série'),
            ),
          ],
        ),
      ),
    );
  }
}
