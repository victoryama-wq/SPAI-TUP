import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { AcademicAssignment, AssignmentStatus, AssignmentsRepository } from '../../assignments/data/assignments.repository';
import { CyclesRepository } from '../../cycles/data/cycles.repository';
import { NomenclaturesRepository } from '../../nomenclatures/data/nomenclatures.repository';
import {
  MoodleCatalogStatus,
  MoodleCategoriesRepository,
  MoodleCategory,
  UpsertMoodleCategoryPayload,
} from '../data/moodle-categories.repository';
import {
  MoodleCourseTemplate,
  MoodleTemplatesRepository,
  UpsertMoodleCourseTemplatePayload,
} from '../data/moodle-templates.repository';

type MoodleTab = 'catalogos' | 'lotes';
type MoodleModal = 'categoria' | 'plantilla' | null;
type MoodleBatchMode = 'Escolarizado' | 'Ejecutivo' | 'Virtual' | 'Salud' | 'Posgrados' | 'Especiales' | 'Inglés';
type MoodleBatchView = 'modalidad' | 'plantilla';
const CATEGORY_PAGE_SIZE_OPTIONS = [5, 10, 25];
const MOODLE_BATCH_MODES: MoodleBatchMode[] = ['Escolarizado', 'Ejecutivo', 'Virtual', 'Salud', 'Posgrados', 'Especiales', 'Inglés'];
const HEALTH_PROGRAM_CODES = new Set(['ENF', 'NUT', 'PSIC', 'EECI', 'EEQX', 'MADH']);
const TEMPLATE_BY_SUBJECT_NAME_PROGRAM_CODES = new Set(['EECI', 'EEQX', 'MADH']);
const TEMPLATE_BY_INITIAL_CODE_PROGRAM_CODES = new Set(['MADH']);
const SPECIAL_ARCHITECTURE_DEMO_PROGRAM_CODES = new Set(['ARQ', 'LARQ']);
const ENGLISH_PROGRAM_CODES = new Set(['ING', 'ING-FCS']);
const HEALTH_TEXT_MARKERS = ['facultad de ciencias de la salud', 'ciencias de la salud', 'salud'];
const ENGLISH_TEXT_MARKERS = ['ingles', 'inglés'];
const POSTGRADUATE_TEXT_MARKERS = ['maestria', 'especialidad', 'especializacion', 'doctorado', 'posgrado'];
const NURSING_HEALTH_TEMPLATE = 'CURSO_DEMO_ENF';
const NUTRITION_HEALTH_TEMPLATE = 'CURSO_DEMO_NUT';
const DEFAULT_TEMPLATE_BY_MODE: Partial<Record<MoodleBatchMode, string>> = {
  Escolarizado: 'CURSO_DEMO_ESCOLARIZADO',
};

interface CategoryFormState {
  categoryNumber: string;
  programCode: string;
  programName: string;
  status: MoodleCatalogStatus;
}

interface TemplateFormState {
  templateCourse: string;
  modality: string;
  programCode: string;
  status: MoodleCatalogStatus;
}

interface ActorData {
  uid: string;
  name: string;
  role: string;
}

interface TemplateCsvPreviewRow extends UpsertMoodleCourseTemplatePayload {
  rowNumber: number;
}

interface ProgramOption {
  code: string;
  name: string;
  label: string;
}

const SPECIAL_MOODLE_PROGRAM_OPTIONS: ProgramOption[] = [
  {
    code: 'PROPEDEUTICOS_TUP',
    name: 'Propedeuticos TUP',
    label: 'PROPEDEUTICOS_TUP - Propedeuticos TUP',
  },
  {
    code: 'PROPEDEUTICOS_FCS',
    name: 'Propedeuticos Salud',
    label: 'PROPEDEUTICOS_FCS - Propedeuticos Salud',
  },
];

const CATEGORY_PROGRAM_ALIASES: Record<string, string> = {
  PROPEDEUTICOS_SALUD: 'PROPEDEUTICOS_FCS',
};

