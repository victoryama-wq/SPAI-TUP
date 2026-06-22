import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { AcademicAssignment, AssignmentsRepository } from '../../assignments/data/assignments.repository';
import { AcademicGroup, GroupsRepository } from '../../groups/data/groups.repository';
import { CyclesRepository } from '../../cycles/data/cycles.repository';

type MeetSharedFilter = 'TODAS' | 'COMPARTIDAS' | 'SIN_COMPARTIR';

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
  private readonly userSessionService = inject(UserSessionService);

  readonly assignments = this.assignmentsRepository.assignments;
  readonly activeCycle = this.cyclesRepository.activeCycle;
  readonly groups = this.groupsRepository.groups;
  readonly session = this.userSessionService.session;

  searchTerm = '';
  sharedFilter: MeetSharedFilter = 'TODAS';

  readonly activeCycleCode = computed(() => this.activeCycle()?.code ?? 'Pendiente de configurar');

  readonly canViewMeetLinks = computed(() => {
    const appUser = this.session()?.appUser;

    return appUser?.status === 'Activo'
      && (
        appUser.role.includes('Sistemas')
        || appUser.access?.ligasMeet === true
      );
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
      .filter((assignment) => !assignment.shared)
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

  private createMeetRow(baseAssignment: AcademicAssignment, sharedAssignments: AcademicAssignment[]): MeetClassRow | null {
    const involvedAssignments = [baseAssignment, ...sharedAssignments];
    const virtualGroups = involvedAssignments
      .map((assignment) => this.groupByFullName(assignment.group))
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
      sharedGroups: sharedAssignments.map((assignment) => assignment.group).sort((a, b) => a.localeCompare(b, 'es')),
      assignmentStatus: baseAssignment.status,
      observations: baseAssignment.observations,
    };
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
}
