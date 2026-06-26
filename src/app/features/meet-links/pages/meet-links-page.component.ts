import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { AcademicAssignment, AssignmentsRepository } from '../../assignments/data/assignments.repository';
import { AcademicGroup, GroupsRepository } from '../../groups/data/groups.repository';
import { CyclesRepository } from '../../cycles/data/cycles.repository';
import { MeetLink, MeetLinksRepository, MeetLinkStatus } from '../data/meet-links.repository';

type MeetSharedFilter = 'TODAS' | 'COMPARTIDAS' | 'SIN_COMPARTIR';

interface MeetLinkDraft {
  meetUrl: string;
  status: MeetLinkStatus;
  observations: string;
  sourceUpdatedAt: string;
}

interface MeetClassRow {
  id: string;
  cycle: string;
  moodleId: string;
  subjectId: string;
  subjectName: string;
  teacherName: string;
  teacherMoodleUser: string;
  originGroup: string;
  virtualGroups: string[];
  sharedGroups: string[];
  assignmentStatus: string;
  observations: string;
  meetLink: MeetLink | null;
}

@Component({
  selector: 'spai-meet-links-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './meet-links-page.component.html',
  styleUrl: './meet-links-page.component.css',
})
export class MeetLinksPageComponent {
  private readonly assignmentsRepository = inject(AssignmentsRepository);
  private readonly cyclesRepository = inject(CyclesRepository);
  private readonly groupsRepository = inject(GroupsRepository);
  private readonly meetLinksRepository = inject(MeetLinksRepository);
  private readonly userSessionService = inject(UserSessionService);

  readonly assignments = this.assignmentsRepository.assignments;
  readonly activeCycle = this.cyclesRepository.activeCycle;
  readonly groups = this.groupsRepository.groups;
  readonly meetLinks = this.meetLinksRepository.meetLinks;
  readonly meetLinksReadError = this.meetLinksRepository.readError;
  readonly session = this.userSessionService.session;

  searchTerm = '';
  sharedFilter: MeetSharedFilter = 'TODAS';
  formMessage = '';
  formMessageType: 'success' | 'error' = 'success';
  savingMeetLinkId = '';
  private readonly drafts = new Map<string, MeetLinkDraft>();

  readonly activeCycleCode = computed(() => this.activeCycle()?.code ?? 'Pendiente de configurar');

  readonly canViewMeetLinks = computed(() => {
    const currentSession = this.session();
    const appUser = currentSession?.appUser;

    return appUser?.status === 'Activo'
      && (
        appUser.role.includes('Sistemas')
        || appUser.access?.ligasMeet === true
      );
  });

  readonly canEditMeetLinks = computed(() => {
    const appUser = this.session()?.appUser;

    return appUser?.status === 'Activo' && appUser.role.includes('Sistemas');
  });

  readonly meetRows = computed(() => {
    const activeCycle = this.activeCycle();

    if (!activeCycle || !this.canViewMeetLinks()) {
      return [];
    }

    const assignments = this.assignments()
      .filter((assignment) => assignment.cycle === activeCycle.code && !assignment.special);
    const sharedBySource = new Map<string, AcademicAssignment[]>();

    assignments
      .filter((assignment) => assignment.shared && assignment.sourceAssignmentId)
      .forEach((assignment) => {
        const current = sharedBySource.get(assignment.sourceAssignmentId) ?? [];
        sharedBySource.set(assignment.sourceAssignmentId, [...current, assignment]);
      });

    return assignments
      .filter((assignment) => !assignment.sourceAssignmentId)
      .map((assignment) => this.createMeetRow(assignment, sharedBySource.get(assignment.id) ?? []))
      .filter((row): row is MeetClassRow => row !== null)
      .sort((a, b) => a.originGroup.localeCompare(b.originGroup, 'es'));
  });

  readonly visibleMeetRows = computed(() => {
    const search = this.normalizeSearchText(this.searchTerm);

    return this.meetRows().filter((row) => {
      const matchesSharedFilter = this.sharedFilter === 'TODAS'
        || (this.sharedFilter === 'COMPARTIDAS' && row.sharedGroups.length > 0)
        || (this.sharedFilter === 'SIN_COMPARTIR' && row.sharedGroups.length === 0);
      const matchesSearch = !search
        || this.normalizeSearchText([
          row.moodleId,
          row.subjectId,
          row.subjectName,
          row.teacherName,
          row.teacherMoodleUser,
          row.originGroup,
          row.virtualGroups.join(' '),
          row.sharedGroups.join(' '),
        ].join(' ')).includes(search);

      return matchesSharedFilter && matchesSearch;
    });
  });

  readonly sharedClassCount = computed(() =>
    this.meetRows().filter((row) => row.sharedGroups.length > 0).length,
  );

  readonly capturedMeetCount = computed(() =>
    this.meetRows().filter((row) => row.meetLink?.status === 'GENERADA' || row.meetLink?.status === 'REVISADA').length,
  );

  readonly pendingMeetCount = computed(() =>
    this.meetRows().filter((row) => !row.meetLink || row.meetLink.status === 'PENDIENTE').length,
  );

  readonly virtualGroupCount = computed(() =>
    new Set(this.meetRows().flatMap((row) => row.virtualGroups)).size,
  );

  updateSearchTerm(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
  }

  updateSharedFilter(event: Event): void {
    this.sharedFilter = (event.target as HTMLSelectElement).value as MeetSharedFilter;
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      EN_CAPTURA: 'En captura',
      EN_REVISION: 'En revision',
      CARGADO_MOODLE: 'Cargado en Moodle',
      VALIDADO: 'Cargado en Moodle',
      CON_OBSERVACION: 'En revision',
    };

