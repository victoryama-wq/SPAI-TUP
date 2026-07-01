import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
const CATEGORY_PAGE_SIZE_OPTIONS = [5, 10, 25];
const MOODLE_BATCH_MODES: MoodleBatchMode[] = ['Escolarizado', 'Ejecutivo', 'Virtual', 'Salud', 'Posgrados', 'Especiales', 'Inglés'];
const HEALTH_PROGRAM_CODES = new Set(['ENF', 'NUT', 'PSIC', 'EECI', 'EEQX', 'MADH']);
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

interface ProgramOption {
  code: string;
  name: string;
  label: string;
}

@Component({
  selector: 'spai-moodle-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './moodle-page.component.html',
  styleUrl: './moodle-page.component.css',
})
export class MoodlePageComponent {
  private readonly assignmentsRepository = inject(AssignmentsRepository);
  private readonly categoriesRepository = inject(MoodleCategoriesRepository);
  private readonly cyclesRepository = inject(CyclesRepository);
  private readonly nomenclaturesRepository = inject(NomenclaturesRepository);
  private readonly route = inject(ActivatedRoute);
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
  batchSearch = '';
  batchStatus: AssignmentStatus | 'TODOS' = 'TODOS';
  categoryProgramSearch = '';
  categoryProgramPickerOpen = false;
  categoryCurrentPage = 1;
  categoryPageSize = 5;
  readonly categoryPageSizeOptions = CATEGORY_PAGE_SIZE_OPTIONS;
  readonly batchModes = MOODLE_BATCH_MODES;
  readonly templateSelections: Record<string, string> = {};

  categoryForm: CategoryFormState = this.emptyCategoryForm();
  templateForm: TemplateFormState = this.emptyTemplateForm();

  readonly activeCycleCode = computed(() => this.activeCycle()?.code ?? 'Pendiente');

  readonly canManageMoodle = computed(() => {
    const appUser = this.session()?.appUser;

    return appUser?.status === 'Activo'
      && appUser.role.includes('Sistemas')
      && appUser.access?.moodle === true;
  });

  readonly visibleCategories = computed(() =>
    [...this.categories()].sort((first, second) =>
      first.programCode.localeCompare(second.programCode, 'es', { numeric: true }),
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

    return [...optionsByCode.values()].sort((first, second) =>
      first.code.localeCompare(second.code, 'es', { numeric: true }),
    );
  });

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

  readonly visibleTemplates = computed(() =>
    [...this.templates()].sort((first, second) =>
      first.modality.localeCompare(second.modality, 'es', { numeric: true })
      || first.templateCourse.localeCompare(second.templateCourse, 'es', { numeric: true }),
    ),
  );

  readonly activeTemplates = computed(() =>
    this.templates().filter((template) => template.status === 'Activo'),
  );

