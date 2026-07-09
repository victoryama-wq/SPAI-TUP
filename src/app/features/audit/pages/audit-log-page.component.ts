import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AuditLogEntry,
  AuditLogRepository,
} from '../../../core/data/audit-log.repository';

type PeriodFilter = 'Todos' | 'Hoy' | '7 dias' | '30 dias';

interface SummaryRow {
  label: string;
  value: number;
}

@Component({
  selector: 'app-audit-log-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-log-page.component.html',
  styleUrl: './audit-log-page.component.css',
})
export class AuditLogPageComponent {
  private readonly auditLogRepository = inject(AuditLogRepository);
  private readonly metadataKeysToHide = new Set([
    'action',
    'createdAt',
    'description',
    'entity',
    'entityId',
    'module',
    'user',
    'userRole',
  ]);

  readonly entries = this.auditLogRepository.entries;
  readonly readError = this.auditLogRepository.entriesReadError;
  readonly searchTerm = signal('');
  readonly selectedModule = signal('Todos');
  readonly selectedAction = signal('Todas');
  readonly selectedPeriod = signal<PeriodFilter>('Todos');
  readonly pageSize = signal(10);
  readonly currentPage = signal(1);

  readonly sortedEntries = computed(() =>
    [...this.entries()].sort((left, right) => this.timeValue(right.createdAt) - this.timeValue(left.createdAt)),
  );

  readonly moduleOptions = computed(() => this.uniqueValues(this.sortedEntries().map((entry) => entry.module)));
  readonly actionOptions = computed(() => this.uniqueValues(this.sortedEntries().map((entry) => entry.action)));

  readonly filteredEntries = computed(() => {
    const query = this.normalize(this.searchTerm());
    const module = this.selectedModule();
    const action = this.selectedAction();
    const period = this.selectedPeriod();

    return this.sortedEntries().filter((entry) => {
      const matchesModule = module === 'Todos' || entry.module === module;
      const matchesAction = action === 'Todas' || entry.action === action;
      const matchesPeriod = this.matchesPeriod(entry.createdAt, period);
      const matchesQuery = !query || this.entrySearchText(entry).includes(query);

      return matchesModule && matchesAction && matchesPeriod && matchesQuery;
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredEntries().length / this.pageSize())));

  readonly visibleEntries = computed(() => {
    const page = this.safeCurrentPage();
    const start = (page - 1) * this.pageSize();
    return this.filteredEntries().slice(start, start + this.pageSize());
  });

  readonly pageStart = computed(() =>
    this.filteredEntries().length ? (this.safeCurrentPage() - 1) * this.pageSize() + 1 : 0,
  );

  readonly pageEnd = computed(() =>
    Math.min(this.safeCurrentPage() * this.pageSize(), this.filteredEntries().length),
  );

  readonly todayCount = computed(() =>
    this.sortedEntries().filter((entry) => this.matchesPeriod(entry.createdAt, 'Hoy')).length,
  );

  readonly activeUsersCount = computed(() =>
    new Set(this.sortedEntries().map((entry) => entry.user).filter(Boolean)).size,
  );

  readonly moduleSummary = computed(() => this.buildSummary(this.filteredEntries().map((entry) => entry.module), 6));
  readonly actionSummary = computed(() => this.buildSummary(this.filteredEntries().map((entry) => entry.action), 6));
  readonly lastEntry = computed(() => this.sortedEntries()[0] ?? null);

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
    this.resetPage();
  }

  setModule(value: string): void {
    this.selectedModule.set(value);
    this.resetPage();
  }

  setAction(value: string): void {
    this.selectedAction.set(value);
    this.resetPage();
  }

  setPeriod(value: PeriodFilter): void {
    this.selectedPeriod.set(value);
    this.resetPage();
  }

  setPageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.resetPage();
  }

  previousPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1));
  }

  nextPage(): void {
    this.currentPage.update((page) => Math.min(this.totalPages(), page + 1));
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.selectedModule.set('Todos');
    this.selectedAction.set('Todas');
    this.selectedPeriod.set('Todos');
    this.resetPage();
  }

  safeCurrentPage(): number {
    return Math.min(this.currentPage(), this.totalPages());
  }

  formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Sin fecha';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  formatShortDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Sin fecha';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  moduleLabel(value: string): string {
    const labels: Record<string, string> = {
      asignaciones: 'Asignaciones',
      assignments: 'Asignaciones',
      docentes: 'Docentes',
      teachers: 'Docentes',
      asignaturas: 'Asignaturas',
      subjects: 'Asignaturas',
      solicitudes: 'Solicitudes',
      requests: 'Solicitudes',
      usuarios: 'Usuarios',
      users: 'Usuarios',
      ciclos: 'Ciclos',
      groups: 'Grupos',
      grupos: 'Grupos',
      moodle: 'Moodle',
      meet: 'Ligas Meet',
      ligas_meet: 'Ligas Meet',
      nomenclaturas: 'Nomenclaturas',
    };

    return labels[this.normalizeKey(value)] ?? this.toReadableLabel(value);
  }

  actionLabel(value: string): string {
    const labels: Record<string, string> = {
      create: 'Alta',
      created: 'Alta',
      update: 'Edicion',
      updated: 'Edicion',
      delete: 'Eliminacion',
      deleted: 'Eliminacion',
      import: 'Importacion',
      imported: 'Importacion',
      share: 'Clase compartida',
      shared: 'Clase compartida',
      status: 'Cambio de estado',
      validate: 'Validacion',
      validated: 'Validacion',
    };

    return labels[this.normalizeKey(value)] ?? this.toReadableLabel(value);
  }

  entryTone(entry: AuditLogEntry): string {
    const action = this.normalizeKey(entry.action);
    const module = this.normalizeKey(entry.module);

    if (action.includes('delete') || action.includes('elimin')) {
      return 'danger';
    }

    if (action.includes('share') || action.includes('compart')) {
      return 'info';
    }

    if (action.includes('update') || action.includes('edit')) {
      return 'warning';
    }

    if (action.includes('import') || module.includes('moodle')) {
      return 'purple';
    }

    return 'success';
  }

  metadataPairs(entry: AuditLogEntry): Array<{ key: string; value: string }> {
    return Object.entries(entry.metadata ?? {})
      .filter(([key, value]) => !this.metadataKeysToHide.has(key) && value !== null && value !== undefined)
      .map(([key, value]) => ({
        key: this.toReadableLabel(key),
        value: this.formatMetadataValue(value),
      }))
      .filter((pair) => pair.value.length > 0)
      .slice(0, 8);
  }

  trackByEntryId(_index: number, entry: AuditLogEntry): string {
    return entry.id;
  }

  private resetPage(): void {
    this.currentPage.set(1);
  }

  private matchesPeriod(createdAt: string, period: PeriodFilter): boolean {
    if (period === 'Todos') {
      return true;
    }

    const createdAtDate = new Date(createdAt);
    if (Number.isNaN(createdAtDate.getTime())) {
      return false;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (period === 'Hoy') {
      return createdAtDate.getTime() >= startOfToday;
    }

    const days = period === '7 dias' ? 7 : 30;
    return createdAtDate.getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000;
  }

  private entrySearchText(entry: AuditLogEntry): string {
    return this.normalize(
      [
        entry.module,
        this.moduleLabel(entry.module),
        entry.action,
        this.actionLabel(entry.action),
        entry.description,
        entry.user,
        entry.userRole,
        entry.entity,
        entry.entityId,
        ...Object.values(entry.metadata ?? {}).map((value) => this.formatMetadataValue(value)),
      ].join(' '),
    );
  }

  private buildSummary(values: string[], limit: number): SummaryRow[] {
    const counts = values.reduce<Record<string, number>>((summary, value) => {
      const label = value.trim();
      if (!label) {
        return summary;
      }

      summary[label] = (summary[label] ?? 0) + 1;
      return summary;
    }, {});

    return Object.entries(counts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, limit)
      .map(([label, value]) => ({
        label,
        value,
      }));
  }

  private uniqueValues(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((left, right) =>
      this.toReadableLabel(left).localeCompare(this.toReadableLabel(right), 'es'),
    );
  }

  private formatMetadataValue(value: unknown): string {
    if (Array.isArray(value)) {
      return value.map((item) => this.formatMetadataValue(item)).join(', ');
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    return String(value ?? '').trim();
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private normalizeKey(value: string): string {
    return this.normalize(value).replace(/\s+/g, '_').replace(/-+/g, '_');
  }

  private toReadableLabel(value: string): string {
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private timeValue(value: string): number {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
}