    return labels[status] ?? status;
  }

  statusClass(status: string): string {
    if (status === 'VALIDADO') {
      return 'cargado_moodle';
    }

    if (status === 'CON_OBSERVACION') {
      return 'en_revision';
    }

    return status.toLowerCase();
  }

  meetStatusLabel(status: MeetLinkStatus | null | undefined): string {
    const labels: Record<MeetLinkStatus, string> = {
      PENDIENTE: 'Pendiente',
      GENERADA: 'Generada',
      REVISADA: 'Revisada',
      CON_OBSERVACION: 'Con observacion',
      NO_APLICA: 'No aplica',
    };

    return labels[status ?? 'PENDIENTE'];
  }

  meetStatusClass(status: MeetLinkStatus | null | undefined): string {
    return (status ?? 'PENDIENTE').toLowerCase();
  }

  draftFor(row: MeetClassRow): MeetLinkDraft {
    const sourceUpdatedAt = row.meetLink?.updatedAt ?? '';
    const currentDraft = this.drafts.get(row.id);

    if (currentDraft && currentDraft.sourceUpdatedAt === sourceUpdatedAt) {
      return currentDraft;
    }

    const draft: MeetLinkDraft = {
      meetUrl: row.meetLink?.meetUrl ?? '',
      status: row.meetLink?.status ?? 'PENDIENTE',
      observations: row.meetLink?.observations ?? '',
      sourceUpdatedAt,
    };

    this.drafts.set(row.id, draft);

    return draft;
  }

  updateMeetUrl(row: MeetClassRow, event: Event): void {
    this.draftFor(row).meetUrl = (event.target as HTMLInputElement).value;
  }

  updateMeetStatus(row: MeetClassRow, event: Event): void {
    this.draftFor(row).status = (event.target as HTMLSelectElement).value as MeetLinkStatus;
  }

  updateMeetObservations(row: MeetClassRow, event: Event): void {
    this.draftFor(row).observations = (event.target as HTMLInputElement).value;
  }

  async saveMeetLink(row: MeetClassRow): Promise<void> {
    const currentSession = this.session();
    const appUser = currentSession?.appUser;
    const draft = this.draftFor(row);
    const meetUrl = draft.meetUrl.trim();

    if (!appUser || !this.canEditMeetLinks()) {
      this.showTemporaryMessage('No tienes permisos para editar ligas Meet.', 'error');
      return;
    }

    if (meetUrl && !this.isValidMeetUrl(meetUrl)) {
      this.showTemporaryMessage('La liga debe iniciar con https://meet.google.com/.', 'error');
      return;
    }

    if ((draft.status === 'GENERADA' || draft.status === 'REVISADA') && !meetUrl) {
      this.showTemporaryMessage('Captura la liga Meet antes de marcarla como generada o revisada.', 'error');
      return;
    }

    this.savingMeetLinkId = row.id;
    this.formMessage = '';

    try {
      await this.meetLinksRepository.upsertMeetLink({
        assignmentId: row.id,
        cycle: row.cycle,
        meetUrl,
        status: draft.status,
        observations: draft.observations,
        createdBy: currentSession.authUid,
        createdByName: appUser.name,
        createdByRole: appUser.role,
      });

      this.drafts.delete(row.id);
      this.showTemporaryMessage('Liga Meet guardada correctamente.', 'success');
    } catch (error) {
      this.showTemporaryMessage(`No se pudo guardar la liga Meet. ${this.errorMessage(error)}`, 'error');
    } finally {
      this.savingMeetLinkId = '';
    }
  }

  private createMeetRow(baseAssignment: AcademicAssignment, sharedAssignments: AcademicAssignment[]): MeetClassRow | null {
    const sharedGroups = this.assignmentSharedGroups(baseAssignment, sharedAssignments);
    const involvedGroups = [baseAssignment.group, ...sharedGroups];
    const virtualGroups = involvedGroups
      .map((fullGroup) => this.groupByFullName(fullGroup))
      .filter((group): group is AcademicGroup => group !== null && group.modality === 'Virtual')
      .map((group) => group.fullGroup);

    if (!virtualGroups.length) {
      return null;
    }

    return {
      id: baseAssignment.id,
      cycle: baseAssignment.cycle,
      moodleId: baseAssignment.moodleId,
      subjectId: baseAssignment.subjectId,
      subjectName: baseAssignment.subjectName,
      teacherName: baseAssignment.teacherName,
      teacherMoodleUser: baseAssignment.teacherMoodleUser,
      originGroup: baseAssignment.group,
      virtualGroups,
      sharedGroups,
      assignmentStatus: baseAssignment.status,
      observations: baseAssignment.observations,
      meetLink: this.meetLinks().find((link) => link.assignmentId === baseAssignment.id) ?? null,
    };
  }

  private assignmentSharedGroups(baseAssignment: AcademicAssignment, legacySharedAssignments: AcademicAssignment[]): string[] {
    const groups = [
      ...(baseAssignment.sharedGroups ?? []),
      ...legacySharedAssignments.map((assignment) => assignment.group),
    ];

    return Array.from(new Set(groups.map((group) => group.trim().toUpperCase()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'es'));
  }

  private groupByFullName(fullGroup: string): AcademicGroup | null {
    return this.groups().find((group) => group.fullGroup === fullGroup) ?? null;
  }

  private normalizeSearchText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private isValidMeetUrl(value: string): boolean {
    return value.trim().toLowerCase().startsWith('https://meet.google.com/');
  }

  private showTemporaryMessage(message: string, type: 'success' | 'error'): void {
    this.formMessage = message;
    this.formMessageType = type;

    window.setTimeout(() => {
      if (this.formMessage === message) {
        this.formMessage = '';
      }
    }, 4000);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