  readonly moodleAssignments = computed(() => {
    const activeCycle = this.activeCycle();

    if (!activeCycle) {
      return [];
    }

    const search = this.normalizeSearchText(this.batchSearch);

    return this.assignments()
      .filter((assignment) => assignment.cycle === activeCycle.code)
      .filter((assignment) => !assignment.sourceAssignmentId)
      .filter((assignment) => this.batchStatus === 'TODOS' || assignment.status === this.batchStatus)
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
  }

  closeModal(): void {
    this.activeModal = null;
    this.editingCategoryId = null;
    this.editingTemplateId = null;
    this.categoryProgramPickerOpen = false;
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

  selectCategoryPageSize(event: Event): void {
    this.categoryPageSize = Number((event.target as HTMLSelectElement).value) || 5;
    this.categoryCurrentPage = 1;
  }

  goToPreviousCategoryPage(): void {
    this.categoryCurrentPage = Math.max(1, this.currentCategorySafePage() - 1);
  }

  goToNextCategoryPage(): void {
    this.categoryCurrentPage = Math.min(this.totalCategoryPages(), this.currentCategorySafePage() + 1);
  }

  totalCategoryPages(): number {
    return Math.max(1, Math.ceil(this.visibleCategories().length / this.categoryPageSize));
  }

  currentCategorySafePage(): number {
    return Math.min(this.categoryCurrentPage, this.totalCategoryPages());
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

  closeCategoryProgramPickerSoon(): void {
    window.setTimeout(() => {
      this.categoryProgramPickerOpen = false;
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

    if (!this.categoryForm.categoryNumber.trim() || !programCode) {
      this.showMessage('Captura numero de categoria y programa.', 'error');
      return;
    }

    try {
      await this.categoriesRepository.upsertCategory({
        ...this.categoryForm,
        programCode,
        programName,
        status: 'Activo',
        ...actor,
        createdBy: actor.uid,
        createdByName: actor.name,
        createdByRole: actor.role,
      }, this.editingCategoryId);
      this.closeModal();
      this.showMessage('Categoria Moodle guardada correctamente.', 'success');
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

    if (this.isProgramTemplate(this.templateForm.modality) && !this.templateForm.programCode.trim()) {
      this.showMessage('Selecciona el programa al que pertenece la plantilla.', 'error');
      return;
    }

    try {
      await this.templatesRepository.upsertTemplate({
        ...this.templateForm,
        name: this.templateForm.templateCourse,
        modality: this.normalizeTemplateType(this.templateForm.modality),
        programCode: this.isProgramTemplate(this.templateForm.modality) ? this.templateForm.programCode : '',
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

  importTemplatesCsv(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    void this.readCsvFile(file)
      .then((rows) => this.saveTemplateRows(rows))
      .finally(() => {
        input.value = '';
      });
  }

  updateBatchSearch(value: string): void {
    this.batchSearch = value;
  }

  updateBatchStatus(value: string): void {
    this.batchStatus = value as AssignmentStatus | 'TODOS';
  }

  updateTemplateSelection(assignmentId: string, templateId: string): void {
    this.templateSelections[assignmentId] = templateId;
  }

  isAssignmentSelected(assignmentId: string): boolean {
    return this.selectedAssignments().includes(assignmentId);
  }

  toggleAssignment(assignmentId: string): void {
    const current = this.selectedAssignments();
    const next = current.includes(assignmentId)
      ? current.filter((id) => id !== assignmentId)
      : [...current, assignmentId];

    this.selectedAssignments.set(next);
  }

  toggleVisibleAssignments(): void {
    const visibleIds = this.moodleAssignments().map((assignment) => assignment.id);
    const current = this.selectedAssignments();
    const hasAllVisible = visibleIds.every((id) => current.includes(id));

    this.selectedAssignments.set(
      hasAllVisible
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
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
      ['shortname', 'fullname', 'category', 'visible', 'templatecourse'],
      ...selectedRows.map((assignment) => {
        const fullname = this.moodleFullname(assignment);
        const template = this.templateForAssignment(assignment);

        return [
          fullname.replace(/\s+/g, '_'),
          fullname,
          this.categoryForAssignment(assignment)?.categoryNumber ?? '',
          '1',
          template?.templateCourse ?? '',
        ];
      }),
    ];
    const csvContent = csvRows
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\n');

    this.downloadTextFile(`${csvContent}\n`, `moodle-cursos-${this.activeCycleCode()}.csv`, 'text/csv;charset=utf-8;');
    this.showMessage('CSV Moodle generado correctamente.', 'success');
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
      this.showMessage('Estado de asignacion actualizado correctamente.', 'success');
    } catch (error) {
      this.showMessage(`No se pudo actualizar el estado. ${this.errorMessage(error)}`, 'error');
    }
  }

  categoryForAssignment(assignment: AcademicAssignment): MoodleCategory | null {
    return this.categories().find((category) =>
      category.status === 'Activo' && category.programCode === assignment.program,
    ) ?? null;
  }

  templateForAssignment(assignment: AcademicAssignment): MoodleCourseTemplate | null {
    const selectedId = this.templateSelections[assignment.id];
    const selectedTemplate = selectedId
      ? this.templates().find((template) => template.id === selectedId)
      : null;

    return selectedTemplate
      ?? this.automaticTemplateForAssignment(assignment)
      ?? this.activeTemplates().find((template) => template.programCode === assignment.program)
      ?? null;
  }

  automaticTemplateForDisplay(assignment: AcademicAssignment): MoodleCourseTemplate | null {
    return this.templateSelections[assignment.id]
      ? null
      : this.automaticTemplateForAssignment(assignment);
  }

  isProgramTemplate(type: string): boolean {
    return this.normalizeSearchText(type) === 'por programa'
      || this.normalizeSearchText(type) === 'programa';
  }

  templateTypeLabel(type: string): string {
    const normalized = this.normalizeSearchText(type);
    const labels: Record<string, string> = {
      axiologica: 'Axiologica',
      demo: 'Demo',
      transversal: 'Transversal',
      generica: 'Generica',
      programa: 'Por programa',
      'por programa': 'Por programa',
    };

    return labels[normalized] ?? (type || 'General');
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

  private isLoadedInMoodle(assignment: AcademicAssignment): boolean {
    return assignment.status === 'CARGADO_MOODLE' || assignment.status === 'VALIDADO';
  }

  private automaticTemplateForAssignment(assignment: AcademicAssignment): MoodleCourseTemplate | null {
    const templateCourse = this.isNursingHealthBaseGroup(assignment)
      ? NURSING_HEALTH_TEMPLATE
      : this.isNutritionHealthBaseGroup(assignment)
        ? NUTRITION_HEALTH_TEMPLATE
      : DEFAULT_TEMPLATE_BY_MODE[this.assignmentBatchMode(assignment)];

    if (!templateCourse) {
      return null;
    }

    return this.findActiveTemplateByCourse(templateCourse);
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

  private async saveTemplateRows(rows: string[][]): Promise<void> {
    const actor = this.actorData();

    if (!actor || !this.canManageMoodle()) {
      this.showCsvMessage('No tienes permisos para cargar plantillas Moodle.', 'error');
      return;
    }

    const headers = this.csvHeaderIndex(rows[0] ?? []);
    const payloads = rows.slice(1).flatMap((row): UpsertMoodleCourseTemplatePayload[] => {
      const templateCourse = this.csvValue(row, headers, ['nombre_corto_moodle', 'nombre_corto', 'shortname', 'templatecourse', 'template_course', 'plantilla']);
      const name = this.csvValue(row, headers, ['nombre', 'name', 'nombre_plantilla']);
      const modality = this.csvValue(row, headers, ['tipo', 'modalidad', 'modality']);
      const programCode = this.csvValue(row, headers, ['programa', 'programCode', 'abreviatura']);
      const statusText = this.csvValue(row, headers, ['estado', 'status', 'activo']);

      if (!templateCourse && !name && !modality && !programCode) {
        return [];
      }

      if (!templateCourse) {
        return [];
      }

      return [{
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

    if (!payloads.length) {
      this.showCsvMessage('El CSV no contiene plantillas validas.', 'error');
      return;
    }

    try {
      await this.templatesRepository.importTemplates(payloads);
      this.showCsvMessage(`Se cargaron ${payloads.length} plantilla(s) Moodle.`, 'success');
    } catch (error) {
      this.showCsvMessage(`No se pudo cargar el CSV. ${this.errorMessage(error)}`, 'error');
    }
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
    return content
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => this.parseCsvLine(line));
  }

  private parseCsvLine(line: string): string[] {
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
      } else if (char === ',' && !insideQuotes) {
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

    if (normalized === 'axiologica') {
      return 'Axiologica';
    }

    if (normalized === 'demo') {
      return 'Demo';
    }

    if (normalized === 'transversal') {
      return 'Transversal';
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

  private moodleFullname(assignment: AcademicAssignment): string {
    return this.normalizeForMoodle(`${assignment.moodleId} ${assignment.subjectName} ${assignment.cycle}`);
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

  private programOptionLabel(code: string, name: string): string {
    const normalizedCode = this.normalizeProgramCode(code);
    const option = this.programOptions().find((currentOption) => currentOption.code === normalizedCode);

    if (option) {
      return option.label;
    }

    return name.trim() ? `${normalizedCode} - ${name.trim()}` : normalizedCode;
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