@Component({
  selector: 'spai-moodle-page',
  imports: [CommonModule, FormsModule],
  providers: [
    AssignmentsRepository,
    MoodleCategoriesRepository,
    MoodleTemplatesRepository,
    NomenclaturesRepository,
  ],
  templateUrl: './moodle-page.component.html',
  styleUrl: './moodle-page.component.css',
})
export class MoodlePageComponent {
  private readonly assignmentsRepository = inject(AssignmentsRepository);
  private readonly categoriesRepository = inject(MoodleCategoriesRepository);
  private readonly cyclesRepository = inject(CyclesRepository);
  private readonly nomenclaturesRepository = inject(NomenclaturesRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly templatesRepository = inject(MoodleTemplatesRepository);
  private readonly userSessionService = inject(UserSessionService);

  readonly assignments = this.assignmentsRepository.assignments;
  readonly categories = this.categoriesRepository.categories;
  readonly nomenclatures = this.nomenclaturesRepository.nomenclatures;
  readonly templates = this.templatesRepository.templates;
  readonly categoriesReadError = this.categoriesRepository.categoriesReadError;
  readonly templatesReadError = this.templatesRepository.templatesReadError;
  readonly activeCycle = this.cyclesRepository.activeCycle;
  readonly session = this.userSessionService.session;

  readonly selectedAssignments = signal<string[]>([]);
  private readonly tabParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly activeTab = computed<MoodleTab>(() => this.tabParams().get('tab') === 'lotes' ? 'lotes' : 'catalogos');
  activeModal: MoodleModal = null;
  editingCategoryId: string | null = null;
  editingTemplateId: string | null = null;
  formMessage = '';
  formMessageType: 'success' | 'error' = 'success';
  csvMessage = '';
  csvMessageType: 'success' | 'error' = 'success';
  templateCsvPreview: TemplateCsvPreviewRow[] = [];
  readonly batchSearch = signal('');
  readonly batchStatus = signal<AssignmentStatus | 'TODOS'>('TODOS');
  readonly activeBatchMode = signal<MoodleBatchMode>('Escolarizado');
  readonly batchViewMode = signal<MoodleBatchView>('modalidad');
  readonly activeBatchTemplateType = signal('');
  readonly activeTemplateType = signal('');
  readonly templateSearch = signal('');
  categoryProgramSearch = '';
  categoryProgramPickerOpen = false;
  templateProgramSearch = '';
  templateProgramPickerOpen = false;
  categoryCurrentPage = signal(1);
  templateCurrentPage = signal(1);
  categoryPageSize = 5;
  templatePageSize = 5;
  readonly categoryPageSizeOptions = CATEGORY_PAGE_SIZE_OPTIONS;
  readonly templatePageSizeOptions = CATEGORY_PAGE_SIZE_OPTIONS;
  readonly batchModes = MOODLE_BATCH_MODES;
  readonly templateSelections: Record<string, string> = {};

  categoryForm: CategoryFormState = this.emptyCategoryForm();
  templateForm: TemplateFormState = this.emptyTemplateForm();

  readonly activeCycleCode = computed(() => this.activeCycle()?.code ?? 'Pendiente');
  readonly activeTemplatesCount = computed(() => this.activeTemplates().length);
  readonly pendingBatchCount = computed(() =>
    this.moodleAssignments().filter((assignment) => assignment.status === 'EN_CAPTURA').length,
  );

  activeCycleCloseLabel(): string {
    const closeAt = this.activeCycle()?.tentativeCaptureCloseAt;

    if (!closeAt) {
      return 'Pendiente';
    }

    const date = new Date(`${closeAt}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? closeAt
      : new Intl.DateTimeFormat('es-MX', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).format(date).replace('.', '');
  }

  selectMoodleTab(tab: MoodleTab): void {
    void this.router.navigate(['/moodle'], { queryParams: { tab } });
  }

  readonly canManageMoodle = computed(() => {
    const appUser = this.session()?.appUser;

    return appUser?.status === 'Activo'
      && appUser.role.includes('Sistemas')
      && appUser.access?.moodle === true;
  });

  readonly visibleCategories = computed(() =>
    [...this.categories()].sort((first, second) =>
      this.normalizeCategoryProgramAlias(first.programCode)
        .localeCompare(this.normalizeCategoryProgramAlias(second.programCode), 'es', { numeric: true }),
    ),
  );

  readonly paginatedCategories = computed(() => {
    const startIndex = (this.currentCategorySafePage() - 1) * this.categoryPageSize;

    return this.visibleCategories().slice(startIndex, startIndex + this.categoryPageSize);
  });

  readonly programOptions = computed<ProgramOption[]>(() => {
    const optionsByCode = new Map<string, ProgramOption>();

    this.nomenclatures()
      .filter((nomenclature) => nomenclature.status === 'ACTIVA')
      .forEach((nomenclature) => {
        const code = this.normalizeProgramCode(nomenclature.abbreviation || nomenclature.programCode);

        if (!code || optionsByCode.has(code)) {
          return;
        }

        const name = nomenclature.programName.trim();
        optionsByCode.set(code, {
          code,
          name,
          label: name ? `${code} - ${name}` : code,
        });
      });

    const sortedOptions = [...optionsByCode.values()].sort((first, second) =>
      first.code.localeCompare(second.code, 'es', { numeric: true }),
    );

    return [
      ...SPECIAL_MOODLE_PROGRAM_OPTIONS,
      ...sortedOptions.filter((option) =>
        !SPECIAL_MOODLE_PROGRAM_OPTIONS.some((specialOption) => specialOption.code === option.code),
      ),
    ];
  });

  readonly templateProgramOptions = computed<ProgramOption[]>(() =>
    this.programOptions().filter((option) =>
      !SPECIAL_MOODLE_PROGRAM_OPTIONS.some((specialOption) => specialOption.code === option.code),
    ),
  );

  filteredCategoryProgramOptions(): ProgramOption[] {
    const search = this.normalizeSearchText(this.categoryProgramSearch);
    const options = this.programOptions();

    if (!search) {
      return options.slice(0, 8);
    }

    return options
      .filter((option) => this.normalizeSearchText(option.label).includes(search))
      .slice(0, 8);
  }

  filteredTemplateProgramOptions(): ProgramOption[] {
    const search = this.normalizeSearchText(this.templateProgramSearch);
    const options = this.templateProgramOptions();

    if (!search) {
      return options.slice(0, 8);
    }

    return options
      .filter((option) => this.normalizeSearchText(option.label).includes(search))
      .slice(0, 8);
  }

  readonly sortedTemplates = computed(() =>
    [...this.templates()].sort((first, second) =>
      first.modality.localeCompare(second.modality, 'es', { numeric: true })
      || first.templateCourse.localeCompare(second.templateCourse, 'es', { numeric: true }),
    ),
  );

  readonly visibleTemplates = computed(() => {
    const activeType = this.resolvedTemplateType();
    const search = this.normalizeSearchText(this.templateSearch());
    const templatesByType = activeType
      ? this.sortedTemplates().filter((template) => this.templateTypeLabel(template.modality) === activeType)
      : this.sortedTemplates();

    if (!search) {
      return templatesByType;
    }

    return templatesByType.filter((template) => {
      const searchText = this.normalizeSearchText([
        template.templateCourse,
        template.name,
        this.templateTypeLabel(template.modality),
        template.programCode,
        template.programCode ? this.programOptionLabel(template.programCode, template.programCode) : '',
      ].join(' '));

      return searchText.includes(search);
    });
  });

  readonly paginatedTemplates = computed(() => {
    const startIndex = (this.currentTemplateSafePage() - 1) * this.templatePageSize;

    return this.visibleTemplates().slice(startIndex, startIndex + this.templatePageSize);
  });

  readonly activeTemplates = computed(() =>
    this.templates().filter((template) => template.status === 'Activo'),
  );

  readonly templateTypeTabs = computed(() => {
    const summary = new Map<string, number>();

    this.templates().forEach((template) => {
      const label = this.templateTypeLabel(template.modality);
      summary.set(label, (summary.get(label) ?? 0) + 1);
    });

    const typeTabs = [...summary.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((first, second) => first.label.localeCompare(second.label, 'es', { numeric: true }));

    return typeTabs;
  });

  readonly resolvedTemplateType = computed(() => {
    const activeType = this.activeTemplateType();
    const tabs = this.templateTypeTabs();

    if (tabs.some((tab) => tab.label === activeType)) {
      return activeType;
    }

    return tabs[0]?.label ?? '';
  });

  readonly moodleAssignments = computed(() => {
    const activeCycle = this.activeCycle();

    if (!activeCycle) {
      return [];
    }

    const search = this.normalizeSearchText(this.batchSearch());
    const selectedStatus = this.batchStatus();

    return this.assignments()
      .filter((assignment) => assignment.cycle === activeCycle.code)
      .filter((assignment) => !assignment.sourceAssignmentId)
      .filter((assignment) => this.assignmentMatchesActiveBatchView(assignment))
      .filter((assignment) => selectedStatus === 'TODOS' || this.assignmentMatchesStatusGroup(assignment, selectedStatus))
      .filter((assignment) => {
        if (!search) {
          return true;
        }

        return this.normalizeSearchText([
          assignment.moodleId,
          assignment.subjectName,
          assignment.teacherName,
          assignment.teacherMoodleUser,
          assignment.program,
          assignment.group,
          assignment.sharedGroups?.join(' '),
          assignment.studentEnrollments,
        ].join(' ')).includes(search);
      })
      .sort((first, second) =>
        first.program.localeCompare(second.program, 'es', { numeric: true })
        || first.group.localeCompare(second.group, 'es', { numeric: true })
        || first.subjectName.localeCompare(second.subjectName, 'es'),
      );
  });

  readonly currentCycleMoodleAssignments = computed(() => {
    const activeCycle = this.activeCycle();

    if (!activeCycle) {
      return [];
    }

    return this.assignments()
      .filter((assignment) => assignment.cycle === activeCycle.code)
      .filter((assignment) => !assignment.sourceAssignmentId);
  });

  readonly loadedMoodleAssignments = computed(() =>
    this.currentCycleMoodleAssignments().filter((assignment) => this.isLoadedInMoodle(assignment)),
  );

  readonly batchModeSummary = computed(() =>
    this.batchModes.map((mode) => ({
      mode,
      count: this.loadedMoodleAssignments().filter((assignment) => this.assignmentBatchMode(assignment) === mode).length,
    })),
  );

  readonly batchModeTabs = computed(() =>
    this.batchModes.map((mode) => ({
      mode,
      count: this.currentCycleMoodleAssignments().filter((assignment) => this.assignmentBatchMode(assignment) === mode).length,
    })),
  );

  readonly batchTemplateTypeTabs = computed(() => {
    const summary = new Map<string, number>();

    this.currentCycleMoodleAssignments().forEach((assignment) => {
      const label = this.assignmentTemplateType(assignment);
      summary.set(label, (summary.get(label) ?? 0) + 1);
    });

    return [...summary.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((first, second) => first.label.localeCompare(second.label, 'es', { numeric: true }));
  });

  readonly resolvedBatchTemplateType = computed(() => {
    const activeType = this.activeBatchTemplateType();
    const tabs = this.batchTemplateTypeTabs();

    if (tabs.some((tab) => tab.label === activeType)) {
      return activeType;
    }

    return tabs[0]?.label ?? '';
  });

  readonly batchTemplateTypeSummary = computed(() =>
    this.batchTemplateTypeTabs().map((tab) => ({
      label: tab.label,
      count: this.loadedMoodleAssignments().filter((assignment) => this.assignmentTemplateType(assignment) === tab.label).length,
    })),
  );

  selectBatchMode(mode: MoodleBatchMode): void {
    this.activeBatchMode.set(mode);
  }

  selectBatchTemplateType(type: string): void {
    this.activeBatchTemplateType.set(type);
  }

  selectTemplateType(type: string): void {
    this.activeTemplateType.set(type);
    this.templateCurrentPage.set(1);
  }

  selectTemplateTypeFromEvent(event: Event): void {
    this.selectTemplateType((event.target as HTMLSelectElement).value);
  }

  selectTemplateTypeFromPicker(type: string, picker: HTMLDetailsElement): void {
    this.selectTemplateType(type);
    picker.open = false;
  }

  updateTemplateSearch(value: string): void {
    this.templateSearch.set(value);
    this.templateCurrentPage.set(1);
  }

  clearTemplateSearch(): void {
    this.templateSearch.set('');
    this.templateCurrentPage.set(1);
  }

  toggleBatchViewMode(): void {
    this.batchViewMode.set(this.batchViewMode() === 'modalidad' ? 'plantilla' : 'modalidad');
    this.selectedAssignments.set([]);
  }

  batchViewToggleLabel(): string {
    return this.batchViewMode() === 'modalidad'
      ? 'Vista por plantilla'
      : 'Vista por modalidad';
  }

  batchEmptyLabel(): string {
    return this.batchViewMode() === 'modalidad'
      ? this.activeBatchMode()
      : (this.resolvedBatchTemplateType() || 'tipo de plantilla');
  }


  openCategoryModal(category?: MoodleCategory): void {
    this.dismissMessages();
    this.activeModal = 'categoria';
    this.editingCategoryId = category?.id ?? null;
    this.categoryForm = category
      ? {
          categoryNumber: category.categoryNumber,
          programCode: category.programCode,
          programName: category.programName,
          status: category.status,
        }
      : this.emptyCategoryForm();
    this.categoryProgramSearch = category
      ? this.programOptionLabel(category.programCode, category.programName)
      : '';
    this.categoryProgramPickerOpen = false;
  }

  openTemplateModal(template?: MoodleCourseTemplate): void {
    this.dismissMessages();
    this.activeModal = 'plantilla';
    this.editingTemplateId = template?.id ?? null;
    this.templateForm = template
      ? {
          templateCourse: template.templateCourse,
          modality: template.modality,
          programCode: template.programCode,
          status: template.status,
        }
      : this.emptyTemplateForm();
    this.templateProgramSearch = template && this.isProgramTemplate(template.modality)
      ? this.programOptionLabel(template.programCode, template.programCode)
      : '';
    this.templateProgramPickerOpen = false;
  }

  closeModal(): void {
    this.activeModal = null;
    this.editingCategoryId = null;
    this.editingTemplateId = null;
    this.categoryProgramPickerOpen = false;
    this.templateProgramPickerOpen = false;
  }

  updateCategoryProgramSearch(value: string): void {
    this.categoryProgramSearch = value;
    const match = this.findProgramOption(value);

    this.categoryForm.programCode = match?.code ?? this.normalizeProgramCode(value.split('-')[0] ?? value);
    this.categoryForm.programName = match?.name ?? '';
    this.categoryProgramPickerOpen = true;
  }

  selectCategoryProgram(option: ProgramOption): void {
    this.categoryForm.programCode = option.code;
    this.categoryForm.programName = option.name;
    this.categoryProgramSearch = option.label;
    this.categoryProgramPickerOpen = false;
  }

  toggleCategoryProgramPicker(): void {
    this.categoryProgramPickerOpen = !this.categoryProgramPickerOpen;
  }

  updateTemplateType(value: string): void {
    this.templateForm.modality = value;

    if (!this.isProgramTemplate(value)) {
      this.templateForm.programCode = '';
      this.templateProgramSearch = '';
      this.templateProgramPickerOpen = false;
    }
  }

  updateTemplateProgramSearch(value: string): void {
    this.templateProgramSearch = value;
    const match = this.findTemplateProgramOption(value);

    this.templateForm.programCode = match?.code ?? this.normalizeProgramCode(value.split('-')[0] ?? value);
    this.templateProgramPickerOpen = true;
  }

  selectTemplateProgram(option: ProgramOption): void {
    this.templateForm.programCode = option.code;
    this.templateProgramSearch = option.label;
    this.templateProgramPickerOpen = false;
  }

  toggleTemplateProgramPicker(): void {
    this.templateProgramPickerOpen = !this.templateProgramPickerOpen;
  }

  selectCategoryPageSize(event: Event): void {
    this.categoryPageSize = Number((event.target as HTMLSelectElement).value) || 5;
    this.categoryCurrentPage.set(1);
  }

  goToPreviousCategoryPage(): void {
    this.categoryCurrentPage.set(Math.max(1, this.currentCategorySafePage() - 1));
  }

  goToNextCategoryPage(): void {
    this.categoryCurrentPage.set(Math.min(this.totalCategoryPages(), this.currentCategorySafePage() + 1));
  }

  selectTemplatePageSize(event: Event): void {
    this.templatePageSize = Number((event.target as HTMLSelectElement).value) || 5;
    this.templateCurrentPage.set(1);
  }

  goToPreviousTemplatePage(): void {
    this.templateCurrentPage.set(Math.max(1, this.currentTemplateSafePage() - 1));
  }

  goToNextTemplatePage(): void {
    this.templateCurrentPage.set(Math.min(this.totalTemplatePages(), this.currentTemplateSafePage() + 1));
  }

  totalCategoryPages(): number {
    return Math.max(1, Math.ceil(this.visibleCategories().length / this.categoryPageSize));
  }

  totalTemplatePages(): number {
    return Math.max(1, Math.ceil(this.visibleTemplates().length / this.templatePageSize));
  }

  currentCategorySafePage(): number {
    return Math.min(this.categoryCurrentPage(), this.totalCategoryPages());
  }

  currentTemplateSafePage(): number {
    return Math.min(this.templateCurrentPage(), this.totalTemplatePages());
  }

  categoryPaginationStart(): number {
    const total = this.visibleCategories().length;

    if (!total) {
      return 0;
    }

    return (this.currentCategorySafePage() - 1) * this.categoryPageSize + 1;
  }

  categoryPaginationEnd(): number {
    return Math.min(this.currentCategorySafePage() * this.categoryPageSize, this.visibleCategories().length);
  }

  templatePaginationStart(): number {
    const total = this.visibleTemplates().length;

    if (!total) {
      return 0;
    }

    return (this.currentTemplateSafePage() - 1) * this.templatePageSize + 1;
  }

  templatePaginationEnd(): number {
    return Math.min(this.currentTemplateSafePage() * this.templatePageSize, this.visibleTemplates().length);
  }

  closeCategoryProgramPickerSoon(): void {
    window.setTimeout(() => {
      this.categoryProgramPickerOpen = false;
    }, 120);
  }

  closeTemplateProgramPickerSoon(): void {
    window.setTimeout(() => {
      this.templateProgramPickerOpen = false;
    }, 120);
  }

  async saveCategory(): Promise<void> {
    const actor = this.actorData();

    if (!actor || !this.canManageMoodle()) {
      this.showMessage('No tienes permisos para administrar categorias Moodle.', 'error');
      return;
    }

    const selectedProgram = this.findProgramOption(this.categoryForm.programCode || this.categoryProgramSearch);
    const programCode = selectedProgram?.code ?? this.normalizeProgramCode(this.categoryForm.programCode);
    const programName = selectedProgram?.name ?? (this.categoryForm.programName.trim() || programCode);
    const categoryNumber = this.categoryForm.categoryNumber.trim();

    if (!categoryNumber || !programCode) {
      this.showMessage('Captura numero de categoria y programa.', 'error');
      return;
    }

    try {
      const currentCategory = this.categories().find((category) => category.id === this.editingCategoryId);
      const addsProgramToSameCategory = !!currentCategory
        && currentCategory.categoryNumber.trim() === categoryNumber
        && this.normalizeProgramCode(currentCategory.programCode) !== programCode;
      const categoryIdToUpdate = addsProgramToSameCategory ? null : this.editingCategoryId;

      await this.categoriesRepository.upsertCategory({
        ...this.categoryForm,
        categoryNumber,
        programCode,
        programName,
        status: 'Activo',
        ...actor,
        createdBy: actor.uid,
        createdByName: actor.name,
        createdByRole: actor.role,
      }, categoryIdToUpdate);
      this.closeModal();
      this.showMessage(
        addsProgramToSameCategory
          ? 'Programa agregado a la categoria Moodle correctamente.'
          : 'Categoria Moodle guardada correctamente.',
        'success',
      );
    } catch (error) {
      this.showMessage(`No se pudo guardar la categoria. ${this.errorMessage(error)}`, 'error');
    }
  }

  async saveTemplate(): Promise<void> {
    const actor = this.actorData();

    if (!actor || !this.canManageMoodle()) {
      this.showMessage('No tienes permisos para administrar plantillas Moodle.', 'error');
      return;
    }

    if (!this.templateForm.templateCourse.trim() || !this.templateForm.modality.trim()) {
      this.showMessage('Captura nombre corto Moodle y tipo de plantilla.', 'error');
      return;
    }

    const templateMatches = this.filteredTemplateProgramOptions();
    const selectedProgram = this.isProgramTemplate(this.templateForm.modality)
      ? this.findTemplateProgramOption(this.templateForm.programCode || this.templateProgramSearch)
        ?? (templateMatches.length === 1 ? templateMatches[0] : null)
      : null;
    const programCode = selectedProgram?.code ?? '';

    if (this.isProgramTemplate(this.templateForm.modality) && !programCode) {
      this.showMessage('Selecciona el programa al que pertenece la plantilla.', 'error');
      return;
    }

    try {
      await this.templatesRepository.upsertTemplate({
        ...this.templateForm,
        name: this.templateForm.templateCourse,
        modality: this.normalizeTemplateType(this.templateForm.modality),
        programCode: this.isProgramTemplate(this.templateForm.modality) ? programCode : '',
        createdBy: actor.uid,
        createdByName: actor.name,
        createdByRole: actor.role,
      }, this.editingTemplateId);
      this.closeModal();
      this.showMessage('Plantilla de curso guardada correctamente.', 'success');
    } catch (error) {
      this.showMessage(`No se pudo guardar la plantilla. ${this.errorMessage(error)}`, 'error');
    }
  }

  async deleteCategory(category: MoodleCategory): Promise<void> {
    if (!this.canManageMoodle()) {
      this.showMessage('No tienes permisos para eliminar categorias Moodle.', 'error');
      return;
    }

    try {
      await this.categoriesRepository.deleteCategory(category.id);
      this.showMessage('Categoria Moodle eliminada correctamente.', 'success');
    } catch (error) {
      this.showMessage(`No se pudo eliminar la categoria. ${this.errorMessage(error)}`, 'error');
    }
  }

  async deleteTemplate(template: MoodleCourseTemplate): Promise<void> {
    if (!this.canManageMoodle()) {
      this.showMessage('No tienes permisos para eliminar plantillas Moodle.', 'error');
      return;
    }

    try {
      await this.templatesRepository.deleteTemplate(template.id);
      this.showMessage('Plantilla de curso eliminada correctamente.', 'success');
    } catch (error) {
      this.showMessage(`No se pudo eliminar la plantilla. ${this.errorMessage(error)}`, 'error');
    }
  }

  importCategoriesCsv(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    void this.readCsvFile(file)
      .then((rows) => this.saveCategoryRows(rows))
      .finally(() => {
        input.value = '';
      });
  }

  downloadCategoriesTemplate(): void {
    const rows = [
      ['categoria', 'programa', 'nombre_programa', 'estado'],
      ['72', 'EECI', 'Especialidad en Enfermeria en Cuidados Intensivos', 'Activo'],
    ];
    const csvContent = rows
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\n');

    this.downloadTextFile(`${csvContent}\n`, 'plantilla-categorias-moodle.csv', 'text/csv;charset=utf-8;');
  }

  downloadTemplatesTemplate(): void {
    const rows = [
      ['nombre_corto_moodle', 'tipo', 'programa'],
      ['CURSO_DEMO_ESCOLARIZADO', 'Demo', ''],
      ['AX0101_PERTENENCIA_INSTITUCIONAL_Y_VALORES_UNIVERSITARIOS', 'Axiologica-Generica', ''],
      ['DGD01', 'Por programa', 'DIGRAF'],
    ];
    const csvContent = rows
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\n');

    this.downloadTextFile(`\uFEFF${csvContent}\n`, 'plantilla-plantillas-curso-moodle.csv', 'text/csv;charset=utf-8;');
  }

  importTemplatesCsv(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    void this.readCsvFile(file)
      .then((rows) => this.prepareTemplateCsvPreview(rows))
      .catch((error) => {
        this.templateCsvPreview = [];
        this.showCsvMessage(`No se pudo leer el CSV. ${this.errorMessage(error)}`, 'error');
      })
      .finally(() => {
        input.value = '';
      });
  }

  cancelTemplateCsvPreview(): void {
    this.templateCsvPreview = [];
    this.csvMessage = '';
  }

  templateCsvPreviewSample(): TemplateCsvPreviewRow[] {
    return this.templateCsvPreview.slice(0, 8);
  }

  async confirmTemplateCsvImport(): Promise<void> {
    if (!this.templateCsvPreview.length) {
      return;
    }

    const payloads = this.templateCsvPreview.map(({ rowNumber: _rowNumber, ...payload }) => payload);

    try {
      await this.templatesRepository.importTemplates(payloads);
      const firstTemplateType = payloads[0]?.modality;

      if (firstTemplateType) {
        this.activeTemplateType.set(this.templateTypeLabel(firstTemplateType));
      }

      this.templateCurrentPage.set(1);
      this.templateCsvPreview = [];
      this.showCsvMessage(`Se cargaron ${payloads.length} plantilla(s) Moodle.`, 'success');
    } catch (error) {
      this.showCsvMessage(`No se pudo cargar el CSV. ${this.errorMessage(error)}`, 'error');
    }
  }

  updateBatchSearch(value: string): void {
    this.batchSearch.set(value);
  }

  updateBatchStatus(value: string): void {
    this.batchStatus.set(value as AssignmentStatus | 'TODOS');
  }

  updateTemplateSelection(assignmentId: string, templateId: string): void {
    this.templateSelections[assignmentId] = templateId;
  }

  isAssignmentSelected(assignmentId: string): boolean {
    return this.selectedAssignments().includes(assignmentId);
  }

  async toggleAssignment(assignmentId: string): Promise<void> {
    const current = this.selectedAssignments();

    if (current.includes(assignmentId)) {
      this.selectedAssignments.set(current.filter((id) => id !== assignmentId));
      return;
    }

    const assignment = this.moodleAssignments().find((item) => item.id === assignmentId);

    if (!assignment) {
      this.showMessage('No se encontro la asignacion seleccionada.', 'error');
      return;
    }

    const selectedIds = await this.sendAssignmentsToReview([assignment]);

    if (selectedIds.includes(assignmentId)) {
      this.selectedAssignments.set([...current, assignmentId]);
    }
  }

  async toggleVisibleAssignments(): Promise<void> {
    const visibleAssignments = this.moodleAssignments();
    const visibleIds = visibleAssignments.map((assignment) => assignment.id);
    const current = this.selectedAssignments();
    const hasAllVisible = visibleIds.every((id) => current.includes(id));

    if (hasAllVisible) {
      this.selectedAssignments.set(current.filter((id) => !visibleIds.includes(id)));
      return;
    }

    const assignmentsToSelect = visibleAssignments.filter((assignment) => !current.includes(assignment.id));
    const selectedIds = await this.sendAssignmentsToReview(assignmentsToSelect);
    this.selectedAssignments.set(Array.from(new Set([...current, ...selectedIds])));
  }

  exportSelectedCsv(): void {
    const selectedRows = this.moodleAssignments().filter((assignment) => this.isAssignmentSelected(assignment.id));

    if (!selectedRows.length) {
      this.showMessage('Selecciona al menos una asignacion para generar el CSV.', 'error');
      return;
    }

    const missingConfig = selectedRows.filter((assignment) => {
      return !this.categoryForAssignment(assignment) || !this.templateForAssignment(assignment);
    });

    if (missingConfig.length) {
      this.showMessage('Hay asignaciones seleccionadas sin categoria o plantilla Moodle.', 'error');
      return;
    }

    const csvRows = [
      ['shortname', 'fullname', 'category', 'templatecourse'],
      ...selectedRows.map((assignment) => {
        const template = this.templateForAssignment(assignment);

        return [
          this.moodleShortname(assignment),
          this.moodleFullname(assignment),
          this.categoryForAssignment(assignment)?.categoryNumber ?? '',
          template?.templateCourse ?? '',
        ];
      }),
    ];
    const csvContent = csvRows
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\n');

    this.downloadTextFile(`\uFEFF${csvContent}\n`, `moodle-cursos-${this.activeCycleCode()}.csv`, 'text/csv;charset=utf-8;');
    this.showMessage('CSV Moodle generado correctamente.', 'success');
  }

  exportGroupEnrollmentCsv(): void {
    const loadedRows = this.loadedMoodleAssignments();

    if (!loadedRows.length) {
      this.showMessage('No hay asignaciones cargadas en Moodle para generar matriculacion por grupo.', 'error');
      return;
    }

    const csvRows = [['shortname', 'enrolment_1', 'enrolment_1_cohortidnumber', 'enrolment_1_role']];

    loadedRows.forEach((assignment) => {
      const courseShortname = this.moodleShortname(assignment);

      this.moodleGroupEnrollmentTargets(assignment).forEach((target) => {
        csvRows.push([courseShortname, 'cohort', target, 'student']);
      });
    });

    if (csvRows.length === 1) {
      this.showMessage('Las asignaciones cargadas no tienen grupos para matricular.', 'error');
      return;
    }

    const csvContent = csvRows
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\n');

    this.downloadTextFile(`\uFEFF${csvContent}\n`, `moodle-matriculacion-grupos-${this.activeCycleCode()}.csv`, 'text/csv;charset=utf-8;');
    this.showMessage('CSV de matriculacion por grupos generado correctamente.', 'success');
  }

  exportStudentEnrollmentCsv(): void {
    const loadedRows = this.loadedMoodleAssignments();

    if (!loadedRows.length) {
      this.showMessage('No hay asignaciones cargadas en Moodle para generar matriculacion individual.', 'error');
      return;
    }

    const csvRows = [['username', 'course1', 'role1']];

    loadedRows.forEach((assignment) => {
      const courseShortname = this.moodleShortname(assignment);
      const teacherUsername = this.moodleTeacherEnrollmentTarget(assignment);

      this.moodleStudentEnrollmentTargets(assignment).forEach((studentUsername) => {
        csvRows.push([studentUsername, courseShortname, 'student']);
      });

      if (teacherUsername) {
        csvRows.push([teacherUsername, courseShortname, 'editingteacher']);
      }
    });

    if (csvRows.length === 1) {
      this.showMessage('Las asignaciones cargadas no tienen matriculas ni docentes para matricular.', 'error');
      return;
    }

    const csvContent = csvRows
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\n');

    this.downloadTextFile(`\uFEFF${csvContent}\n`, `moodle-matriculacion-individual-${this.activeCycleCode()}.csv`, 'text/csv;charset=utf-8;');
    this.showMessage('CSV de matriculacion individual generado correctamente.', 'success');
  }

  async updateAssignmentStatus(assignment: AcademicAssignment, status: AssignmentStatus): Promise<void> {
    const actor = this.actorData();

    if (!actor || !this.canManageMoodle()) {
      this.showMessage('No tienes permisos para actualizar estados Moodle.', 'error');
      return;
    }

    try {
      await this.assignmentsRepository.updateAssignmentStatus(assignment.id, {
        status,
        updatedBy: actor.uid,
        updatedByName: actor.name,
        updatedByRole: actor.role,
      });
      await this.refreshAssignmentsAfterStatusUpdate();
      this.showMessage('Estado de asignacion actualizado correctamente.', 'success');
    } catch (error) {
      this.showMessage(`No se pudo actualizar el estado. ${this.errorMessage(error)}`, 'error');
    }
  }

  async markReviewedBatchAsLoaded(): Promise<void> {
    const actor = this.actorData();

    if (!actor || !this.canManageMoodle()) {
      this.showMessage('No tienes permisos para actualizar estados Moodle.', 'error');
      return;
    }

    const reviewedAssignments = this.moodleAssignments()
      .filter((assignment) => assignment.status === 'EN_REVISION');

    if (!reviewedAssignments.length) {
      this.showMessage('No hay asignaciones En revision en esta vista para marcar como cargadas.', 'error');
      return;
    }

    const results = await Promise.allSettled(
      reviewedAssignments.map((assignment) => this.assignmentsRepository.updateAssignmentStatus(assignment.id, {
        status: 'CARGADO_MOODLE',
        updatedBy: actor.uid,
        updatedByName: actor.name,
        updatedByRole: actor.role,
      })),
    );

    const loadedIds = new Set<string>();
    let failedUpdates = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        loadedIds.add(reviewedAssignments[index].id);
      } else {
        failedUpdates += 1;
      }
    });

    if (loadedIds.size) {
      this.selectedAssignments.update((current) => current.filter((id) => !loadedIds.has(id)));
      await this.refreshAssignmentsAfterStatusUpdate();
    }

    if (failedUpdates) {
      this.showMessage(
        loadedIds.size
          ? `${loadedIds.size} asignacion(es) se marcaron como Cargado en Moodle; ${failedUpdates} no se pudieron actualizar.`
          : 'No se pudo actualizar el lote a Cargado en Moodle.',
        'error',
      );
      return;
    }

    this.showMessage(
      reviewedAssignments.length === 1
        ? 'La asignacion se marco como Cargado en Moodle.'
        : `${reviewedAssignments.length} asignaciones se marcaron como Cargado en Moodle.`,
      'success',
    );
  }

  private async sendAssignmentsToReview(assignments: AcademicAssignment[]): Promise<string[]> {
    const actor = this.actorData();

    if (!actor || !this.canManageMoodle()) {
      this.showMessage('No tienes permisos para enviar asignaciones a revision.', 'error');
      return [];
    }

    const assignmentsInCapture = assignments.filter((assignment) => assignment.status === 'EN_CAPTURA');

    if (!assignmentsInCapture.length) {
      return assignments.map((assignment) => assignment.id);
    }

    const results = await Promise.allSettled(
      assignmentsInCapture.map((assignment) => this.assignmentsRepository.updateAssignmentStatus(assignment.id, {
        status: 'EN_REVISION',
        updatedBy: actor.uid,
        updatedByName: actor.name,
        updatedByRole: actor.role,
      })),
    );

    const confirmedIds = new Set(
      assignments.filter((assignment) => assignment.status !== 'EN_CAPTURA').map((assignment) => assignment.id),
    );
    let failedUpdates = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        confirmedIds.add(assignmentsInCapture[index].id);
      } else {
        failedUpdates += 1;
      }
    });

    const updatedCount = assignmentsInCapture.length - failedUpdates;

    if (updatedCount) {
      await this.refreshAssignmentsAfterStatusUpdate();
    }

    if (failedUpdates) {
      this.showMessage(
        updatedCount
          ? `${updatedCount} asignacion(es) pasaron a En revision; ${failedUpdates} no se pudieron actualizar.`
          : 'No se pudo actualizar el estado de las asignaciones seleccionadas.',
        'error',
      );
    } else if (updatedCount) {
      this.showMessage(
        updatedCount === 1
          ? 'La asignacion seleccionada paso a En revision.'
          : `${updatedCount} asignaciones seleccionadas pasaron a En revision.`,
        'success',
      );
    }

    return Array.from(confirmedIds);
  }

  private async refreshAssignmentsAfterStatusUpdate(): Promise<void> {
    try {
      await this.assignmentsRepository.refreshFromServer();
    } catch (error) {
      console.warn('La asignacion se actualizo, pero no se pudo refrescar la vista Moodle.', error);
    }
  }

  categoryForAssignment(assignment: AcademicAssignment): MoodleCategory | null {
    const candidatePrograms = this.categoryProgramCandidatesForAssignment(assignment);

    return candidatePrograms
      .map((programCode) => this.categories().find((category) =>
        category.status === 'Activo'
          && this.normalizeCategoryProgramAlias(category.programCode) === programCode,
      ) ?? null)
      .find((category): category is MoodleCategory => category !== null) ?? null;
  }

  categoryProgramDisplay(category: MoodleCategory): string {
    return this.normalizeCategoryProgramAlias(category.programCode);
  }

  templateForAssignment(assignment: AcademicAssignment): MoodleCourseTemplate | null {
    const selectedId = this.templateSelections[assignment.id];
    const selectedTemplate = selectedId
      ? this.templates().find((template) => template.id === selectedId)
      : null;
    const automaticTemplate = this.automaticTemplateForAssignment(assignment);

    return selectedTemplate
      ?? automaticTemplate
      ?? this.fallbackProgramTemplateForAssignment(assignment);
  }

  private requiresStrictCodeTemplate(assignment: AcademicAssignment): boolean {
    return this.isPlan2027Assignment(assignment) || this.isPsychologyAssignment(assignment);
  }

  private fallbackProgramTemplateForAssignment(assignment: AcademicAssignment): MoodleCourseTemplate | null {
    return this.requiresStrictCodeTemplate(assignment)
      ? null
      : this.activeTemplates().find((template) => template.programCode === assignment.program) ?? null;
  }

  automaticTemplateForDisplay(assignment: AcademicAssignment): MoodleCourseTemplate | null {
    return this.templateSelections[assignment.id]
      ? null
      : this.automaticTemplateForAssignment(assignment);
  }

  requiresPlan2027SubjectCode(assignment: AcademicAssignment): boolean {
    return this.isPlan2027Assignment(assignment) && !this.subjectStartsWithOperationalCode(assignment.subjectName);
  }

  isProgramTemplate(type: string): boolean {
    return this.normalizeSearchText(type) === 'por programa'
      || this.normalizeSearchText(type) === 'programa';
  }

  templateTypeLabel(type: string): string {
    const normalized = this.normalizeSearchText(type);
    const labels: Record<string, string> = {
      axiologica: 'Axiologica-Generica',
      'axiologica-generica': 'Axiologica-Generica',
      'axiologica generica': 'Axiologica-Generica',
      'axiologica-transversales': 'Axiologica-Transversales',
      'axiologica transversales': 'Axiologica-Transversales',
      demo: 'Demo',
      transversal: 'Transversal',
      generica: 'Generica',
      propedeutico: 'Propedeutico',
      'fusionadas de maestria': 'Fusionadas de Maestria',
      'fusionadas-de-maestria': 'Fusionadas de Maestria',
      'profesionalizantes compartidas': 'Profesionalizantes Compartidas',
      'profesionalizantes-compartidas': 'Profesionalizantes Compartidas',
      programa: 'Por programa',
      'por programa': 'Por programa',
    };

    return labels[normalized] ?? (type || 'General');
  }

  templateTypeClass(type: string): string {
    const normalized = this.normalizeSearchText(type);

    if (normalized.includes('axiologica') && normalized.includes('transversales')) {
      return 'type-axiologica-transversales';
    }

    if (normalized.includes('axiologica')) {
      return 'type-axiologica-generica';
    }

    if (normalized === 'demo') {
      return 'type-demo';
    }

    if (normalized === 'transversal') {
      return 'type-transversal';
    }

    if (normalized === 'propedeutico') {
      return 'type-propedeutico';
    }

    if (normalized === 'fusionadas de maestria' || normalized === 'fusionadas-de-maestria') {
      return 'type-fusionadas-maestria';
    }

    if (normalized === 'profesionalizantes compartidas' || normalized === 'profesionalizantes-compartidas') {
      return 'type-profesionalizantes-compartidas';
    }

    if (this.isProgramTemplate(type)) {
      return 'type-programa';
    }

    return 'type-generica';
  }

  assignmentTemplateType(assignment: AcademicAssignment): string {
    const template = this.templateForAssignment(assignment);

    return template ? this.templateTypeLabel(template.modality) : 'Sin plantilla';
  }

  displayGroup(assignment: AcademicAssignment): string {
    if (assignment.special && assignment.studentEnrollments) {
      return 'Sin grupo base';
    }

    return assignment.group || 'Sin grupo base';
  }

  statusLabel(status: AssignmentStatus): string {
    const labels: Record<AssignmentStatus, string> = {
      EN_CAPTURA: 'En captura',
      EN_REVISION: 'En revision',
      CARGADO_MOODLE: 'Cargado en Moodle',
      VALIDADO: 'Cargado en Moodle',
      CON_OBSERVACION: 'En revision',
    };

    return labels[status];
  }

  statusSelectClass(status: AssignmentStatus): string {
    if (status === 'CARGADO_MOODLE' || status === 'VALIDADO') {
      return 'status-loaded';
    }

    if (status === 'EN_REVISION' || status === 'CON_OBSERVACION') {
      return 'status-review';
    }

    return 'status-capture';
  }

  batchStatusSelectClass(): string {
    const status = this.batchStatus();
    return status === 'TODOS' ? 'status-all' : this.statusSelectClass(status);
  }

  private isLoadedInMoodle(assignment: AcademicAssignment): boolean {
    return assignment.status === 'CARGADO_MOODLE' || assignment.status === 'VALIDADO';
  }

  private assignmentMatchesStatusGroup(assignment: AcademicAssignment, status: AssignmentStatus): boolean {
    if (status === 'CARGADO_MOODLE') {
      return this.isLoadedInMoodle(assignment);
    }

    if (status === 'EN_REVISION') {
      return assignment.status === 'EN_REVISION' || assignment.status === 'CON_OBSERVACION';
    }

    return assignment.status === 'EN_CAPTURA';
  }

  private assignmentMatchesActiveBatchView(assignment: AcademicAssignment): boolean {
    if (this.batchViewMode() === 'plantilla') {
      const activeType = this.resolvedBatchTemplateType();
      return !activeType || this.assignmentTemplateType(assignment) === activeType;
    }

    return this.assignmentBatchMode(assignment) === this.activeBatchMode();
  }

  private automaticTemplateForAssignment(assignment: AcademicAssignment): MoodleCourseTemplate | null {
    if (this.isPsychologyAssignment(assignment)) {
      return this.findActiveTemplateByPsychologySubjectCode(assignment.subjectName);
    }

    if (this.isPlan2027Assignment(assignment)) {
      return this.findActiveTemplateByInitialSubjectCode(assignment.subjectName);
    }

    const templateBySubjectCode = this.findActiveTemplateBySubjectCode(assignment.subjectName);

    if (templateBySubjectCode) {
      return templateBySubjectCode;
    }

    const batchMode = this.assignmentBatchMode(assignment);

    const shouldMatchTemplateByInitialCode = batchMode === 'Posgrados'
      || this.requiresTemplateByInitialCodeProgramRule(assignment);

    const templateByProgramSubjectCode = shouldMatchTemplateByInitialCode
      ? this.findActiveTemplateByInitialSubjectCode(assignment.subjectName, { allowPrefix: true })
      : null;

    if (templateByProgramSubjectCode) {
      return templateByProgramSubjectCode;
    }

    const shouldMatchTemplateBySubjectName = batchMode === 'Ejecutivo'
      || batchMode === 'Virtual'
      || batchMode === 'Posgrados'
      || batchMode === 'Especiales'
      || this.isNursingHealthBaseGroup(assignment)
      || this.isNutritionHealthBaseGroup(assignment)
      || this.requiresTemplateBySubjectNameProgramRule(assignment);

    if (shouldMatchTemplateBySubjectName) {
      const templateBySubjectName = this.findActiveTemplateBySubjectName(assignment.subjectName);

      if (templateBySubjectName) {
        return templateBySubjectName;
      }
    }

    if (this.shouldUseSpecialArchitectureDemoTemplate(assignment, batchMode)) {
      return this.findActiveTemplateByCourse('CURSO_DEMO_ESCOLARIZADO');
    }

    const templateCourse = this.isNursingHealthBaseGroup(assignment)
      ? NURSING_HEALTH_TEMPLATE
      : this.isNutritionHealthBaseGroup(assignment)
        ? NUTRITION_HEALTH_TEMPLATE
      : DEFAULT_TEMPLATE_BY_MODE[batchMode];

    if (!templateCourse) {
      return null;
    }

    return this.findActiveTemplateByCourse(templateCourse);
  }

  private findActiveTemplateBySubjectCode(subjectName: string): MoodleCourseTemplate | null {
    const subjectCode = this.extractAxiologicalCode(subjectName);

    if (!subjectCode) {
      return null;
    }

    return this.activeTemplates().find((template) =>
      this.extractAxiologicalCode(template.templateCourse) === subjectCode
      || this.extractAxiologicalCode(template.name) === subjectCode,
    ) ?? null;
  }

  private findActiveTemplateByInitialSubjectCode(
    subjectName: string,
    options: { allowPrefix?: boolean } = {},
  ): MoodleCourseTemplate | null {
    const subjectCode = this.extractInitialOperationalCode(subjectName);

    if (!subjectCode) {
      return null;
    }

    const templatesWithCode = this.activeTemplates().map((template) => ({
      template,
      code: this.extractInitialOperationalCode(template.templateCourse)
        || this.extractInitialOperationalCode(template.name),
    })).filter((entry) => entry.code);
    const exactMatch = templatesWithCode.find((entry) => entry.code === subjectCode);

    if (exactMatch || !options.allowPrefix) {
      return exactMatch?.template ?? null;
    }

    return templatesWithCode
      .filter((entry) => subjectCode.startsWith(entry.code) && entry.code.length < subjectCode.length)
      .sort((current, next) => next.code.length - current.code.length)[0]?.template ?? null;
  }

  private findActiveTemplateByPsychologySubjectCode(subjectName: string): MoodleCourseTemplate | null {
    const subjectCode = this.extractPsychologyTemplateCode(subjectName);

    if (!subjectCode) {
      return null;
    }

    return this.activeTemplates().find((template) =>
      this.extractInitialOperationalCode(template.templateCourse) === subjectCode
      || this.extractInitialOperationalCode(template.name) === subjectCode,
    ) ?? null;
  }

  private findActiveTemplateBySubjectName(subjectName: string): MoodleCourseTemplate | null {
    const subjectKey = this.normalizeCourseComparableKey(subjectName);

    if (!subjectKey) {
      return null;
    }

    return this.activeTemplates().find((template) =>
      this.normalizeCourseComparableKey(template.templateCourse) === subjectKey
      || this.normalizeCourseComparableKey(template.name) === subjectKey,
    ) ?? null;
  }

  private findActiveTemplateByCourse(templateCourse: string): MoodleCourseTemplate | null {
    const targetKey = this.normalizeTemplateCourseKey(templateCourse);

    return this.activeTemplates().find((template) =>
      this.normalizeTemplateCourseKey(template.templateCourse) === targetKey
      || this.normalizeTemplateCourseKey(template.name) === targetKey,
    ) ?? null;
  }

  private assignmentBatchMode(assignment: AcademicAssignment): MoodleBatchMode {
    if (this.isEnglishAssignment(assignment)) {
      return 'Inglés';
    }

    if (assignment.special || assignment.assignmentType === 'ESPECIAL' || assignment.assignmentType === 'CURSO_ESPECIAL') {
      return 'Especiales';
    }

    const program = this.nomenclatureForProgram(assignment.program);
    const normalizedGroup = this.normalizeSearchText(assignment.group);
    const normalizedProgram = this.normalizeSearchText([
      assignment.program,
      assignment.subjectName,
      program?.programName,
      program?.planName,
      program?.notes,
    ].join(' '));

    if (!normalizedGroup || normalizedGroup.endsWith('c.a') || normalizedGroup.endsWith('c a')) {
      return 'Especiales';
    }

    if (this.isHealthProgramCode(assignment.program) || this.referencesHealthFaculty(normalizedProgram)) {
      return 'Salud';
    }

    if (POSTGRADUATE_TEXT_MARKERS.some((marker) => normalizedProgram.includes(marker))) {
      return this.referencesHealthFaculty(normalizedProgram) ? 'Salud' : 'Posgrados';
    }

    const groupCode = this.assignmentGroupCode(assignment.group);

    if (groupCode === '53') {
      return 'Virtual';
    }

    if (groupCode === '23' || groupCode === '24') {
      return 'Ejecutivo';
    }

    return 'Escolarizado';
  }

  private isEnglishAssignment(assignment: AcademicAssignment): boolean {
    const program = this.nomenclatureForProgram(assignment.program);
    const searchText = this.normalizeSearchText([
      assignment.program,
      assignment.subjectName,
      program?.programName,
      program?.notes,
    ].join(' '));

    return this.isEnglishProgramCode(assignment.program) || this.referencesEnglishProgram(searchText);
  }

  private isHealthProgramCode(programCode: string): boolean {
    return HEALTH_PROGRAM_CODES.has(programCode.trim().toUpperCase());
  }

  private isNursingHealthBaseGroup(assignment: AcademicAssignment): boolean {
    return /\bENF\s+(11|12)\b/i.test(assignment.group);
  }

  private isNutritionHealthBaseGroup(assignment: AcademicAssignment): boolean {
    return /\bNUT\s+(11|12)\b/i.test(assignment.group);
  }

  private requiresTemplateBySubjectNameProgramRule(assignment: AcademicAssignment): boolean {
    return this.assignmentProgramCandidates(assignment).some((programCode) =>
      TEMPLATE_BY_SUBJECT_NAME_PROGRAM_CODES.has((programCode ?? '').trim().toUpperCase()),
    );
  }

  private requiresTemplateByInitialCodeProgramRule(assignment: AcademicAssignment): boolean {
    return this.assignmentProgramCandidates(assignment).some((programCode) =>
      TEMPLATE_BY_INITIAL_CODE_PROGRAM_CODES.has((programCode ?? '').trim().toUpperCase()),
    );
  }

  private shouldUseSpecialArchitectureDemoTemplate(
    assignment: AcademicAssignment,
    batchMode: MoodleBatchMode,
  ): boolean {
    return batchMode === 'Especiales'
      && this.assignmentProgramCandidates(assignment).some((programCode) =>
        SPECIAL_ARCHITECTURE_DEMO_PROGRAM_CODES.has((programCode ?? '').trim().toUpperCase()),
      );
  }

  private assignmentProgramCandidates(assignment: AcademicAssignment): Array<string | undefined> {
    const nomenclature = this.nomenclatureForAssignment(assignment);

    return [
      assignment.program,
      this.assignmentGroupProgramCode(assignment.group),
      nomenclature?.abbreviation,
      nomenclature?.programCode,
    ];
  }

  private isPsychologyAssignment(assignment: AcademicAssignment): boolean {
    const nomenclature = this.nomenclatureForAssignment(assignment);
    const searchText = this.normalizeSearchText([
      assignment.program,
      assignment.group,
      nomenclature?.programName,
      nomenclature?.notes,
    ].join(' '));

    return assignment.program.trim().toUpperCase() === 'PSIC'
      || /\bPSIC\b/.test(assignment.group.trim().toUpperCase())
      || searchText.includes('psicologia');
  }

  private isPlan2027Assignment(assignment: AcademicAssignment): boolean {
    const nomenclature = this.nomenclatureForAssignment(assignment);
    const searchText = this.normalizeSearchText([
      assignment.program,
      assignment.group,
      nomenclature?.planName,
      nomenclature?.planCode,
      nomenclature?.notes,
    ].join(' '));

    return /\b2027\b/.test(searchText);
  }

  private subjectStartsWithOperationalCode(subjectName: string): boolean {
    const normalizedSubject = subjectName.trim().toUpperCase();

    return /^[A-ZÑ]{2,12}\d{2,4}(?=\s|[-_]|$)/.test(normalizedSubject);
  }

  private isEnglishProgramCode(programCode: string): boolean {
    return ENGLISH_PROGRAM_CODES.has(programCode.trim().toUpperCase());
  }

  private referencesHealthFaculty(value: string): boolean {
    const normalizedValue = this.normalizeSearchText(value);

    return HEALTH_TEXT_MARKERS.some((marker) => normalizedValue.includes(marker));
  }

  private referencesEnglishProgram(value: string): boolean {
    const normalizedValue = this.normalizeSearchText(value);

    return ENGLISH_TEXT_MARKERS.some((marker) => normalizedValue.includes(marker));
  }

  private nomenclatureForProgram(programCode: string) {
    const normalizedProgram = programCode.trim().toUpperCase();

    return this.nomenclatures().find((nomenclature) =>
      nomenclature.abbreviation.trim().toUpperCase() === normalizedProgram
      || nomenclature.programCode.trim().toUpperCase() === normalizedProgram,
    );
  }

  private nomenclatureForAssignment(assignment: AcademicAssignment) {
    return this.nomenclatureForProgram(assignment.program)
      ?? this.nomenclatureForProgram(this.assignmentGroupProgramCode(assignment.group));
  }

  private categoryProgramCandidatesForAssignment(assignment: AcademicAssignment): string[] {
    const programs = [
      this.assignmentGroupProgramCode(assignment.group),
      assignment.program,
    ];

    if (this.isEnglishAssignment(assignment)) {
      programs.push('ING');
    }

    return Array.from(new Set(
      programs
        .map((programCode) => this.normalizeCategoryProgramAlias(programCode))
        .filter(Boolean),
    ));
  }

  private assignmentGroupProgramCode(group: string): string {
    const normalizedGroup = group.trim().toUpperCase();
    const flexibleMatch = normalizedGroup.match(/^\S+\s+([A-Z-]+)\s+\S+/);

    if (flexibleMatch?.[1]) {
      return flexibleMatch[1];
    }

    const match = group.trim().toUpperCase().match(/^\S+\s+([A-ZÑ-]+)\s+\d{2}\b/);

    return match?.[1] ?? '';
  }

  private assignmentGroupCode(group: string): string {
    const match = group.trim().toUpperCase().match(/\s(11|12|23|24|53)\s/);

    return match?.[1] ?? '';
  }

  private async saveCategoryRows(rows: string[][]): Promise<void> {
    const actor = this.actorData();

    if (!actor || !this.canManageMoodle()) {
      this.showCsvMessage('No tienes permisos para cargar categorias Moodle.', 'error');
      return;
    }

    const headers = this.csvHeaderIndex(rows[0] ?? []);
    const payloads = rows.slice(1).flatMap((row): UpsertMoodleCategoryPayload[] => {
      const categoryNumber = this.csvValue(row, headers, ['categoria', 'category', 'categoryNumber', 'numero_categoria']);
      const programCode = this.csvValue(row, headers, ['programa', 'programCode', 'abreviatura']);
      const programName = this.csvValue(row, headers, ['nombre_programa', 'programName', 'licenciatura', 'carrera']);
      const statusText = this.csvValue(row, headers, ['estado', 'status', 'activo']);

      if (!categoryNumber && !programCode && !programName) {
        return [];
      }

      if (!categoryNumber || !programCode) {
        return [];
      }

      return [{
        categoryNumber,
        programCode,
        programName: programName || programCode,
        status: this.parseStatus(statusText),
        createdBy: actor.uid,
        createdByName: actor.name,
        createdByRole: actor.role,
      }];
    });

    if (!payloads.length) {
      this.showCsvMessage('El CSV no contiene categorias validas.', 'error');
      return;
    }

    try {
      await this.categoriesRepository.importCategories(payloads);
      this.showCsvMessage(`Se cargaron ${payloads.length} categoria(s) Moodle.`, 'success');
    } catch (error) {
      this.showCsvMessage(`No se pudo cargar el CSV. ${this.errorMessage(error)}`, 'error');
    }
  }

  private prepareTemplateCsvPreview(rows: string[][]): void {
    const actor = this.actorData();

    if (!actor || !this.canManageMoodle()) {
      this.showCsvMessage('No tienes permisos para cargar plantillas Moodle.', 'error');
      return;
    }

    const payloads = this.templatePayloadsFromRows(rows, actor);

    if (!payloads.length) {
      this.templateCsvPreview = [];
      this.showCsvMessage('El CSV no contiene plantillas validas. Revisa que tenga nombre_corto_moodle, tipo y programa.', 'error');
      return;
    }

    this.templateCsvPreview = payloads;
    this.showCsvMessage(`Vista previa lista: ${payloads.length} plantilla(s) detectada(s).`, 'success');
  }

  private templatePayloadsFromRows(rows: string[][], actor: ActorData): TemplateCsvPreviewRow[] {
    const headers = this.csvHeaderIndex(rows[0] ?? []);
    return rows.slice(1).flatMap((row, index): TemplateCsvPreviewRow[] => {
      const templateCourse = this.csvValue(row, headers, ['nombre_corto_moodle', 'nombre_corto', 'shortname', 'templatecourse', 'template_course', 'plantilla']);
      const name = this.csvValue(row, headers, ['nombre', 'name', 'nombre_plantilla']);
      const modality = this.csvValue(row, headers, ['tipo', 'modalidad', 'modality']);
      const programCode = this.csvValue(row, headers, ['programa', 'programCode', 'abreviatura']);
      const statusText = this.csvValue(row, headers, ['estado', 'status', 'activo']);

      if (!templateCourse && !name && !modality && !programCode) {
        return [];
      }

      if (!templateCourse || !modality) {
        return [];
      }

      return [{
        rowNumber: index + 2,
        templateCourse,
        name: name || templateCourse,
        modality: this.normalizeTemplateType(modality),
        programCode,
        status: this.parseStatus(statusText),
        createdBy: actor.uid,
        createdByName: actor.name,
        createdByRole: actor.role,
      }];
    });
  }

  private readCsvFile(file: File): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(this.parseCsv(String(reader.result ?? '')));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo CSV.'));
      reader.readAsText(file, 'utf-8');
    });
  }

  private parseCsv(content: string): string[][] {
    const lines = content
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const delimiter = this.detectCsvDelimiter(lines[0] ?? '');

    return lines.map((line) => this.parseCsvLine(line, delimiter));
  }

  private detectCsvDelimiter(line: string): ',' | ';' {
    return this.countCsvDelimiter(line, ';') > this.countCsvDelimiter(line, ',') ? ';' : ',';
  }

  private countCsvDelimiter(line: string, delimiter: ',' | ';'): number {
    let count = 0;
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"' && insideQuotes && nextChar === '"') {
        index += 1;
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === delimiter && !insideQuotes) {
        count += 1;
      }
    }

    return count;
  }

  private parseCsvLine(line: string, delimiter: ',' | ';' = ','): string[] {
    const values: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"' && insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === delimiter && !insideQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  private csvHeaderIndex(headers: string[]): Map<string, number> {
    return new Map(headers.map((header, index) => [this.normalizeCsvHeader(header), index]));
  }

  private csvValue(row: string[], headers: Map<string, number>, aliases: string[]): string {
    const foundAlias = aliases
      .map((alias) => this.normalizeCsvHeader(alias))
      .find((alias) => headers.has(alias));

    if (!foundAlias) {
      return '';
    }

    return row[headers.get(foundAlias) ?? -1]?.trim() ?? '';
  }

  private normalizeCsvHeader(value: string): string {
    return this.normalizeSearchText(value).replace(/\s+/g, '_');
  }

  private parseStatus(value: string): MoodleCatalogStatus {
    const normalized = this.normalizeSearchText(value);

    return normalized === 'no' || normalized === 'inactivo' || normalized === '0'
      ? 'Inactivo'
      : 'Activo';
  }

  private normalizeTemplateType(value: string): string {
    const normalized = this.normalizeSearchText(value);

    if (normalized === 'axiologica' || normalized === 'axiologica-generica' || normalized === 'axiologica generica') {
      return 'Axiologica-Generica';
    }

    if (normalized === 'axiologica-transversales' || normalized === 'axiologica transversales') {
      return 'Axiologica-Transversales';
    }

    if (normalized === 'demo') {
      return 'Demo';
    }

    if (normalized === 'transversal') {
      return 'Transversal';
    }

    if (normalized === 'propedeutico') {
      return 'Propedeutico';
    }

    if (normalized === 'fusionadas de maestria' || normalized === 'fusionadas-de-maestria') {
      return 'Fusionadas de Maestria';
    }

    if (normalized === 'profesionalizantes compartidas' || normalized === 'profesionalizantes-compartidas') {
      return 'Profesionalizantes Compartidas';
    }

    if (normalized === 'programa' || normalized === 'por programa') {
      return 'Por programa';
    }

    return 'Generica';
  }

  private actorData(): ActorData | null {
    const currentSession = this.session();
    const appUser = currentSession?.appUser;

    if (!currentSession || !appUser) {
      return null;
    }

    return {
      uid: currentSession.authUid,
      name: appUser.name,
      role: appUser.role,
    };
  }

  private moodleShortname(assignment: AcademicAssignment): string {
    return this.moodleFullname(assignment).replace(/\s+/g, '_');
  }

  private moodleFullname(assignment: AcademicAssignment): string {
    const subjectName = this.subjectNameWithoutInitialCode(assignment.subjectName);
    const courseName = `${assignment.moodleId} ${subjectName} ${assignment.cycle}`;

    return this.usesTitleCaseForMoodleCourse(assignment)
      ? this.toMoodleCourseTitle(courseName)
      : this.normalizeMoodleCourseText(courseName);
  }

  private subjectNameWithoutInitialCode(value: string): string {
    return this.normalizeMoodleCourseText(value)
      .replace(/^(?:AX|PSIC|[A-Z]{2,12})\d{2,4}\s*(?:[-–—:]\s*)?/, '')
      .trim();
  }

  private normalizeMoodleCourseText(value: string): string {
    return value
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
  }

  private toMoodleCourseTitle(value: string): string {
    return this.normalizeMoodleCourseText(value)
      .toLocaleLowerCase('es-MX')
      .replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_match, prefix: string, letter: string) =>
        `${prefix}${letter.toLocaleUpperCase('es-MX')}`,
      );
  }

  private usesTitleCaseForMoodleCourse(assignment: AcademicAssignment): boolean {
    const mode = this.assignmentBatchMode(assignment);

    return mode === 'Ejecutivo'
      || mode === 'Virtual'
      || mode === 'Especiales'
      || mode === 'Posgrados';
  }

  private currentInstitutionalUsername(): string {
    const email = this.session()?.email ?? this.session()?.appUser?.email ?? '';
    const [username] = email.split('@');

    return username.trim().toLowerCase();
  }

  private moodleGroupEnrollmentTargets(assignment: AcademicAssignment): string[] {
    const targets = [
      assignment.group,
      ...(assignment.sharedGroups ?? []),
    ];

    return Array.from(new Set(
      targets
        .map((target) => target.trim().toUpperCase())
        .filter(Boolean),
    ));
  }

  private moodleStudentEnrollmentTargets(assignment: AcademicAssignment): string[] {
    return Array.from(new Set(
      this.splitEnrollmentValues(assignment.studentEnrollments)
        .map((student) => this.normalizeStudentUsername(student))
        .filter(Boolean),
    ));
  }

  private moodleTeacherEnrollmentTarget(assignment: AcademicAssignment): string {
    const teacherUser = assignment.teacherMoodleUser.trim().toLowerCase();

    if (!teacherUser || teacherUser.includes('temporalmente')) {
      return '';
    }

    return teacherUser;
  }

  private normalizeStudentUsername(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/\s+/g, '');

    if (!normalized) {
      return '';
    }

    return normalized.startsWith('tup') ? normalized : `tup${normalized}`;
  }

  private splitEnrollmentValues(value: string): string[] {
    return value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizeForMoodle(value: string): string {
    return value
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private normalizeTemplateCourseKey(value: string): string {
    return this.normalizeForMoodle(value).replace(/[\s-]+/g, '_');
  }

  private normalizeCourseComparableKey(value: string): string {
    return this.normalizeForMoodle(value)
      .replace(/^\d+\s*[-_ ]+\s*/, '')
      .replace(/^(?:AX|PSIC|[A-Z]{2,12})\d{2,4}\s*[-_: ]+\s*/, '')
      .replace(/[^A-Z0-9]+/g, '');
  }

  private extractAxiologicalCode(value: string): string {
    return /^AX\d{3,4}(?=$|[^A-Z0-9])/.exec(this.normalizeForMoodle(value))?.[0] ?? '';
  }

  private extractInitialOperationalCode(value: string): string {
    return /^([A-Z]{2,12}\d{1,4})(?=$|[^A-Z0-9])/.exec(this.normalizeForMoodle(value))?.[1] ?? '';
  }

  private extractPsychologyTemplateCode(value: string): string {
    const match = /^PSIC(\d{2,4})(?=$|[^A-Z0-9])/.exec(this.normalizeForMoodle(value));

    if (!match) {
      return '';
    }

    return `PSIC${match[1].slice(-2)}`;
  }

  private normalizeSearchText(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private normalizeProgramCode(value: string): string {
    return value.trim().toUpperCase();
  }

  private findProgramOption(value: string): ProgramOption | null {
    const normalizedValue = this.normalizeSearchText(value);
    const normalizedCode = this.normalizeProgramCode(value.split('-')[0] ?? value);

    return this.programOptions().find((option) =>
      option.code === normalizedCode
      || this.normalizeSearchText(option.label) === normalizedValue
      || this.normalizeSearchText(option.code) === normalizedValue,
    ) ?? null;
  }

  private findTemplateProgramOption(value: string): ProgramOption | null {
    const normalizedValue = this.normalizeSearchText(value);
    const normalizedCode = this.normalizeProgramCode(value.split('-')[0] ?? value);

    return this.templateProgramOptions().find((option) =>
      option.code === normalizedCode
      || this.normalizeSearchText(option.label) === normalizedValue
      || this.normalizeSearchText(option.code) === normalizedValue,
    ) ?? null;
  }

  private programOptionLabel(code: string, name: string): string {
    const normalizedCode = this.normalizeCategoryProgramAlias(code);
    const option = this.programOptions().find((currentOption) => currentOption.code === normalizedCode);

    if (option) {
      return option.label;
    }

    return name.trim() ? `${normalizedCode} - ${name.trim()}` : normalizedCode;
  }

  private normalizeCategoryProgramAlias(programCode: string): string {
    const normalizedCode = this.normalizeProgramCode(programCode);

    return CATEGORY_PROGRAM_ALIASES[normalizedCode] ?? normalizedCode;
  }

  private escapeCsvValue(value: string): string {
    const escaped = value.replace(/"/g, '""');

    return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
  }

  private downloadTextFile(content: string, fileName: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  private emptyCategoryForm(): CategoryFormState {
    return {
      categoryNumber: '',
      programCode: '',
      programName: '',
      status: 'Activo',
    };
  }

  private emptyTemplateForm(): TemplateFormState {
    return {
      templateCourse: '',
      modality: 'Generica',
      programCode: '',
      status: 'Activo',
    };
  }

  private showMessage(message: string, type: 'success' | 'error'): void {
    this.formMessage = message;
    this.formMessageType = type;

    window.setTimeout(() => {
      if (this.formMessage === message) {
        this.formMessage = '';
      }
    }, 3500);
  }

  private showCsvMessage(message: string, type: 'success' | 'error'): void {
    this.csvMessage = message;
    this.csvMessageType = type;

    window.setTimeout(() => {
      if (this.csvMessage === message) {
        this.csvMessage = '';
      }
    }, 4500);
  }

  private dismissMessages(): void {
    this.formMessage = '';
    this.csvMessage = '';
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
